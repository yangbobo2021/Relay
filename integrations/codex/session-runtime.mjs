import { EventEmitter } from "node:events";

const RELAY_THREAD_SOURCE = "relay.codex";

export class CodexSessionRuntime extends EventEmitter {
  constructor({
    client,
    cwd = process.cwd(),
  }) {
    super();
    this.client = client;
    this.cwd = cwd;
    this.sessions = new Map();
    this.pendingRequests = new Map();
    this.models = [];
    this.account = null;
    this.selectedSessionId = null;
    this.diagnostics = [];
    this.closed = false;

    this.client.on("notification", (message) => this.handleNotification(message));
    this.client.on("serverRequest", (message) => this.handleServerRequest(message));
    this.client.on("diagnostic", (message) => this.addDiagnostic(message));
    this.client.on("exit", (details) => {
      this.addDiagnostic(`Codex App Server exited: ${JSON.stringify(details)}`);
      this.emitChange();
    });
  }

  async initialize() {
    await this.client.start();
    const [modelsResult, accountResult, threadsResult] = await Promise.all([
      this.client.request("model/list", { limit: 50, includeHidden: false }),
      this.client.request("account/read", { refreshToken: false }).catch((error) => {
        this.addDiagnostic(`account/read failed: ${error.message}`);
        return null;
      }),
      this.client.request("thread/list", {
        limit: 100,
        sortKey: "updated_at",
        sortDirection: "desc",
        cwd: this.cwd,
      }).catch((error) => {
        this.addDiagnostic(`thread/list failed: ${error.message}`);
        return { data: [] };
      }),
    ]);
    this.models = modelsResult.data ?? [];
    this.account = accountResult;
    for (const thread of (threadsResult.data ?? []).filter(
      (candidate) => candidate.threadSource === RELAY_THREAD_SOURCE,
    )) {
      this.upsertThread(thread, this.defaultSessionSettings(thread.cwd));
    }
    this.emitChange();
    return this.snapshot();
  }

  async createSession({
    model,
    effort,
    sandbox = "workspace-write",
    approvalPolicy = "on-request",
    cwd = this.cwd,
    dynamicTools,
    baseInstructions,
    developerInstructions,
    ephemeral,
    serviceName = "relay_codex",
    threadSource = RELAY_THREAD_SOURCE,
  } = {}) {
    const selectedModel = model ?? this.models.find((candidate) => candidate.isDefault)?.id ?? null;
    const selectedEffort = effort
      ?? this.models.find((candidate) => candidate.id === selectedModel)?.defaultReasoningEffort
      ?? null;
    const result = await this.client.request("thread/start", compactObject({
      model: selectedModel,
      cwd,
      sandbox,
      approvalPolicy,
      serviceName,
      threadSource,
      dynamicTools,
      baseInstructions,
      developerInstructions,
      ephemeral,
    }));
    const session = this.upsertThread(result.thread, {
      model: selectedModel,
      effort: selectedEffort,
      sandbox,
      approvalPolicy,
      cwd,
      ephemeral: Boolean(result.thread.ephemeral ?? ephemeral),
    });
    if (!session.ephemeral) this.selectedSessionId = session.id;
    this.emitChange();
    return publicSession(session);
  }

  async selectSession(threadId) {
    const existing = this.requireSession(threadId);
    return this.resumeSession(threadId, existing);
  }

  async resumeSession(threadId, defaults = {}) {
    if (!threadId?.trim()) throw new Error("threadId is required");
    const result = await this.client.request("thread/resume", {
      threadId,
      cwd: defaults.cwd ?? this.cwd,
      ...(defaults.dynamicTools === undefined ? {} : { dynamicTools: defaults.dynamicTools }),
    });
    const session = this.upsertThread(result.thread, defaults);
    if (result.thread.turns?.length > 0) {
      session.turns = structuredClone(result.thread.turns);
    }
    this.selectedSessionId = threadId;
    this.emitChange();
    return publicSession(session);
  }

  async sendMessage(threadId, { text, model, effort, sandbox, approvalPolicy } = {}) {
    const session = this.requireSession(threadId);
    if (!text?.trim()) throw new Error("message text is required");
    const nextModel = model ?? session.model;
    const nextEffort = effort ?? session.effort;
    const nextSandbox = sandbox ?? session.sandbox;
    const nextApprovalPolicy = approvalPolicy ?? session.approvalPolicy;

    if (!session.title) session.title = summarizeTitle(text);
    Object.assign(session, {
      model: nextModel,
      effort: nextEffort,
      sandbox: nextSandbox,
      approvalPolicy: nextApprovalPolicy,
    });
    this.emitChange();

    const result = await this.client.request("turn/start", compactObject({
      threadId,
      input: [{ type: "text", text }],
      cwd: session.cwd,
      model: nextModel,
      effort: nextEffort,
      summary: "detailed",
      approvalPolicy: nextApprovalPolicy,
      sandboxPolicy: sandboxPolicy(nextSandbox, session.cwd),
    }), { timeoutMs: 60_000 });
    this.ensureTurn(session, result.turn);
    this.emitChange();
    return structuredClone(result.turn);
  }

  async interruptTurn(threadId, turnId) {
    await this.client.request("turn/interrupt", { threadId, turnId });
  }

  async releaseSession(threadId) {
    if (!threadId) return;
    await this.client.request("thread/unsubscribe", { threadId }).catch((error) => {
      this.addDiagnostic(`thread/unsubscribe failed for ${threadId}: ${error.message}`);
    });
    this.sessions.delete(threadId);
    for (const [requestId, request] of this.pendingRequests) {
      if (request.params?.threadId === threadId) this.pendingRequests.delete(requestId);
    }
    if (this.selectedSessionId === threadId) this.selectedSessionId = null;
    this.emitChange();
  }

  async sendAndWait(threadId, message, { timeoutMs = 30 * 60_000 } = {}) {
    const turn = await this.sendMessage(threadId, message);
    return this.waitForTurn(threadId, turn.id, { timeoutMs });
  }

  waitForTurn(threadId, turnId, { timeoutMs = 30 * 60_000 } = {}) {
    const settled = () => {
      const turn = this.sessions.get(threadId)?.turns.find((candidate) => candidate.id === turnId);
      return turn && turn.status !== "inProgress" ? structuredClone(turn) : null;
    };
    const current = settled();
    if (current) return Promise.resolve(current);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off("change", onChange);
        reject(new Error(`Codex turn ${turnId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      const onChange = () => {
        const turn = settled();
        if (!turn) return;
        clearTimeout(timer);
        this.off("change", onChange);
        resolve(turn);
      };
      this.on("change", onChange);
    });
  }

  getSession(threadId) {
    const session = this.sessions.get(threadId);
    return session ? publicSession(session) : null;
  }

  async resolveRequest(requestId, { action, answers = {} } = {}) {
    const key = String(requestId);
    const request = this.pendingRequests.get(key);
    if (!request) throw new Error(`unknown pending request ${requestId}`);
    const result = responseForServerRequest(request, action, answers);
    this.client.respond(request.id, result);
    this.pendingRequests.delete(key);
    this.emitChange();
    return { resolved: true };
  }

  respondDynamicTool(requestId, success, text) {
    const key = String(requestId);
    if (!this.pendingRequests.has(key)) throw new Error(`unknown pending request ${requestId}`);
    this.client.respond(requestId, {
      success,
      contentItems: [{ type: "inputText", text: String(text) }],
    });
    this.pendingRequests.delete(key);
    this.emitChange();
  }

  rejectRequest(requestId, error) {
    const key = String(requestId);
    if (!this.pendingRequests.has(key)) return;
    this.client.respondError(requestId, -32000, error?.message ?? String(error));
    this.pendingRequests.delete(key);
    this.addDiagnostic(`Codex request ${requestId} failed: ${error?.message ?? error}`);
    this.emitChange();
  }

  snapshot() {
    return {
      connected: Boolean(this.client.process ?? this.client.connected),
      selectedSessionId: this.selectedSessionId,
      cwd: this.cwd,
      account: sanitizeAccount(this.account),
      models: structuredClone(this.models),
      sessions: [...this.sessions.values()]
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .map((session) => publicSession(session)),
      pendingRequests: [...this.pendingRequests.values()].map(publicPendingRequest),
      diagnostics: this.diagnostics.slice(-20),
    };
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    await this.client.close();
  }

  handleNotification(message) {
    const { method, params = {} } = message;
    const threadId = params.threadId ?? params.thread?.id ?? null;
    let session = threadId ? this.sessions.get(threadId) : null;

    if (method === "thread/started" && params.thread) {
      session = this.upsertThread(params.thread, {});
    } else if (method === "thread/status/changed" && session) {
      session.status = structuredClone(params.status);
      session.updatedAt = Date.now();
    } else if (method === "thread/name/updated" && session) {
      session.title = params.name;
    } else if (method === "turn/started" && session) {
      this.ensureTurn(session, params.turn);
      session.updatedAt = Date.now();
    } else if (method === "turn/completed" && session) {
      this.replaceTurn(session, params.turn);
      session.updatedAt = Date.now();
    } else if (method === "turn/diff/updated" && session) {
      const turn = this.ensureTurn(session, { id: params.turnId, items: [], status: "inProgress" });
      turn.diff = params.diff;
    } else if (method === "turn/plan/updated" && session) {
      const turn = this.ensureTurn(session, { id: params.turnId, items: [], status: "inProgress" });
      turn.plan = structuredClone(params.plan);
      turn.planExplanation = params.explanation ?? null;
    } else if ((method === "item/started" || method === "item/completed") && session) {
      const turn = this.ensureTurn(session, { id: params.turnId, items: [], status: "inProgress" });
      this.upsertItem(turn, params.item);
      if (params.item.type === "userMessage" && !session.title) {
        const text = params.item.content?.find((input) => input.type === "text")?.text;
        if (text) session.title = summarizeTitle(text);
      }
    } else if (session) {
      this.applyDelta(session, method, params);
    }

    if (method === "serverRequest/resolved") {
      this.pendingRequests.delete(String(params.requestId));
    }
    if (method === "error") {
      this.addDiagnostic(params.error?.message ?? JSON.stringify(params));
    }
    this.emit("activity", structuredClone(message));
    this.emitChange();
  }

  handleServerRequest(request) {
    const key = String(request.id);
    this.pendingRequests.set(key, structuredClone(request));
    this.emit("request", structuredClone(request));
    this.emitChange();
  }

  applyDelta(session, method, params) {
    if (!params.turnId || !params.itemId) return;
    const turn = this.ensureTurn(session, { id: params.turnId, items: [], status: "inProgress" });
    let item = turn.items.find((candidate) => candidate.id === params.itemId);
    if (!item) {
      item = deltaPlaceholder(method, params.itemId);
      turn.items.push(item);
    }
    if (method === "item/agentMessage/delta") {
      item.text = `${item.text ?? ""}${params.delta}`;
    } else if (method === "item/plan/delta") {
      item.text = `${item.text ?? ""}${params.delta}`;
    } else if (method === "item/reasoning/summaryTextDelta") {
      item.summary ??= [];
      item.summary[params.summaryIndex] = `${item.summary[params.summaryIndex] ?? ""}${params.delta}`;
    } else if (method === "item/reasoning/textDelta") {
      item.content ??= [""];
      item.content[0] = `${item.content[0] ?? ""}${params.delta}`;
    } else if (method === "item/commandExecution/outputDelta") {
      item.aggregatedOutput = `${item.aggregatedOutput ?? ""}${params.delta}`;
    }
  }

  upsertThread(thread, defaults) {
    const existing = this.sessions.get(thread.id);
    const session = existing ?? {
      id: thread.id,
      sessionId: thread.sessionId ?? thread.id,
      title: thread.name || (thread.preview ? summarizeTitle(thread.preview) : ""),
      preview: thread.preview ?? "",
      model: defaults.model ?? null,
      effort: defaults.effort ?? null,
      sandbox: defaults.sandbox ?? "workspace-write",
      approvalPolicy: defaults.approvalPolicy ?? "on-request",
      ephemeral: Boolean(thread.ephemeral ?? defaults.ephemeral),
      cwd: thread.cwd ?? defaults.cwd ?? this.cwd,
      status: thread.status ?? { type: "idle" },
      turns: [],
      createdAt: (thread.createdAt ?? Date.now() / 1000) * 1000,
      updatedAt: (thread.updatedAt ?? Date.now() / 1000) * 1000,
    };
    session.sessionId = thread.sessionId ?? session.sessionId;
    session.preview = thread.preview ?? session.preview;
    session.cwd = thread.cwd ?? defaults.cwd ?? session.cwd;
    session.status = thread.status ?? session.status;
    session.ephemeral = Boolean(thread.ephemeral ?? defaults.ephemeral ?? session.ephemeral);
    session.updatedAt = (thread.updatedAt ?? session.updatedAt / 1000) * 1000;
    if (thread.name) session.title = thread.name;
    if (thread.turns?.length > 0 && session.turns.length === 0) {
      session.turns = structuredClone(thread.turns);
    }
    Object.assign(session, compactObject({
      model: defaults.model,
      effort: defaults.effort,
      sandbox: defaults.sandbox,
      approvalPolicy: defaults.approvalPolicy,
    }));
    this.sessions.set(session.id, session);
    return session;
  }

  defaultSessionSettings(cwd = this.cwd) {
    const model = this.models.find((candidate) => candidate.isDefault) ?? this.models[0];
    return {
      model: model?.id ?? null,
      effort: model?.defaultReasoningEffort ?? null,
      sandbox: "workspace-write",
      approvalPolicy: "on-request",
      cwd,
    };
  }

  ensureTurn(session, partial) {
    let turn = session.turns.find((candidate) => candidate.id === partial.id);
    if (!turn) {
      turn = {
        id: partial.id,
        items: [],
        status: partial.status ?? "inProgress",
        error: null,
      };
      session.turns.push(turn);
    }
    if (partial.items?.length > 0) {
      for (const item of partial.items) this.upsertItem(turn, item);
    }
    for (const key of ["status", "error", "startedAt", "completedAt", "durationMs", "itemsView"]) {
      if (partial[key] !== undefined) turn[key] = structuredClone(partial[key]);
    }
    return turn;
  }

  replaceTurn(session, completed) {
    const turn = this.ensureTurn(session, completed);
    if (completed.items?.length > 0) {
      for (const item of completed.items) this.upsertItem(turn, item);
    }
    return turn;
  }

  upsertItem(turn, nextItem) {
    const index = turn.items.findIndex((item) => item.id === nextItem.id);
    if (index === -1) {
      turn.items.push(structuredClone(nextItem));
    } else {
      turn.items[index] = structuredClone(nextItem);
    }
  }

  requireSession(threadId) {
    const session = this.sessions.get(threadId);
    if (!session) throw new Error(`unknown Codex thread ${threadId}`);
    return session;
  }

  addDiagnostic(message) {
    const clean = String(message).trim();
    if (!clean) return;
    this.diagnostics.push(clean);
    if (this.diagnostics.length > 100) this.diagnostics.shift();
  }

  emitChange() {
    if (this.closed) return;
    this.emit("change", this.snapshot());
  }
}

function sandboxPolicy(sandbox, cwd) {
  if (sandbox === "read-only") return { type: "readOnly" };
  if (sandbox === "danger-full-access") return { type: "dangerFullAccess" };
  return {
    type: "workspaceWrite",
    writableRoots: [cwd],
    networkAccess: true,
  };
}

function responseForServerRequest(request, action, answers) {
  if (request.method === "item/commandExecution/requestApproval"
    || request.method === "item/fileChange/requestApproval"
    || request.method === "execCommandApproval"
    || request.method === "applyPatchApproval") {
    return { decision: action ?? "decline" };
  }
  if (request.method === "item/permissions/requestApproval") {
    return {
      permissions: action === "accept" || action === "acceptForSession"
        ? request.params.permissions
        : {},
      scope: action === "acceptForSession" ? "session" : "turn",
    };
  }
  if (request.method === "item/tool/requestUserInput") {
    return {
      answers: Object.fromEntries(Object.entries(answers).map(([id, value]) => [
        id,
        { answers: Array.isArray(value) ? value : [String(value)] },
      ])),
    };
  }
  if (request.method === "mcpServer/elicitation/request") {
    return {
      action: action === "accept" ? "accept" : action === "cancel" ? "cancel" : "decline",
      content: action === "accept" ? answers : null,
      _meta: null,
    };
  }
  throw new Error(`unsupported Codex server request ${request.method}`);
}

function deltaPlaceholder(method, itemId) {
  if (method.startsWith("item/reasoning/")) {
    return { type: "reasoning", id: itemId, summary: [], content: [] };
  }
  if (method === "item/commandExecution/outputDelta") {
    return { type: "commandExecution", id: itemId, command: "", aggregatedOutput: "", status: "inProgress" };
  }
  if (method === "item/plan/delta") {
    return { type: "plan", id: itemId, text: "" };
  }
  return { type: "agentMessage", id: itemId, text: "", phase: "commentary" };
}

function publicSession(session) {
  const copy = structuredClone(session);
  for (const turn of copy.turns) {
    for (const item of turn.items) {
      if (item.type === "imageGeneration" && item.savedPath) {
        item.result = null;
      }
    }
  }
  return {
    ...copy,
  };
}

function publicPendingRequest(request) {
  return {
    requestId: String(request.id),
    method: request.method,
    params: structuredClone(request.params),
  };
}

function sanitizeAccount(result) {
  if (!result) return null;
  return {
    requiresOpenaiAuth: result.requiresOpenaiAuth,
    type: result.account?.type ?? null,
    planType: result.account?.planType ?? null,
  };
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null));
}

function summarizeTitle(text) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 54 ? `${normalized.slice(0, 53)}...` : normalized;
}
