import { createHash } from "node:crypto";
import { isAbsolute, relative, resolve } from "node:path";

import { GitHubConnectorError } from "./contracts.mjs";
import { parsePullRequestTarget } from "./normalize.mjs";

export function normalizeProjectPolicies(input) {
  if (input == null) return [];
  if (!Array.isArray(input)) throw new GitHubConnectorError("invalid_project_policy", "GitHub project policies must be an array");
  const ids = new Set();
  return input.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new GitHubConnectorError("invalid_project_policy", `GitHub project policy ${index + 1} is invalid`);
    }
    if (typeof entry.root !== "string" || !isAbsolute(entry.root)) {
      throw new GitHubConnectorError("invalid_project_policy", `GitHub project policy ${index + 1} requires an absolute root`);
    }
    if (!Array.isArray(entry.repositories) || entry.repositories.length === 0) {
      throw new GitHubConnectorError("invalid_project_policy", `GitHub project policy ${index + 1} requires repositories`);
    }
    if (typeof entry.credential !== "string" || !/^[A-Z][A-Z0-9_]{2,127}$/u.test(entry.credential)) {
      throw new GitHubConnectorError("invalid_project_policy", `GitHub project policy ${index + 1} requires a credential handle`);
    }
    const root = resolve(entry.root);
    const repositories = [...new Set(entry.repositories.map(repository => parsePullRequestTarget(`${repository}#1`).repository))];
    const id = typeof entry.id === "string" && /^[a-zA-Z0-9._-]{1,64}$/u.test(entry.id)
      ? entry.id
      : `project-${createHash("sha256").update(root).digest("hex").slice(0, 16)}`;
    if (ids.has(id)) throw new GitHubConnectorError("invalid_project_policy", `duplicate GitHub project policy ${id}`);
    ids.add(id);
    return Object.freeze({ id, root, repositories: Object.freeze(repositories), credential: entry.credential,
      ...(entry.apiBaseUrl ? { apiBaseUrl: entry.apiBaseUrl } : {}) });
  });
}

export function resolveProjectPolicy(policies, cwd) {
  if (typeof cwd !== "string" || !isAbsolute(cwd)) return null;
  const candidate = resolve(cwd);
  const matches = policies.filter(policy => contains(policy.root, candidate)).sort((a, b) => b.root.length - a.root.length);
  return matches[0] ?? null;
}

export function authorizeProjectRepository(policy, pullRequest) {
  if (!policy) throw new GitHubConnectorError("project_not_configured", "This project is not configured for GitHub PR monitoring", 403);
  const target = parsePullRequestTarget(pullRequest);
  if (!policy.repositories.includes(target.repository)) {
    throw new GitHubConnectorError("repository_not_allowed", "The GitHub repository is outside this project's configured policy", 403);
  }
  return target;
}

function contains(root, candidate) {
  const suffix = relative(root, candidate);
  return suffix === "" || (!suffix.startsWith("..") && !isAbsolute(suffix));
}
