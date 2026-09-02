import { join } from "node:path";
import { homedir } from "node:os";

import { GmailConnector, registerGmailPush } from "./src/connector.mjs";
import { EmailCursorStore } from "./src/cursor-store.mjs";
import { GmailApiClient } from "./src/gmail-api.mjs";
import { GmailPubSubOidcVerifier } from "./src/pubsub-oidc.mjs";
import { credentialRef } from "@deepseek-ai/dsh-credentials";

export const name = "relay-dsh-plugin-email";
export const inject = ["webServer", "credentials"];

const GMAIL_TOKEN = credentialRef("RELAY_GMAIL_TOKEN");
const GMAIL_PUSH_TOKEN = credentialRef("RELAY_GMAIL_PUSH_TOKEN");

export function apply(ctx, config = {}) {
  const pushOidcAudience = config.pushOidcAudience ?? process.env.RELAY_GMAIL_PUSH_AUDIENCE ?? null;
  const pushOidcServiceAccount = config.pushOidcServiceAccount ?? process.env.RELAY_GMAIL_PUSH_SERVICE_ACCOUNT ?? null;
  if (Boolean(pushOidcAudience) !== Boolean(pushOidcServiceAccount)) {
    throw new Error("Gmail Pub/Sub OIDC requires both audience and service account");
  }
  const pushOidc = pushOidcAudience ? new GmailPubSubOidcVerifier({
    audience: pushOidcAudience,
    serviceAccount: pushOidcServiceAccount,
    fetchImpl: config.pushOidcFetch,
    jwksUrl: config.pushOidcJwksUrl,
  }) : null;
  const fiber = ctx.inject(["relayEvents"], scope => {
    const store = new EmailCursorStore(config.databasePath ?? process.env.RELAY_EMAIL_DATABASE_PATH ?? join(homedir(), ".relay", "email.sqlite"));
    const source = scope.relayEvents.registerBoundEventSource({ id: "relay.gmail", sources: ["gmail"] });
    const connector = new GmailConnector({
      relayEvents: scope.relayEvents,
      boundSource: source,
      cursorStore: store,
      client: new GmailApiClient({ getToken: async () => config.apiToken ?? (await scope.credentials.resolve(GMAIL_TOKEN))?.value ?? null, baseUrl: config.apiBaseUrl }),
    });
    scope.effect(() => registerGmailPush(scope, {
      connector,
      verifyPush: pushOidc ? request => pushOidc.verify(request) : undefined,
      pushToken: async () => config.pushToken ?? (await scope.credentials.resolve(GMAIL_PUSH_TOKEN))?.value ?? null,
      pushPath: config.pushPath,
      maxBodyBytes: config.maxBodyBytes,
    }), "relay Gmail push");
    const management = scope.relayEvents.registerConnectorProvider({
      id: "relay.gmail",
      async inspect() {
        const [api, push] = await Promise.all([scope.credentials.describe(GMAIL_TOKEN), scope.credentials.describe(GMAIL_PUSH_TOKEN)]);
        const accounts = store.list().map(({ cursor: _cursor, ...account }) => account);
        const apiConfigured = api.configured || Boolean(config.apiToken);
        const pushConfigured = push.configured || Boolean(config.pushToken) || Boolean(pushOidc);
        return {
          kind: "email",
          state: accounts.some(account => account.status === "degraded") ? "degraded"
            : accounts.length > 0 ? "healthy" : apiConfigured && pushConfigured ? "healthy" : "unconfigured",
          api_configured: apiConfigured,
          push_configured: pushConfigured,
          push_authentication: pushOidc ? "google_oidc" : "shared_token",
          credentials_writable: !config.apiToken && !config.pushToken && !pushOidc && api.writable && push.writable,
          accounts,
        };
      },
      async execute(action, input) {
        if (action === "configure_credentials") {
          const apiToken = input?.api_token;
          const pushToken = input?.push_token;
          if (typeof apiToken !== "string" || apiToken.length < 16 || apiToken.length > 8192
            || typeof pushToken !== "string" || pushToken.length < 16 || pushToken.length > 4096) {
            throw new Error("Gmail API and push credentials must each contain at least 16 characters");
          }
          const [apiInfo, pushInfo] = await Promise.all([
            scope.credentials.describe(GMAIL_TOKEN), scope.credentials.describe(GMAIL_PUSH_TOKEN),
          ]);
          if (!apiInfo.writable || !pushInfo.writable || config.apiToken || config.pushToken || pushOidc) {
            throw new Error("Gmail credentials are controlled by a read-only configuration source");
          }
          await scope.credentials.set(GMAIL_TOKEN, apiToken);
          try { await scope.credentials.set(GMAIL_PUSH_TOKEN, pushToken); }
          catch (error) {
            await scope.credentials.unset(GMAIL_TOKEN);
            throw error;
          }
          return;
        }
        if (action === "revoke_credentials") {
          const [apiInfo, pushInfo] = await Promise.all([
            scope.credentials.describe(GMAIL_TOKEN), scope.credentials.describe(GMAIL_PUSH_TOKEN),
          ]);
          if (!apiInfo.writable || !pushInfo.writable || config.apiToken || config.pushToken || pushOidc) {
            throw new Error("Gmail credentials are controlled by a read-only configuration source");
          }
          await scope.credentials.unset(GMAIL_TOKEN);
          await scope.credentials.unset(GMAIL_PUSH_TOKEN);
          return;
        }
        if (action === "pause") { store.pause(input?.account); return; }
        if (action === "resume") { store.resume(input?.account); return; }
        if (action === "disconnect") { store.disconnect(input?.account); return; }
        throw new Error(`unsupported Gmail connector action ${action}`);
      },
    });
    scope.effect(() => () => { management(); source.dispose(); store.close(); }, "relay Gmail connector");
  });
  ctx.effect(() => () => fiber.dispose(), "relay Gmail injection");
}
