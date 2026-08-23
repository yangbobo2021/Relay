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
  "packages/event-runtime-plugin",
];
const sourceExtensions = new Set([".js", ".mjs", ".ts", ".tsx"]);
const allowedByDomain = new Map([
  ["integrations/codex", new Set(["@relay/plugin-sdk"])],
  ["integrations/claude", new Set(["@relay/plugin-sdk"])],
  ["packages/event-runtime-plugin", new Set([
    "@relay/monitor-runtime", "@relay/plugin-sdk", "@relay/runtime",
  ])],
  ["integrations/deepseek-harness", new Set(["@relay/plugin-sdk"])],
]);
const distributionPackages = new Set([
  "@relay/plugin-claude", "@relay/plugin-codex", "@relay/plugin-event-runtime",
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
        if (fileRelative === "integrations/deepseek-harness/distribution.mjs") {
          for (const packageName of distributionPackages) allowed.add(packageName);
        }
        if (specifier.startsWith("@relay/") && !allowed.has(specifier)) {
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

function inside(path, directory) {
  const offset = relative(directory, path);
  return offset === "" || (!offset.startsWith(`..${sep}`) && offset !== "..");
}
