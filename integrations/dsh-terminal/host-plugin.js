import { RelayTerminalProviderRegistry } from "./provider-registry.js";
import { RelayTerminalGateway } from "./terminal-gateway.js";

export const name = "relay-dsh-plugin-terminal";
export const inject = ["agents", "typert"];

export async function apply(ctx) {
  const resolveAgent = async (sessionId) => {
    const lookup = ctx.typert.lookups.get("agent");
    if (!lookup) throw new Error("Terminal requires DSH's configured shared Agent lookup");
    const agent = await lookup.resolve(sessionId);
    if (!agent) throw new Error(`session ${sessionId} was not found`);
    return agent;
  };
  const registry = new RelayTerminalProviderRegistry(ctx);
  const fiber = ctx.plugin({ name: "relay terminal remote", apply(scope) {
    new RelayTerminalGateway(scope, { providers: registry, resolveAgent });
  } });
  ctx.effect(() => () => fiber.dispose(), "relay terminal remote");
  await fiber;
}
