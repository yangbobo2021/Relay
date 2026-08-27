import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const plugins = ["codex", "claude", "dsh-workbench", "dsh-files", "dsh-terminal", "dsh-plugin-manager"];

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
    const catalogMarker = plugin === "dsh-plugin-manager" ? /Relay DSH plugin catalog/ : /All Relay DSH plugins/;
    const chineseCatalogMarker = plugin === "dsh-plugin-manager" ? /Relay DSH 插件目录/ : /全部 Relay DSH 插件/;
    assert.match(readme, catalogMarker, `${plugin} must link to the Relay plugin catalog`);
    assert.match(chinese, chineseCatalogMarker, `${plugin} Chinese README must link to the catalog`);
  }
});

test("the bilingual catalog, article, and demo stay mutually linked", async () => {
  const english = await readFile(join(root, "docs", "dsh-plugins.md"), "utf8");
  const chinese = await readFile(join(root, "docs", "dsh-plugins.zh.md"), "utf8");
  const article = await readFile(join(root, "docs", "articles", "no-fork-dsh-plugins.md"), "utf8");
  const chineseArticle = await readFile(join(root, "docs", "articles", "no-fork-dsh-plugins.zh.md"), "utf8");

  for (const name of ["relay-dsh-plugin-codex", "relay-dsh-plugin-claude",
    "relay-dsh-plugin-workbench", "relay-dsh-plugin-files", "relay-dsh-plugin-terminal",
    "relay-dsh-plugin-manager"]) {
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

test("the project-workbench article series stays bilingual, linked, and honest about scope", async () => {
  const articles = join(root, "docs", "articles");
  const slugs = [
    "one-project-three-agent-conversations",
    "codex-app-server-in-dsh",
    "claude-code-in-dsh",
    "dsh-project-workbench",
    "from-agent-choice-to-coordination",
  ];
  const requiredRepository = new Map([
    ["codex-app-server-in-dsh", "relay-dsh-plugin-codex"],
    ["claude-code-in-dsh", "relay-dsh-plugin-claude"],
    ["dsh-project-workbench", "relay-dsh-plugin-workbench"],
  ]);

  const englishIndex = await readFile(join(articles, "dsh-agent-workbench-series.md"), "utf8");
  const chineseIndex = await readFile(join(articles, "dsh-agent-workbench-series.zh.md"), "utf8");
  assert.match(englishIndex, /dsh-agent-workbench-series\.zh\.md/);
  assert.match(chineseIndex, /dsh-agent-workbench-series\.md/);

  for (const slug of slugs) {
    const english = await readFile(join(articles, `${slug}.md`), "utf8");
    const chinese = await readFile(join(articles, `${slug}.zh.md`), "utf8");
    assert.match(englishIndex, new RegExp(`${slug}\\.md`), `English series index must link ${slug}`);
    assert.match(chineseIndex, new RegExp(`${slug}\\.zh\\.md`), `Chinese series index must link ${slug}`);
    assert.match(english, new RegExp(`${slug}\\.zh\\.md`), `${slug} must link its Chinese edition`);
    assert.match(chinese, new RegExp(`${slug}\\.md`), `${slug} Chinese edition must link English`);
    assert.match(english, /dsh-agent-workbench-series\.md/);
    assert.match(chinese, /dsh-agent-workbench-series\.zh\.md/);

    const repository = requiredRepository.get(slug);
    if (repository !== undefined) {
      assert.match(english, new RegExp(`github\\.com/yangbobo2021/${repository}`));
      assert.match(chinese, new RegExp(`github\\.com/yangbobo2021/${repository}`));
    }
  }

  const overview = await readFile(join(articles, `${slugs[0]}.md`), "utf8");
  const chineseOverview = await readFile(join(articles, `${slugs[0]}.zh.md`), "utf8");
  for (const marker of ["DeepSeek Harness", "Codex", "Claude", "cost", "quality"]) {
    assert.match(overview, new RegExp(marker, "i"), `English overview must cover ${marker}`);
  }
  for (const marker of ["DeepSeek Harness", "Codex", "Claude", "成本", "质量"]) {
    assert.match(chineseOverview, new RegExp(marker), `Chinese overview must cover ${marker}`);
  }

  const roadmap = await readFile(join(articles, `${slugs[4]}.md`), "utf8");
  const chineseRoadmap = await readFile(join(articles, `${slugs[4]}.zh.md`), "utf8");
  assert.match(roadmap, /not implemented yet|does not yet/i);
  assert.match(chineseRoadmap, /尚未实现|还没有实现/);
});

test("the Codex import article stays reproducible, bilingual, and backed by real screenshots", async () => {
  const articles = join(root, "docs", "articles");
  const english = await readFile(join(articles, "import-existing-codex-conversations-into-dsh.md"), "utf8");
  const chinese = await readFile(join(articles, "import-existing-codex-conversations-into-dsh.zh.md"), "utf8");
  const imageNames = ["scan", "complete", "list", "history", "continue"];

  assert.match(english, /import-existing-codex-conversations-into-dsh\.zh\.md/);
  assert.match(chinese, /import-existing-codex-conversations-into-dsh\.md/);
  assert.match(english, /dsh-agent-workbench-series\.md/);
  assert.match(chinese, /dsh-agent-workbench-series\.zh\.md/);

  for (const article of [english, chinese]) {
    assert.match(article, /relay-dsh-plugin-codex@next/);
    assert.match(article, /0\.1\.1-rc\.4/);
    assert.match(article, /github\.com\/yangbobo2021\/relay-dsh-plugin-codex/);
    assert.match(article, /npmjs\.com\/package\/relay-dsh-plugin-codex/);
    assert.match(article, /github\.com\/yangbobo2021\/Relay/);
    assert.doesNotMatch(article, /\/Users\//);
  }
  assert.match(english, /whole Workspace|entire Workspace/);
  assert.match(english, /no background polling/i);
  assert.match(english, /two App Server writers/i);
  assert.match(chinese, /整个 Workspace|整批导入/);
  assert.match(chinese, /不会后台轮询/);
  assert.match(chinese, /两个 App Server 写入者/);

  for (const name of imageNames) {
    const relative = `../media/codex-import-${name}.png`;
    assert.ok(english.includes(relative), `English import article must include ${name} evidence`);
    assert.ok(chinese.includes(relative), `Chinese import article must include ${name} evidence`);
    const image = await readFile(join(root, "docs", "media", `codex-import-${name}.png`));
    assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${name} must be a PNG`);
    assert.equal(image.readUInt32BE(16), 1440, `${name} screenshot width must stay legible`);
    assert.equal(image.readUInt32BE(20), 960, `${name} screenshot height must stay legible`);
    assert.ok(image.length > 50_000, `${name} screenshot must contain real rendered UI evidence`);
  }
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
