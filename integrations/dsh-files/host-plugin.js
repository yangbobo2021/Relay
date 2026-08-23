import { RelayWorkspaceFilesGateway } from "./workspace-files-gateway.js";

export const name = "relay-dsh-plugin-files";
export const inject = ["agents", "fs", "typert"];

export async function apply(ctx) {
  const resolveAgent = async (sessionId) => {
    const lookup = ctx.typert.lookups.get("agent");
    if (!lookup) throw new Error("Files requires DSH's configured shared Agent lookup");
    const agent = await lookup.resolve(sessionId);
    if (!agent) throw new Error(`session ${sessionId} was not found`);
    return agent;
  };
  const fiber = ctx.plugin({ name: "relay workspace files remote", apply(scope) {
    new RelayWorkspaceFilesGateway(scope, { resolveAgent });
  } });
  ctx.effect(() => () => fiber.dispose(), "relay files remote");
  await fiber;
}
