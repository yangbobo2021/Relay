import { appendFileSync } from "node:fs";

export const name = "relay-runtime-host-probe";

function markLifecycle(state) {
  const marker = process.env.RELAY_DSH_PROBE_MARKER;
  if (marker) {
    appendFileSync(marker, `${state}\n`, "utf8");
  }
}

export function apply(ctx) {
  ctx.effect(() => {
    markLifecycle("loaded");
    return () => markLifecycle("disposed");
  }, "relay.runtimeHostProbe()");
}
