import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { GitHubApiClient } from "../src/github-api.mjs";
import { createGitHubPullRequestObserver } from "../src/observer.mjs";

test("EP05-001/011: packed-compatible observer crosses a GitHub API HTTP boundary", async t => {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({ url: request.url, authorization: request.headers.authorization, accept: request.headers.accept });
    response.setHeader("content-type", "application/json");
    if (request.url === "/repos/octo/relay/pulls/42") {
      response.end(JSON.stringify({ state: "open", merged: false, draft: false, mergeable: true, head: { sha: "sha-http" } }));
      return;
    }
    if (request.url === "/repos/octo/relay/commits/sha-http/check-runs?per_page=100") {
      response.end(JSON.stringify({ check_runs: [{ id: 9, name: "release", status: "completed", conclusion: "success" }] }));
      return;
    }
    if (request.url === "/repos/octo/relay/pulls/42/reviews?per_page=100") {
      response.end(JSON.stringify([{ user: { login: "reviewer" }, state: "APPROVED", submitted_at: "2026-01-01T00:00:00Z", commit_id: "sha-http" }]));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ message: "not found" }));
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const token = "SANITIZED-CONTROLLED-TOKEN";
  const observer = createGitHubPullRequestObserver({ client: new GitHubApiClient({
    token, baseUrl: `http://127.0.0.1:${address.port}`,
  }) });
  const observation = await observer.observe({
    monitor: { artifact: { repository: "octo/relay", pull_number: 42 } }, previous: null,
  });
  assert.equal(observation.head_sha, "sha-http");
  assert.equal(observation.checks[0].conclusion, "success");
  assert.equal(observation.review_decision, "approved");
  assert.equal(requests.length, 3);
  assert.ok(requests.every(request => request.authorization === `Bearer ${token}`));
  assert.ok(requests.every(request => request.accept === "application/vnd.github+json"));
  assert.ok(!JSON.stringify(observation).includes(token));
});

test("EP05-001/EP11-004: GitHub API pagination is complete, bounded, and cannot leave the configured origin", async t => {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push(request.url);
    response.setHeader("content-type", "application/json");
    const origin = `http://127.0.0.1:${server.address().port}`;
    if (request.url === "/repos/octo/relay/pulls/42") {
      response.end(JSON.stringify({ state: "open", merged: false, draft: false, mergeable: true, head: { sha: "sha-page" } }));
      return;
    }
    if (request.url === "/repos/octo/relay/commits/sha-page/check-runs?per_page=100") {
      response.setHeader("link", `<${origin}/repos/octo/relay/commits/sha-page/check-runs?per_page=100&page=2>; rel="next"`);
      response.end(JSON.stringify({ check_runs: [{ id: 1, name: "build", status: "completed", conclusion: "success" }] }));
      return;
    }
    if (request.url === "/repos/octo/relay/commits/sha-page/check-runs?per_page=100&page=2") {
      response.end(JSON.stringify({ check_runs: [{ id: 2, name: "release", status: "completed", conclusion: "success" }] }));
      return;
    }
    if (request.url === "/repos/octo/relay/pulls/42/reviews?per_page=100") {
      response.setHeader("link", `</repos/octo/relay/pulls/42/reviews?per_page=100&page=2>; rel="next"`);
      response.end(JSON.stringify([{ user: { login: "a" }, state: "APPROVED", commit_id: "sha-page" }]));
      return;
    }
    if (request.url === "/repos/octo/relay/pulls/42/reviews?per_page=100&page=2") {
      response.end(JSON.stringify([{ user: { login: "b" }, state: "APPROVED", commit_id: "sha-page" }]));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ message: "not found" }));
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const client = new GitHubApiClient({ baseUrl: `http://127.0.0.1:${address.port}` });
  const result = await client.getPullRequestSnapshot({ repository: "octo/relay", pull_number: 42 });
  assert.deepEqual(result.checks.map(check => check.id), ["1", "2"]);
  assert.deepEqual(result.reviews.map(review => review.actor), ["a", "b"]);
  assert.equal(requests.length, 5);

  await assert.rejects(
    client.getPaginated("/repos/octo/relay/pulls/42/reviews?per_page=100", { maxPages: 1 }),
    error => error?.errorClass === "response_too_large",
  );
  const hostile = createServer((_request, response) => {
    response.setHeader("content-type", "application/json");
    response.setHeader("link", '<https://attacker.invalid/steal>; rel="next"');
    response.end("[]");
  });
  await new Promise((resolve, reject) => { hostile.once("error", reject); hostile.listen(0, "127.0.0.1", resolve); });
  t.after(() => new Promise(resolve => hostile.close(resolve)));
  const hostileAddress = hostile.address();
  assert.ok(hostileAddress && typeof hostileAddress === "object");
  const isolated = new GitHubApiClient({ token: "must-not-leak", baseUrl: `http://127.0.0.1:${hostileAddress.port}` });
  await assert.rejects(isolated.getPaginated("/first"), error => error?.errorClass === "malformed_response");
});
