import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

const DEFAULT_MAX_PREVIEW_BYTES = 256 * 1024;

function success(value) {
  return { ok: true, value };
}

function rejected(code, message) {
  return { ok: false, error: { code, message } };
}

function truncateUtf8(text, maxBytes) {
  if (Buffer.byteLength(text) <= maxBytes) return { text, truncated: false };
  let bytes = 0;
  let end = 0;
  for (const char of text) {
    const next = Buffer.byteLength(char);
    if (bytes + next > maxBytes) break;
    bytes += next;
    end += char.length;
  }
  return { text: text.slice(0, end), truncated: true };
}

export class RelayWorkspaceFilesGateway extends TypertRemoteService {
  constructor(ctx, { resolveAgent, maxPreviewBytes = DEFAULT_MAX_PREVIEW_BYTES }) {
    super(ctx, "relayWorkspaceFiles");
    this.resolveAgent = resolveAgent;
    this.maxPreviewBytes = maxPreviewBytes;
  }

  async list(request, signal) {
    try {
      const resolved = await this.resolveWorkspacePath(request.sessionId, request.path ?? ".", signal);
      if (!resolved.ok) return resolved;
      const info = await this.ctx.fs.stat(resolved.value.target, signal);
      if (!info) return rejected("not-found", `path "${request.path ?? "."}" does not exist`);
      if (info.type !== "directory") return rejected("not-a-directory", `path "${request.path ?? "."}" is not a directory`);
      const entries = (await this.ctx.fs.listDir(resolved.value.target, signal))
        .map((entry) => ({
          name: entry.name,
          path: entry.target.displayPath,
          type: entry.type,
          ...(entry.size === undefined ? {} : { size: entry.size }),
          ...(entry.version === undefined ? {} : { version: String(entry.version) }),
        }))
        .sort((left, right) => {
          if (left.type === "directory" && right.type !== "directory") return -1;
          if (left.type !== "directory" && right.type === "directory") return 1;
          return left.name.localeCompare(right.name);
        });
      return success({
        root: resolved.value.root.displayPath,
        path: resolved.value.target.displayPath,
        entries,
      });
    } catch (error) {
      return this.failure(error);
    }
  }

  async readText(request, signal) {
    try {
      const resolved = await this.resolveWorkspacePath(request.sessionId, request.path, signal);
      if (!resolved.ok) return resolved;
      const info = await this.ctx.fs.stat(resolved.value.target, signal);
      if (!info) return rejected("not-found", `path "${request.path}" does not exist`);
      if (info.type !== "file") return rejected("not-a-file", `path "${request.path}" is not a file`);
      const preview = await this.previewText(resolved.value.target, info, signal);
      return success({
        path: resolved.value.target.displayPath,
        content: preview.text,
        truncated: preview.truncated,
        ...(info.size === undefined ? {} : { size: info.size }),
        ...(info.version === undefined ? {} : { version: String(info.version) }),
      });
    } catch (error) {
      return this.failure(error);
    }
  }

  async resolveWorkspacePath(sessionId, path, signal) {
    const agent = await this.resolveAgent(sessionId);
    const cwd = agent.session.header.cwd;
    if (!cwd) return rejected("workspace-unavailable", `session "${sessionId}" has no workspace cwd`);
    const options = signal === undefined ? undefined : { signal };
    const root = await this.ctx.fs.resolve(cwd, options);
    const target = await this.ctx.fs.resolve(path, signal === undefined ? { cwd } : { cwd, signal });
    if (!this.ctx.fs.contains(root, target)) {
      return rejected("path-outside-workspace", `path "${path}" is outside the session workspace`);
    }
    return success({ root, target });
  }

  async previewText(target, info, signal) {
    if (info.size !== undefined && info.size > this.maxPreviewBytes) {
      const stream = await this.ctx.fs.streamText(target, signal);
      let text = "";
      for await (const chunk of stream) {
        const next = truncateUtf8(text + chunk, this.maxPreviewBytes);
        text = next.text;
        if (next.truncated) return { text, truncated: true };
      }
      return { text, truncated: true };
    }
    return truncateUtf8(await this.ctx.fs.readText(target, signal), this.maxPreviewBytes);
  }

  failure(error) {
    const code = error?.code;
    if (code === "FS_NOT_TEXT") return rejected("not-text", error.message);
    if (code === "FS_NOT_FOUND") return rejected("not-found", error.message);
    if (code === "FS_NOT_DIRECTORY") return rejected("not-a-directory", error.message);
    if (code === "FS_NOT_REGULAR_FILE") return rejected("not-a-file", error.message);
    return rejected("internal", error?.message ?? String(error));
  }
}
