import { ensureDshCore } from "./runtime.js";

export { acquireDshCore, DSH_CORE_VERSION, inspectDshCore } from "./lifecycle.mjs";
export { ensureDshCore } from "./runtime.js";

export const name = "relay-dsh-core";
export const inject = ["agents", "sessions", "sessionPersistence", "tools", "typert", "webServer"];

export async function apply(ctx, config = {}) {
  const ownership = await ensureDshCore(ctx, config);
  ctx.effect(() => ownership.release, "relay.dshCore()");
}
