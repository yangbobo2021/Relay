import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const plugins = ["codex", "claude", "dsh-workbench", "dsh-files", "dsh-terminal"];

test("plugin repositories expose complete public-project metadata", async () => {
  for (const plugin of plugins) {
    const directory = join(root, "integrations", plugin);
    const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
    const readme = await readFile(join(directory, "README.md"), "utf8");
    const chinese = await readFile(join(directory, "README.zh.md"), "utf8");
    const license = await readFile(join(directory, "LICENSE"), "utf8");

    assert.equal(manifest.license, "MIT", `${plugin} must declare its npm license`);
    assert.match(license, /^MIT License\n/, `${plugin} must ship the MIT license text`);
    for (const marker of ["img.shields.io/npm/v/", "actions/workflows/ci.yml/badge.svg",
      "img.shields.io/npm/dm/", "img.shields.io/github/stars/",
      "img.shields.io/github/license/", "img.shields.io/badge/DSH-0.1.1--rc.2",
      "npm_provenance", "npm_trusted_publishing"]) {
      if (marker.startsWith("npm_")) {
        assert.ok(readme.includes("npm_provenance") || readme.includes("npm_trusted_publishing"), `${plugin} must describe release provenance`);
      } else {
        assert.match(readme, new RegExp(escapeRegExp(marker)), `${plugin} README is missing ${marker}`);
      }
    }
    assert.match(readme, /All Relay DSH plugins/, `${plugin} must link to the Relay plugin catalog`);
    assert.match(chinese, /全部 Relay DSH 插件/, `${plugin} Chinese README must link to the catalog`);
  }
});

test("the bilingual catalog, article, and demo stay mutually linked", async () => {
  const english = await readFile(join(root, "docs", "dsh-plugins.md"), "utf8");
  const chinese = await readFile(join(root, "docs", "dsh-plugins.zh.md"), "utf8");
  const article = await readFile(join(root, "docs", "articles", "no-fork-dsh-plugins.md"), "utf8");
  const chineseArticle = await readFile(join(root, "docs", "articles", "no-fork-dsh-plugins.zh.md"), "utf8");

  for (const name of ["relay-dsh-plugin-codex", "relay-dsh-plugin-claude",
    "relay-dsh-plugin-workbench", "relay-dsh-plugin-files", "relay-dsh-plugin-terminal"]) {
    assert.match(english, new RegExp(name), `English catalog must list ${name}`);
    assert.match(chinese, new RegExp(name), `Chinese catalog must list ${name}`);
  }
  assert.match(english, /no-fork-dsh-plugins\.md/);
  assert.match(chinese, /no-fork-dsh-plugins\.zh\.md/);
  assert.match(article, /no-fork-dsh-plugins\.zh\.md/);
  assert.match(chineseArticle, /no-fork-dsh-plugins\.md/);
  assert.match(english, /actual npm installation|real run/i);
  assert.match(chinese, /真实 npm 安装|从 npm/);
  assert.doesNotMatch(english, /without sending a model request/i);
  assert.doesNotMatch(chinese, /不会发送模型请求/);

  const demo = join(root, "docs", "media", "dsh-plugin-suite-demo.gif");
  const video = join(root, "docs", "media", "dsh-plugin-suite-demo.mp4");
  const screenshot = join(root, "docs", "media", "dsh-plugin-suite-live.png");
  const evidence = join(root, "docs", "acceptance", "dsh-plugin-demo-qa.md");
  await access(demo);
  await access(video);
  await access(screenshot);
  await access(evidence);
  assert.ok((await stat(demo)).size > 100_000, "demo GIF must contain a real rendered tour");
  assert.ok((await stat(video)).size > 100_000, "demo MP4 must contain a real rendered tour");
  assert.ok((await stat(screenshot)).size > 100_000, "live screenshot must show the installed plugins");

  const mp4 = await readFile(video);
  const mp4Atoms = mp4.toString("latin1");
  assert.ok(mp4Atoms.includes("avc1"), "demo MP4 must use browser-compatible H.264 video");
  assert.ok(mp4Atoms.indexOf("moov") > 0 && mp4Atoms.indexOf("moov") < mp4Atoms.indexOf("mdat"),
    "demo MP4 must place moov before mdat for fast-start playback");
  const gifHeader = (await readFile(demo)).subarray(0, 6).toString("ascii");
  assert.ok(gifHeader === "GIF87a" || gifHeader === "GIF89a", "demo GIF must have a valid GIF header");
});

test("the demo pipeline records live plugin behavior instead of image slides", async () => {
  const recorder = await readFile(join(root, "scripts", "record-dsh-plugin-demo.mjs"), "utf8");
  const renderer = await readFile(join(root, "scripts", "render-dsh-plugin-demo.sh"), "utf8");

  for (const marker of ["Codex App Server is live inside DSH", "Claude Code is live inside DSH",
    "File content README.md", "RELAY_DSH_PLUGINS_ARE_LIVE"]) {
    assert.match(recorder, new RegExp(escapeRegExp(marker)));
  }
  assert.match(recorder, /recordVideo/);
  assert.match(renderer, /libx264/);
  assert.match(renderer, /yuv420p/);
  assert.match(renderer, /\+faststart/);
  assert.doesNotMatch(renderer, /dsh-new-session-backends\.jpg/);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
