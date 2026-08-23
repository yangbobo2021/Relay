import { homedir } from "node:os";
import { basename, resolve } from "node:path";

import { LlmAdapter } from "@deepseek-ai/dsh-llm";

import { importCodexGeneratedImage, importCodexImage } from "./codex-image.js";
import { CODEX_APP_DYNAMIC_TOOLS, codexDynamicTools } from "./codex-tools.js";

export const CODEX_PRESET = "relay-codex";
export const CODEX_PROVIDER = "relay-codex";
export const CODEX_ACTIVITY_EVENT = "relay-codex/activity";
const CODEX_AUXILIARY_THREAD_SOURCE = "relay.codex.auxiliary";

export class CodexDshAdapter extends LlmAdapter {
  constructor({
    runtime,
    ready,
    linkStore = null,
    attachments = null,
    logger = console,
    dynamicTools = CODEX_APP_DYNAMIC_TOOLS,
  }) {
    super();
    this.runtime = runtime;
    this.ready = ready;
    this.logger = logger;
    this.linkStore = linkStore;
    this.attachments = attachments;
    this.dynamicTools = dynamicTools;
    this.links = new Map();
    this.settings = new Map();
    this.pendingThreads = new Map();
    this.agents = new Map();
    this.dshToolNames = new Map();
    this.appliedDynamicToolSignatures = new Map();
    for (const [sessionId, record] of linkStore?.entries() ?? []) {
      if (record.threadId) this.links.set(sessionId, record.threadId);
      this.settings.set(sessionId, record.config);
    }
  }

  providerInfo() {
    return { id: CODEX_PROVIDER, name: "Codex" };
  }

  async listModels() {
    await this.ready;
    return runtimeModels(this.runtime)
      .sort((left, right) => Number(Boolean(right.isDefault)) - Number(Boolean(left.isDefault)))
      .map((model) => ({
        provider: CODEX_PROVIDER,
        id: model.id,
        name: model.displayName ?? model.id,
        description: model.description,
        inputModalities: ["text", "image"],
      }));
  }

  async resolveModel(provider, model) {
    await this.ready;
    const info = runtimeModels(this.runtime).find((candidate) => candidate.id === model);
    return {
      provider,
      id: model,
      name: info?.displayName ?? model,
      inputModalities: ["text", "image"],
      ...(Array.isArray(info?.supportedReasoningEfforts)
        ? {
            reasoning: {
              efforts: info.supportedReasoningEfforts.map((effort) => ({
                id: effort.reasoningEffort ?? effort.id ?? effort,
                name: reasoningEffortName(effort.reasoningEffort ?? effort.id ?? effort),
              })),
              defaultEffort: info.defaultReasoningEffort,
            },
          }
        : {}),
    };
  }

  attachAgent(agent, requestedPreset = effectivePreset(agent.session)) {
    this.agents.set(String(agent.id), agent);
    if (requestedPreset !== CODEX_PRESET) {
      return false;
    }
    this.configuration(agent.id, agent.session.header.cwd);
    return true;
  }

  servesAgent(agent) {
    return effectivePreset(agent.session) === CODEX_PRESET;
  }

  detachAgent(sessionId) {
    this.agents.delete(String(sessionId));
    this.dshToolNames.delete(String(sessionId));
    this.appliedDynamicToolSignatures.delete(String(sessionId));
  }

  configuration(sessionId, cwd) {
    const key = String(sessionId);
    const existing = this.settings.get(key);
    if (existing) return existing;
    const models = runtimeModels(this.runtime);
    const model = models.find((candidate) => candidate.isDefault) ?? models[0];
    const config = {
      model: model?.id ?? "gpt-5-codex",
      effort: model?.defaultReasoningEffort ?? null,
      sandbox: "workspace-write",
      approvalPolicy: "on-request",
      cwd: cwd ?? process.cwd(),
    };
    this.settings.set(key, config);
    return config;
  }

  configure(sessionId, patch = {}) {
    const key = String(sessionId);
    const next = { ...this.configuration(key), ...compact(patch) };
    this.settings.set(key, next);
    const threadId = this.links.get(key);
    if (threadId) {
      patchRuntimeSession(this.runtime, threadId, next);
    }
    this.persistLink(key);
    return structuredClone(next);
  }

  async ensureThread(sessionId, dynamicTools = this.dynamicTools) {
    const key = String(sessionId);
    const pending = this.pendingThreads.get(key);
    if (pending) return pending;
    const operation = this.createOrResumeThread(key, dynamicTools).finally(() => {
      this.pendingThreads.delete(key);
    });
    this.pendingThreads.set(key, operation);
    return operation;
  }

  async createOrResumeThread(sessionId, dynamicTools) {
    await this.ready;
    const settings = { ...this.configuration(sessionId), dynamicTools };
    const signature = JSON.stringify(dynamicTools);
    const linked = this.links.get(sessionId);
    if (linked && hasRuntimeSession(this.runtime, linked)) {
      if (this.appliedDynamicToolSignatures.get(sessionId) !== signature) {
        await this.runtime.resumeSession(linked, settings);
        this.appliedDynamicToolSignatures.set(sessionId, signature);
      }
      return linked;
    }
    if (linked) {
      try {
        await this.runtime.resumeSession(linked, settings);
        this.appliedDynamicToolSignatures.set(sessionId, signature);
        return linked;
      } catch (error) {
        this.logger.warn(`Relay could not resume Codex thread ${linked}; creating a replacement: ${error.message}`);
        this.links.delete(sessionId);
      }
    }
    const created = await this.runtime.createSession(settings);
    this.links.set(sessionId, created.id);
    this.appliedDynamicToolSignatures.set(sessionId, signature);
    this.persistLink(sessionId);
    return created.id;
  }

  persistLink(sessionId) {
    this.linkStore?.set(sessionId, {
      threadId: this.links.get(sessionId) ?? null,
      config: this.configuration(sessionId),
    });
  }

  threadFor(sessionId) {
    return this.links.get(String(sessionId)) ?? null;
  }

  dshSessionForThread(threadId) {
    for (const [sessionId, candidate] of this.links) {
      if (candidate === threadId) return sessionId;
    }
    return null;
  }

  hasDshTool(sessionId, name) {
    return this.dshToolNames.get(String(sessionId))?.has(name) === true;
  }

  async *stream(options) {
    if (options.purpose) {
      yield* this.streamAuxiliary(options);
      return;
    }
    const sessionId = String(options.sessionId ?? "");
    if (!sessionId) throw new Error("Relay Codex adapter requires a DSH session id");
    const input = latestUserInput(options.messages);
    if (!input) throw new Error("Relay Codex adapter received no user text or image input");
    const agent = this.agents.get(sessionId);
    if (!agent) throw new Error(`Relay Codex adapter has no attached agent for ${sessionId}`);

    const nativePermissions = permissionConfiguration(agent.session.events);
    const config = this.configure(sessionId, {
      ...(options.provider === CODEX_PROVIDER ? { model: options.model } : {}),
      ...(options.provider === CODEX_PROVIDER ? { effort: options.reasoningEffort } : {}),
      ...nativePermissions,
      cwd: agent.session.header.cwd,
    });
    const dshTools = options.tools ?? [];
    this.dshToolNames.set(sessionId, new Set(dshTools.map(tool => tool.name)));
    const threadId = await this.ensureThread(sessionId, codexDynamicTools(dshTools, this.dynamicTools));
    const queue = new ActivityQueue(options.signal);
    const onActivity = (message) => {
      const candidate = message.params?.threadId ?? message.params?.thread?.id;
      if (candidate === threadId) queue.push(message);
    };
    const stopActivity = subscribeRuntimeActivity(this.runtime, onActivity);

    let turnId = null;
    try {
      const started = await this.runtime.sendMessage(threadId, { ...input, ...config });
      turnId = started.id;
      const state = createStreamState();
      let completedTurn = null;
      while (!completedTurn) {
        const message = await queue.next();
        const params = message.params ?? {};
        if (params.turnId && params.turnId !== turnId) continue;
        if (message.method === "turn/completed") {
          if (params.turn?.id !== turnId) continue;
          for (const item of params.turn.items ?? []) {
            for (const chunk of await this.completeItem(agent, threadId, turnId, item, state)) yield chunk;
          }
          completedTurn = params.turn;
          break;
        }
        for (const chunk of await this.projectActivity(agent, threadId, turnId, message, state)) yield chunk;
      }

      for (const block of state.blocks.values()) {
        if (block.closed) continue;
        block.closed = true;
        yield { type: "block-end", index: block.index, block: { type: block.type, text: block.text } };
      }
      if (completedTurn.status === "failed") {
        yield {
          type: "finish",
          reason: { kind: "error", failure: { message: completedTurn.error?.message ?? "Codex turn failed", code: "CODEX_TURN_FAILED" } },
        };
      } else {
        yield { type: "finish", reason: { kind: "stop" }, replayState: { threadId, turnId } };
      }
    } catch (error) {
      if (options.signal?.aborted) {
        if (turnId) await this.runtime.interruptTurn(threadId, turnId).catch(() => {});
        yield { type: "finish", reason: { kind: "aborted", failure: { message: "Codex turn cancelled", code: "ABORTED" } } };
        return;
      }
      throw error;
    } finally {
      stopActivity();
      queue.close();
    }
  }

  async *streamAuxiliary(options) {
    await this.ready;
    const text = auxiliaryInput(options.messages);
    if (!text) throw new Error(`Relay Codex adapter received no ${options.purpose} input`);
    const sessionId = String(options.sessionId ?? "");
    const agent = this.agents.get(sessionId);
    const cwd = agent?.session.header.cwd ?? this.settings.get(sessionId)?.cwd ?? process.cwd();
    const created = await this.runtime.createSession({
      model: options.model,
      effort: options.reasoningEffort,
      sandbox: "read-only",
      approvalPolicy: "never",
      cwd,
      dynamicTools: [],
      baseInstructions: options.system,
      developerInstructions: auxiliaryInstructions(options.purpose),
      ephemeral: true,
      serviceName: "relay_codex_auxiliary",
      threadSource: CODEX_AUXILIARY_THREAD_SOURCE,
    });
    const threadId = created.id;
    const queue = new ActivityQueue(options.signal);
    const onActivity = (message) => {
      const candidate = message.params?.threadId ?? message.params?.thread?.id;
      if (candidate === threadId) queue.push(message);
    };
    const stopActivity = subscribeRuntimeActivity(this.runtime, onActivity);

    let turnId = null;
    try {
      const started = await this.runtime.sendMessage(threadId, {
        text,
        model: options.model,
        effort: options.reasoningEffort,
        sandbox: "read-only",
        approvalPolicy: "never",
      });
      turnId = started.id;
      const state = createStreamState();
      let completedTurn = null;
      while (!completedTurn) {
        const message = await queue.next();
        const params = message.params ?? {};
        if (params.turnId && params.turnId !== turnId) continue;
        if (message.method === "turn/completed") {
          if (params.turn?.id !== turnId) continue;
          for (const item of params.turn.items ?? []) {
            for (const chunk of completeAuxiliaryItem(state, item)) yield chunk;
          }
          completedTurn = params.turn;
          break;
        }
        for (const chunk of projectAuxiliaryActivity(message, state)) yield chunk;
      }
      for (const block of state.blocks.values()) {
        if (block.closed) continue;
        block.closed = true;
        yield { type: "block-end", index: block.index, block: { type: block.type, text: block.text } };
      }
      if (completedTurn.status === "failed") {
        yield {
          type: "finish",
          reason: { kind: "error", failure: { message: completedTurn.error?.message ?? `Codex ${options.purpose} failed`, code: "CODEX_AUXILIARY_FAILED" } },
        };
      } else {
        yield { type: "finish", reason: { kind: "stop" } };
      }
    } catch (error) {
      if (options.signal?.aborted) {
        if (turnId) await this.runtime.interruptTurn(threadId, turnId).catch(() => {});
        yield { type: "finish", reason: { kind: "aborted", failure: { message: `Codex ${options.purpose} cancelled`, code: "ABORTED" } } };
        return;
      }
      throw error;
    } finally {
      stopActivity();
      queue.close();
      await this.runtime.releaseSession(threadId);
    }
  }

  async projectActivity(agent, threadId, turnId, message, state) {
    const params = message.params ?? {};
    if (message.method === "item/reasoning/summaryTextDelta" || message.method === "item/reasoning/textDelta") {
      return textDelta(state, params.itemId, "reasoning", params.delta ?? "");
    }
    if (message.method === "item/agentMessage/delta") {
      return textDelta(state, params.itemId, "text", params.delta ?? "");
    }
    if (message.method === "item/started") {
      if (isActivityItem(params.item)) this.appendActivity(agent, threadId, turnId, params.item, "started", state);
      return [];
    }
    if (message.method === "item/completed") {
      return this.completeItem(agent, threadId, turnId, params.item, state);
    }
    return [];
  }

  async completeItem(agent, threadId, turnId, item, state) {
    if (!item?.id || state.completed.has(item.id)) return [];
    state.completed.add(item.id);
    if (item.type === "reasoning") {
      return completeTextItem(state, item.id, "reasoning", reasoningText(item));
    }
    if (item.type === "agentMessage") {
      return completeTextItem(state, item.id, "text", item.text ?? "");
    }
    if (item.type === "imageGeneration" || item.type === "imageView") {
      if (!this.attachments) return [];
      const roots = [
        resolve(agent.session.header.cwd ?? process.cwd()),
        resolve(homedir(), ".codex", "generated_images"),
      ];
      const attachment = item.type === "imageGeneration"
        ? await importCodexGeneratedImage(item, roots, this.attachments)
        : await importCodexImage(item.path, roots, this.attachments);
      const index = state.nextIndex++;
      return [
        { type: "block-start", index, blockType: "image" },
        { type: "block-end", index, block: { type: "image", attachment } },
      ];
    }
    if (isActivityItem(item)) this.appendActivity(agent, threadId, turnId, item, "completed", state);
    return [];
  }

  appendActivity(agent, threadId, turnId, item, phase, state) {
    if (!state.startedActivities.has(item.id)) {
      state.startedActivities.add(item.id);
      agent.session.append(CODEX_ACTIVITY_EVENT, activityPayload(threadId, turnId, item, "started"));
    }
    if (phase === "completed" && !state.completedActivities.has(item.id)) {
      state.completedActivities.add(item.id);
      agent.session.append(CODEX_ACTIVITY_EVENT, activityPayload(threadId, turnId, item, "completed"));
    }
  }
}

class ActivityQueue {
  constructor(signal) {
    this.signal = signal;
    this.values = [];
    this.waiters = [];
    this.closed = false;
  }

  push(value) {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) waiter.resolve(value);
    else this.values.push(value);
  }

  next() {
    if (this.values.length) return Promise.resolve(this.values.shift());
    if (this.closed) return Promise.reject(new Error("Codex activity stream closed"));
    if (this.signal?.aborted) return Promise.reject(this.signal.reason ?? new Error("aborted"));
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject };
      this.waiters.push(waiter);
      if (this.signal) {
        const abort = () => {
          const index = this.waiters.indexOf(waiter);
          if (index >= 0) this.waiters.splice(index, 1);
          reject(this.signal.reason ?? new Error("aborted"));
        };
        this.signal.addEventListener("abort", abort, { once: true });
        waiter.resolve = (value) => {
          this.signal.removeEventListener("abort", abort);
          resolve(value);
        };
      }
    });
  }

  close() {
    this.closed = true;
    for (const waiter of this.waiters.splice(0)) waiter.reject(new Error("Codex activity stream closed"));
  }
}

function createStreamState() {
  return {
    nextIndex: 0,
    blocks: new Map(),
    completed: new Set(),
    startedActivities: new Set(),
    completedActivities: new Set(),
  };
}

function textDelta(state, id, type, delta) {
  if (!id || !delta) return [];
  let block = state.blocks.get(id);
  const chunks = [];
  if (!block) {
    block = { index: state.nextIndex++, type, text: "", closed: false };
    state.blocks.set(id, block);
    chunks.push({ type: "block-start", index: block.index, blockType: type });
  }
  if (block.closed) return chunks;
  block.text += delta;
  chunks.push({ type: type === "reasoning" ? "reasoning-delta" : "text-delta", index: block.index, text: delta });
  return chunks;
}

function completeTextItem(state, id, type, completeText) {
  const chunks = [];
  let block = state.blocks.get(id);
  if (!block) {
    block = { index: state.nextIndex++, type, text: "", closed: false };
    state.blocks.set(id, block);
    chunks.push({ type: "block-start", index: block.index, blockType: type });
  }
  if (completeText && completeText.startsWith(block.text) && completeText.length > block.text.length) {
    const delta = completeText.slice(block.text.length);
    block.text = completeText;
    chunks.push({ type: type === "reasoning" ? "reasoning-delta" : "text-delta", index: block.index, text: delta });
  }
  if (!block.closed) {
    block.closed = true;
    chunks.push({ type: "block-end", index: block.index, block: { type, text: block.text } });
  }
  return chunks;
}

function activityPayload(threadId, turnId, item, phase) {
  const activity = normalizeActivity(item, phase);
  return { version: 1, threadId, turnId, itemId: String(item.id), phase, activity };
}

function normalizeActivity(item, phase) {
  const type = String(item.type ?? "tool");
  const status = phase === "started" ? "running" : item.status === "failed" ? "error" : "completed";
  if (type === "commandExecution") {
    return bounded({ type, status, title: "Bash", summary: item.command ?? "Command", input: item.command, output: item.aggregatedOutput });
  }
  if (type === "fileChange") {
    return bounded({ type, status, title: "File change", summary: summarizeValue(item.changes), input: item.changes, output: item.result });
  }
  if (type === "webSearch") {
    return bounded({ type, status, title: "Web search", summary: item.query ?? item.action ?? "Search", input: item.query ?? item.action, output: item.result });
  }
  if (type === "plan") {
    return bounded({ type, status, title: "Plan", summary: firstLine(item.text), output: item.text });
  }
  const title = item.tool ?? item.name ?? item.server ?? humanize(type);
  return bounded({
    type,
    status,
    title,
    summary: summarizeValue(item.arguments ?? item.input ?? item.prompt),
    input: item.arguments ?? item.input,
    output: item.output ?? item.result ?? item.error,
  });
}

function bounded(value) {
  return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => {
    if (entry === undefined || entry === null || entry === "") return [];
    const text = typeof entry === "string" ? entry : JSON.stringify(entry, null, 2);
    return [[key, text.length > 20_000 ? `${text.slice(0, 20_000)}\n...` : text]];
  }));
}

function isActivityItem(item) {
  return item?.id && !["userMessage", "agentMessage", "reasoning", "imageGeneration", "imageView"].includes(item.type);
}

function permissionConfiguration(events) {
  let sandbox = "workspace-write";
  let approvalPolicy = "on-request";
  for (const event of events) {
    if (event.type === "sandbox/mode") sandbox = event.data.mode;
    if (event.type === "approval/policy") approvalPolicy = event.data.policy === "never" ? "never" : "on-request";
  }
  return { sandbox, approvalPolicy };
}

function reasoningText(item) {
  return [...(item.summary ?? []), ...(item.content ?? [])].filter(Boolean).join("\n\n");
}

function summarizeValue(value) {
  if (value === undefined || value === null) return "";
  return firstLine(typeof value === "string" ? value : JSON.stringify(value));
}

function firstLine(value) {
  return String(value ?? "").split("\n")[0].slice(0, 240);
}

function humanize(value) {
  return String(value).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, letter => letter.toUpperCase());
}

function reasoningEffortName(value) {
  return String(value) === "xhigh" ? "Extra high" : humanize(value);
}

function latestUserInput(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") continue;
    if (message.source?.kind !== "user" && !isRelayActivation(message.source)) continue;
    const text = (message.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    const localImages = (message.content ?? [])
      .map(localImage)
      .filter(Boolean);
    if (text || localImages.length > 0) return { text, localImages };
  }
  return null;
}

function localImage(block) {
  if (block?.type !== "image" && block?.type !== "file") return null;
  if (block.type === "file" && !isImageFile(block)) return null;
  const path = block.path
    ?? block.fsPath
    ?? block.filePath
    ?? block.localPath
    ?? block.source?.path
    ?? block.source?.fsPath
    ?? block.attachment?.path
    ?? block.attachment?.fsPath
    ?? block.attachment?.filePath
    ?? block.attachment?.localPath;
  if (!path) return null;
  return {
    path,
    fsPath: block.fsPath ?? block.attachment?.fsPath ?? path,
    label: block.label ?? block.name ?? block.filename ?? block.attachment?.name ?? basename(path),
  };
}

function isImageFile(block) {
  const mediaType = block.mediaType ?? block.mimeType ?? block.attachment?.mediaType ?? block.attachment?.mimeType;
  if (typeof mediaType === "string" && mediaType.startsWith("image/")) return true;
  const name = block.name ?? block.filename ?? block.path ?? block.fsPath ?? block.attachment?.name ?? "";
  return /\.(png|jpe?g|gif|webp)$/i.test(name);
}

function auxiliaryInput(messages) {
  return messages.map((message) => {
    const text = (message?.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    return text ? `${message.role ?? "user"}: ${text}` : "";
  }).filter(Boolean).join("\n\n");
}

function auxiliaryInstructions(purpose) {
  return [
    `This is an isolated DSH ${purpose} request, not a user conversation turn.`,
    "Return only the requested text transformation.",
    "Do not call tools, inspect files, modify state, ask questions, or continue any other task.",
  ].join(" ");
}

function projectAuxiliaryActivity(message, state) {
  const params = message.params ?? {};
  if (message.method === "item/reasoning/summaryTextDelta" || message.method === "item/reasoning/textDelta") {
    return textDelta(state, params.itemId, "reasoning", params.delta ?? "");
  }
  if (message.method === "item/agentMessage/delta") {
    return textDelta(state, params.itemId, "text", params.delta ?? "");
  }
  if (message.method === "item/completed") return completeAuxiliaryItem(state, params.item);
  return [];
}

function completeAuxiliaryItem(state, item) {
  if (!item?.id || state.completed.has(item.id)) return [];
  state.completed.add(item.id);
  if (item.type === "reasoning") return completeTextItem(state, item.id, "reasoning", reasoningText(item));
  if (item.type === "agentMessage") return completeTextItem(state, item.id, "text", item.text ?? "");
  return [];
}

function isRelayActivation(source) {
  return source?.kind === "plugin" && source.plugin === "relay";
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null));
}

function runtimeModels(runtime) {
  return typeof runtime.listModels === "function" ? runtime.listModels() : [...runtime.models];
}

function hasRuntimeSession(runtime, sessionId) {
  return typeof runtime.hasSession === "function"
    ? runtime.hasSession(sessionId)
    : runtime.sessions.has(sessionId);
}

function patchRuntimeSession(runtime, sessionId, patch) {
  if (typeof runtime.patchSession === "function") return runtime.patchSession(sessionId, patch);
  const session = runtime.sessions.get(sessionId);
  if (session) Object.assign(session, patch);
  return Boolean(session);
}

function subscribeRuntimeActivity(runtime, listener) {
  if (typeof runtime.subscribeActivity === "function") return runtime.subscribeActivity(listener);
  runtime.on("activity", listener);
  return () => runtime.off("activity", listener);
}

function effectivePreset(session) {
  for (let index = session.events.length - 1; index >= 0; index -= 1) {
    const event = session.events[index];
    if (event.type === "agent-preset/selected") return event.data.agentPreset;
  }
  return session.header.agentPreset;
}
