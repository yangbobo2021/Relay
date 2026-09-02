import { EmailConnectorError } from "./contracts.mjs";

export class GmailApiClient {
  constructor({ token, getToken, baseUrl = "https://gmail.googleapis.com/gmail/v1", fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== "function") throw new TypeError("Gmail client requires fetch()");
    this.token = typeof token === "string" && token ? token : null;
    this.getToken = typeof getToken === "function" ? getToken : null;
    this.baseUrl = String(baseUrl).replace(/\/$/u, "");
    this.fetchImpl = fetchImpl;
  }

  async listHistory({ cursor, signal }) {
    let pageToken;
    let latest = String(cursor);
    const messageIds = new Set();
    for (let page = 0; page < 20; page += 1) {
      const query = new URLSearchParams({ startHistoryId: String(cursor), historyTypes: "messageAdded", maxResults: "500" });
      if (pageToken) query.set("pageToken", pageToken);
      const value = await this.get(`/users/me/history?${query}`, signal);
      latest = String(value.historyId ?? latest);
      for (const history of value.history ?? []) for (const added of history.messagesAdded ?? []) {
        if (added.message?.id) messageIds.add(String(added.message.id));
      }
      pageToken = value.nextPageToken;
      if (!pageToken) return { cursor: latest, messageIds: [...messageIds] };
    }
    throw new EmailConnectorError("history_too_large", "Gmail history exceeded the bounded page limit");
  }

  getMessage({ messageId, signal }) {
    return this.get(`/users/me/messages/${encodeURIComponent(messageId)}?format=full`, signal);
  }

  async listRecentMessageIds({ signal, maxMessages = 500 } = {}) {
    if (!Number.isSafeInteger(maxMessages) || maxMessages < 1 || maxMessages > 500) {
      throw new EmailConnectorError("invalid_resync_limit", "Gmail resync limit must be from 1 to 500");
    }
    let pageToken;
    const messageIds = new Set();
    for (let page = 0; page < 5 && messageIds.size < maxMessages; page += 1) {
      const query = new URLSearchParams({ maxResults: String(Math.min(100, maxMessages - messageIds.size)), q: "newer_than:7d" });
      if (pageToken) query.set("pageToken", pageToken);
      const value = await this.get(`/users/me/messages?${query}`, signal);
      for (const message of value.messages ?? []) {
        if (message?.id) messageIds.add(String(message.id));
        if (messageIds.size >= maxMessages) break;
      }
      pageToken = value.nextPageToken;
      if (!pageToken) return { messageIds: [...messageIds], truncated: false };
    }
    return { messageIds: [...messageIds], truncated: Boolean(pageToken) };
  }

  async get(path, signal) {
    const token = this.getToken ? await this.getToken() : this.token;
    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: { accept: "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw new EmailConnectorError("cancelled", "Gmail request was cancelled");
      throw new EmailConnectorError("network_error", "Gmail could not be reached");
    }
    if (!response.ok) {
      if (response.status === 401) throw new EmailConnectorError("authentication", "Gmail authentication failed");
      if (response.status === 403) throw new EmailConnectorError("permission", "Gmail permission was denied");
      if (response.status === 404 && path.includes("/history?")) throw new EmailConnectorError("cursor_expired", "Gmail history cursor expired");
      if (response.status === 400 && path.includes("/history?")) throw new EmailConnectorError("cursor_invalid", "Gmail history cursor is invalid");
      if (response.status === 429) throw new EmailConnectorError("rate_limited", "Gmail rate limit was reached");
      if (response.status >= 500) throw new EmailConnectorError("provider_unavailable", "Gmail is temporarily unavailable");
      throw new EmailConnectorError("provider_error", `Gmail request failed with status ${response.status}`);
    }
    try { return await response.json(); }
    catch { throw new EmailConnectorError("malformed_response", "Gmail returned invalid JSON"); }
  }
}
