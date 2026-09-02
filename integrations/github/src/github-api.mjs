import { GitHubConnectorError } from "./contracts.mjs";

export class GitHubApiClient {
  constructor({ token, getToken, baseUrl = "https://api.github.com", fetchImpl = globalThis.fetch, userAgent = "relay-dsh-plugin-github/0.1.0" } = {}) {
    if (typeof fetchImpl !== "function") throw new TypeError("GitHub API client requires fetch()");
    this.token = typeof token === "string" && token ? token : null;
    this.getToken = typeof getToken === "function" ? getToken : null;
    this.baseUrl = String(baseUrl).replace(/\/$/u, "");
    this.fetchImpl = fetchImpl;
    this.userAgent = userAgent;
  }

  async getPullRequestSnapshot({ repository, pull_number: pullNumber, signal }) {
    const pull = await this.get(`/repos/${encodeRepository(repository)}/pulls/${pullNumber}`, signal);
    const canonicalRepository = typeof pull?.base?.repo?.full_name === "string" ? pull.base.repo.full_name.toLowerCase() : null;
    if (canonicalRepository && canonicalRepository !== repository.toLowerCase()) {
      throw new GitHubConnectorError("repository_identity_changed", "GitHub reports that the repository identity changed; update the project policy and rearm the monitor");
    }
    const headSha = required(pull?.head?.sha, "pull request head SHA");
    const [checksResult, reviewsResult] = await Promise.all([
      this.getPaginated(`/repos/${encodeRepository(repository)}/commits/${encodeURIComponent(headSha)}/check-runs?per_page=100`, {
        signal, collection: "check_runs",
      }),
      this.getPaginated(`/repos/${encodeRepository(repository)}/pulls/${pullNumber}/reviews?per_page=100`, { signal }),
    ]);
    return {
      head_sha: headSha,
      state: pull.state,
      merged: Boolean(pull.merged),
      draft: Boolean(pull.draft),
      mergeable: pull.mergeable,
      checks: checksResult.map(check => ({
        id: String(check.id),
        name: check.name,
        status: check.status,
        conclusion: check.conclusion,
        required: true,
      })),
      reviews: reviewsResult.map(review => ({
        actor: review.user?.login ?? "unknown",
        state: review.state,
        submitted_at: review.submitted_at,
        commit_id: review.commit_id,
      })),
    };
  }

  async get(path, signal) {
    return (await this.getResponse(path, signal)).value;
  }

  async getPaginated(path, { signal, collection = null, maxPages = 5, maxItems = 500 } = {}) {
    const items = [];
    let next = path;
    for (let page = 0; next != null; page += 1) {
      if (page >= maxPages) throw new GitHubConnectorError("response_too_large", "GitHub response exceeded the pagination limit");
      const { value, headers } = await this.getResponse(next, signal);
      const pageItems = collection == null ? value : value?.[collection];
      if (!Array.isArray(pageItems)) throw new GitHubConnectorError("malformed_response", "GitHub returned an invalid paginated response");
      if (items.length + pageItems.length > maxItems) throw new GitHubConnectorError("response_too_large", "GitHub response contained too many records");
      items.push(...pageItems);
      next = nextPage(headers?.get?.("link"), this.baseUrl);
    }
    return items;
  }

  async getResponse(path, signal) {
    const token = this.getToken ? await this.getToken() : this.token;
    const headers = {
      accept: "application/vnd.github+json",
      "user-agent": this.userAgent,
      "x-github-api-version": "2022-11-28",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    };
    let response;
    try {
      const url = new URL(path, `${this.baseUrl}/`);
      const base = new URL(`${this.baseUrl}/`);
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
        throw new GitHubConnectorError("malformed_response", "GitHub pagination left the configured API boundary");
      }
      response = await this.fetchImpl(url, { method: "GET", headers, signal, redirect: "manual" });
    } catch (error) {
      if (signal?.aborted) throw Object.assign(new GitHubConnectorError("cancelled", "GitHub request was cancelled"), { cause: error });
      throw Object.assign(new GitHubConnectorError("network_error", "GitHub could not be reached"), { cause: error });
    }
    if (!response.ok) throw githubHttpError(response.status, response.headers);
    const contentType = String(response.headers?.get?.("content-type") ?? "");
    if (!contentType.toLowerCase().includes("application/json")) throw new GitHubConnectorError("malformed_response", "GitHub returned a non-JSON response");
    try { return { value: await response.json(), headers: response.headers }; }
    catch { throw new GitHubConnectorError("malformed_response", "GitHub returned invalid JSON"); }
  }
}

function nextPage(linkHeader, baseUrl) {
  if (typeof linkHeader !== "string" || !linkHeader.trim()) return null;
  for (const entry of linkHeader.split(",")) {
    const match = entry.trim().match(/^<([^>]+)>\s*;\s*rel="([^"]+)"$/u);
    if (!match || !match[2].split(/\s+/u).includes("next")) continue;
    const next = new URL(match[1], `${baseUrl}/`);
    const base = new URL(`${baseUrl}/`);
    if (next.origin !== base.origin || !next.pathname.startsWith(base.pathname)) {
      throw new GitHubConnectorError("malformed_response", "GitHub pagination left the configured API boundary");
    }
    return `${next.pathname}${next.search}`;
  }
  return null;
}

function githubHttpError(status, headers) {
  if ([301, 302, 307, 308].includes(status)) return new GitHubConnectorError("repository_moved", "GitHub reports that the repository moved; update the project policy and rearm the monitor");
  if (status === 401) return new GitHubConnectorError("authentication", "GitHub authentication failed");
  if (status === 404) return new GitHubConnectorError("not_found", "GitHub pull request or repository was not found");
  if (status === 410) return new GitHubConnectorError("repository_deleted", "GitHub reports that the repository or pull request was deleted");
  if (status === 451) return new GitHubConnectorError("repository_unavailable", "GitHub reports that the repository is unavailable");
  if (status === 429) return new GitHubConnectorError("rate_limited", "GitHub rate limit was reached");
  if (status === 403) {
    const remaining = headers?.get?.("x-ratelimit-remaining");
    return new GitHubConnectorError(remaining === "0" ? "rate_limited" : "permission", remaining === "0" ? "GitHub rate limit was reached" : "GitHub permission was denied");
  }
  if (status >= 500) return new GitHubConnectorError("provider_unavailable", "GitHub is temporarily unavailable");
  return new GitHubConnectorError("provider_error", `GitHub request failed with status ${status}`);
}

function encodeRepository(repository) {
  return repository.split("/").map(encodeURIComponent).join("/");
}

function required(value, name) {
  if (typeof value !== "string" || !value) throw new GitHubConnectorError("malformed_response", `GitHub ${name} is missing`);
  return value;
}
