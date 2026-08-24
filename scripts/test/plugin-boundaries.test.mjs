import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const domains = [
  "integrations/codex",
  "integrations/claude",
  "integrations/deepseek-harness",
  "integrations/dsh-workbench",
  "integrations/dsh-files",
  "integrations/dsh-terminal",
  "packages/event-runtime-plugin",
];
const sourceExtensions = new Set([".js", ".mjs", ".ts", ".tsx"]);
const allowedByDomain = new Map([
  ["integrations/codex", new Set()],
  ["integrations/claude", new Set()],
  ["integrations/dsh-workbench", new Set()],
  ["integrations/dsh-files", new Set(["@relay/dsh-plugin-workbench/contracts"])],
  ["integrations/dsh-terminal", new Set(["@relay/dsh-plugin-workbench/contracts"])],
  ["packages/event-runtime-plugin", new Set([
    "@relay/monitor-runtime", "@relay/plugin-sdk", "@relay/runtime",
  ])],
  ["integrations/deepseek-harness", new Set([
    "@relay/plugin-event-runtime", "@relay/plugin-sdk",
  ])],
]);

test("production plugins cannot import another plugin's source", async () => {
  const violations = [];
  for (const domain of domains) {
    const domainRoot = join(root, domain);
    for (const file of await sourceFiles(domainRoot)) {
      const source = await readFile(file, "utf8");
      for (const specifier of importSpecifiers(source, file)) {
        const fileRelative = relative(root, file).split(sep).join("/");
        const allowed = new Set(allowedByDomain.get(domain));
        if (specifier.startsWith("@relay/") && ![...allowed].some(name => specifier === name || specifier.startsWith(`${name}/`))) {
          violations.push(`${relative(root, file).split(sep).join("/")} -> ${specifier}`);
          continue;
        }
        if (!specifier.startsWith(".")) continue;
        const target = normalize(resolve(dirname(file), specifier));
        if (inside(target, domainRoot)) continue;
        violations.push(`${fileRelative} -> ${specifier}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("boundary parser sees static, dynamic, CommonJS, and createRequire imports", () => {
  const source = [
    'import value from "@relay/static"',
    'export { value } from "@relay/exported"',
    'const dynamic = import("@relay/dynamic")',
    'const common = require("@relay/common")',
    'const scoped = localRequire("@relay/create-require")',
  ].join("\n");
  assert.deepEqual(importSpecifiers(source, "fixture.ts"), [
    "@relay/static", "@relay/exported", "@relay/dynamic", "@relay/common", "@relay/create-require",
  ]);
});

test("cross-package imports use public entrypoints rather than internal source files", async () => {
  const source = await readFile(join(root, "packages/runtime/src/runtime.mjs"), "utf8");
  assert.doesNotMatch(source, /event-router\/(src\/|decision\.mjs)/);
});

test("feature plugins use Workbench public contracts as types only", async () => {
  for (const domain of ["integrations/dsh-files", "integrations/dsh-terminal"]) {
    for (const file of await sourceFiles(join(root, domain))) {
      const source = await readFile(file, "utf8");
      if (!source.includes("@relay/dsh-plugin-workbench/contracts")) continue;
      assert.equal(hasRuntimeImport(source, file, "@relay/dsh-plugin-workbench/contracts"), false,
        `${relative(root, file)} must not create a runtime implementation dependency`);
    }
  }
});

test("conversation backends do not own workbench feature implementations", async () => {
  const codex = join(root, "integrations/codex");
  assert.equal((await sourceFiles(codex)).some(file => file.includes(`${sep}workbench${sep}`)), false);
  const patch = await readFile(join(codex, "cordis.patch.yml"), "utf8");
  assert.doesNotMatch(patch, /ui-layout|relay-(?:files|terminal|workbench)-host/);
});

test("the common workbench has no built-in feature identity", async () => {
  const workbenchRoot = join(root, "integrations/dsh-workbench/src");
  const violations = [];
  for (const file of await sourceFiles(workbenchRoot)) {
    const source = await readFile(file, "utf8");
    if (/\b(?:files|terminal|codex|claude)\b/i.test(source)) violations.push(relative(root, file));
  }
  assert.deepEqual(violations, []);
});

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "lib" || entry.name === "test" || entry.name === "tests") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (sourceExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

function importSpecifiers(source, file) {
  const specifiers = [];
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX
    : file.endsWith(".ts") ? ts.ScriptKind.TS
      : file.endsWith(".jsx") ? ts.ScriptKind.JSX
        : ts.ScriptKind.JS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.arguments.length > 0
        && ts.isStringLiteralLike(node.arguments[0])) {
      const expression = node.expression;
      const importLike = expression.kind === ts.SyntaxKind.ImportKeyword
        || ts.isIdentifier(expression)
        || (ts.isPropertyAccessExpression(expression)
          && ts.isIdentifier(expression.expression)
          && expression.expression.text === "require");
      if (importLike) specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return specifiers;
}

function hasRuntimeImport(source, file, target) {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : file.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  let found = false;
  const visit = (node) => {
    if (ts.isImportDeclaration(node)
        && ts.isStringLiteralLike(node.moduleSpecifier)
        && node.moduleSpecifier.text === target
        && node.importClause?.isTypeOnly !== true) found = true;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function inside(path, directory) {
  const offset = relative(directory, path);
  return offset === "" || (!offset.startsWith(`..${sep}`) && offset !== "..");
}
