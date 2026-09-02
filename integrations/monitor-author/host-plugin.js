import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { BUNDLED_SKILL_RANK } from "@deepseek-ai/dsh-skill";

const PROVIDER_NAME = "relay-monitor-author";
const SKILL_BODY_URL = new URL("./assets/relay-monitor-author.md", import.meta.url);
const RESOURCE_BASE = {
  kind: "directory",
  path: fileURLToPath(new URL("./assets/", import.meta.url)),
};
const INVOCATION = { modelInvocable: true, userInvocable: true };
const DESCRIPTION = "Create a safe Relay Monitor in this DSH Session from the live Bundle catalog, or author a capability-limited custom Bundle when no plugin type matches. / 在当前 DSH 会话中从实时目录安全创建 Relay Monitor；没有匹配插件类型时，创建受限的自定义 Bundle。";
const CANDIDATE = Object.freeze({
  name: "relay-monitor-author",
  description: DESCRIPTION,
  invocation: INVOCATION,
  provider: PROVIDER_NAME,
  source: "bundled",
  resourceBase: RESOURCE_BASE,
  rank: BUNDLED_SKILL_RANK,
  locator: SKILL_BODY_URL,
});

export const name = "relay-dsh-plugin-monitor-author";
export const inject = ["skills"];

export function createMonitorAuthorSkillProvider() {
  return {
    name: PROVIDER_NAME,
    list: async () => [CANDIDATE],
    async get(candidate) {
      if (candidate?.name !== CANDIDATE.name || candidate?.provider !== PROVIDER_NAME) return undefined;
      return {
        name: CANDIDATE.name,
        description: CANDIDATE.description,
        invocation: CANDIDATE.invocation,
        provider: CANDIDATE.provider,
        source: CANDIDATE.source,
        resourceBase: CANDIDATE.resourceBase,
        content: await readFile(SKILL_BODY_URL, "utf8"),
      };
    },
  };
}

export function apply(ctx) {
  ctx.skills.registerProvider(() => createMonitorAuthorSkillProvider());
}
