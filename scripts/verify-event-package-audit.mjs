#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packages = ["events", "monitors", "semantic-router", "github", "email"];
const temporary = await mkdtemp(join(tmpdir(), "relay-package-audit-"));
const reports = [];

try {
  for (const directory of packages) reports.push(await auditPackage(join(root, "integrations", directory)));
  console.log(JSON.stringify({ schema_version: 1, passed: true, packages: reports }, null, 2));
} finally {
  await rm(temporary, { recursive: true, force: true });
}

async function auditPackage(packageRoot) {
  const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  for (const name of ["preinstall", "install", "postinstall"]) {
    assert.equal(manifest.scripts?.[name], undefined, `${manifest.name} must not mutate the host during install`);
  }
  const output = JSON.parse(execFileSync("npm", [
    "pack", "--ignore-scripts", "--json", "--pack-destination", temporary,
  ], { cwd: packageRoot, encoding: "utf8", env: { ...process.env, LANG: "C", LC_ALL: "C" } }));
  assert.equal(output.length, 1);
  const packed = output[0];
  const tarball = join(temporary, packed.filename);
  const entries = execFileSync("tar", ["-tzf", tarball], {
    encoding: "utf8", env: { ...process.env, LANG: "C", LC_ALL: "C" },
  }).trim().split("\n");
  assert.ok(entries.length > 0);
  const forbiddenPath = /(?:^|\/)(?:\.env(?:\.|$)|node_modules(?:\/|$)|(?:[^/]+\.)?(?:sqlite(?:3)?|db|log)(?:-(?:wal|shm))?$)/iu;
  for (const entry of entries) assert.doesNotMatch(entry, forbiddenPath, `${manifest.name} contains forbidden runtime/private file ${entry}`);

  execFileSync("tar", ["-xzf", tarball, "-C", temporary], {
    env: { ...process.env, LANG: "C", LC_ALL: "C" },
  });
  // npm tarballs always extract as package/. Move-by-copy is unnecessary: audit it
  // before the next tarball overwrites only names shared by the same public package.
  const packageDir = join(temporary, "package");
  const files = await walk(packageDir);
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...(manifest.dsh?.client?.inject ?? []),
  ]);
  for (const file of files) {
    const relative = file.slice(packageDir.length + 1);
    if (!/\.(?:js|mjs|cjs|json|map|md|yml|yaml)$/iu.test(relative)) continue;
    const content = await readFile(file, "utf8");
    assert.doesNotMatch(content, /\/(?:Users|home)\/[A-Za-z0-9._-]+\//u,
      `${manifest.name} leaks a private absolute source path in ${relative}`);
    assert.doesNotMatch(content, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}/u,
      `${manifest.name} contains credential-shaped content in ${relative}`);
    if (!/\.(?:js|mjs|cjs)$/iu.test(relative)) continue;
    for (const specifier of externalSpecifiers(content)) {
      const dependency = dependencyName(specifier);
      assert.ok(declared.has(dependency), `${manifest.name} has undeclared runtime import ${specifier} in ${relative}`);
    }
  }
  await rm(packageDir, { recursive: true, force: true });
  return {
    name: manifest.name,
    version: manifest.version,
    filename: basename(tarball),
    integrity: packed.integrity,
    files: entries.length,
    install_scripts: false,
    private_artifacts: false,
    undeclared_runtime_imports: false,
  };
}

function externalSpecifiers(content) {
  const found = new Set();
  const specifier = "([A-Za-z0-9@_./:-]+)";
  const patterns = [
    new RegExp(`\\bfrom\\s*["']${specifier}["']`, "gu"),
    new RegExp(`\\bimport\\s*\\(\\s*["']${specifier}["']\\s*\\)`, "gu"),
    new RegExp(`\\brequire\\s*\\(\\s*["']${specifier}["']\\s*\\)`, "gu"),
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      if (!match[1].startsWith(".") && !match[1].startsWith("/") && !match[1].startsWith("node:")) found.add(match[1]);
    }
  }
  return found;
}

function dependencyName(specifier) {
  if (!specifier.startsWith("@")) return specifier.split("/", 1)[0];
  return specifier.split("/").slice(0, 2).join("/");
}

async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path));
    else if (entry.isFile()) result.push(path);
    else assert.fail(`packed artifact contains a non-regular entry: ${path}`);
  }
  return result;
}
