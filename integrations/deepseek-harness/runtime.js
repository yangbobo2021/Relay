import { PluginHost } from "@relay/plugin-sdk";
import { createDshCoreDistribution } from "./distribution.mjs";
import { acquireDshCore } from "./lifecycle.mjs";
export { installManagedPreset } from "./preset.js";

export async function ensureDshCore(ctx, config = {}) {
  const root = ctx.root ?? ctx;
  return acquireDshCore(root, {
    range: config.coreVersion ?? "^1.0.0",
    async activate() {
      const host = new PluginHost();
      try {
        await host.activate(createDshCoreDistribution(root, config));
      } catch (error) {
        await host.dispose();
        throw error;
      }
      return {
        value: Object.freeze({ host, capabilities: host.capabilities }),
        dispose: () => host.dispose(),
      };
    },
  });
}
