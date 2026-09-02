import { createPublicKey, verify as verifySignature } from "node:crypto";

import { EmailConnectorError } from "./contracts.mjs";

const DEFAULT_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

export class GmailPubSubOidcVerifier {
  constructor({ audience, serviceAccount, fetchImpl = globalThis.fetch, jwksUrl = DEFAULT_JWKS_URL,
    clock = () => Date.now(), clockSkewSeconds = 60 } = {}) {
    if (typeof audience !== "string" || !audience.trim()) throw new TypeError("Gmail Pub/Sub OIDC audience is required");
    if (typeof serviceAccount !== "string" || !serviceAccount.includes("@")) {
      throw new TypeError("Gmail Pub/Sub OIDC service account is required");
    }
    if (typeof fetchImpl !== "function") throw new TypeError("Gmail Pub/Sub OIDC verification requires fetch()");
    this.audience = audience.trim();
    this.serviceAccount = serviceAccount.trim().toLowerCase();
    this.fetchImpl = fetchImpl;
    this.jwksUrl = jwksUrl;
    this.clock = clock;
    this.clockSkewSeconds = clockSkewSeconds;
    this.keys = new Map();
    this.keysExpireAt = 0;
  }

  async verify(request) {
    const authorization = request?.headers?.authorization;
    if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) throw unauthorized();
    const token = authorization.slice(7);
    if (token.length > 16_384) throw unauthorized();
    const parts = token.split(".");
    if (parts.length !== 3 || parts.some(part => !part)) throw unauthorized();
    const header = decodeJson(parts[0]);
    const claims = decodeJson(parts[1]);
    if (header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) throw unauthorized();
    let key = await this.key(header.kid);
    if (!key) {
      await this.refreshKeys(true);
      key = this.keys.get(header.kid);
    }
    if (!key) throw unauthorized();
    let valid = false;
    try {
      valid = verifySignature("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`),
        createPublicKey({ key, format: "jwk" }), Buffer.from(parts[2], "base64url"));
    } catch {
      throw unauthorized();
    }
    if (!valid) throw unauthorized();
    this.validateClaims(claims);
    return {
      issuer: claims.iss,
      audience: this.audience,
      service_account: this.serviceAccount,
      subject: typeof claims.sub === "string" ? claims.sub : null,
    };
  }

  validateClaims(claims) {
    const now = Math.floor(this.clock() / 1000);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!GOOGLE_ISSUERS.has(claims.iss)
      || !audiences.includes(this.audience)
      || String(claims.email ?? "").toLowerCase() !== this.serviceAccount
      || claims.email_verified !== true
      || !Number.isSafeInteger(claims.iat)
      || !Number.isSafeInteger(claims.exp)
      || claims.iat > now + this.clockSkewSeconds
      || claims.exp < now - this.clockSkewSeconds
      || claims.exp - claims.iat > 3_900) throw unauthorized();
  }

  async key(kid) {
    if (this.clock() >= this.keysExpireAt || this.keys.size === 0) await this.refreshKeys(false);
    return this.keys.get(kid);
  }

  async refreshKeys(force) {
    if (!force && this.clock() < this.keysExpireAt && this.keys.size > 0) return;
    let response;
    try {
      response = await this.fetchImpl(this.jwksUrl, { method: "GET", headers: { accept: "application/json" } });
    } catch {
      throw unavailable();
    }
    if (!response?.ok) throw unavailable();
    let body;
    try { body = await response.json(); }
    catch { throw unavailable(); }
    const keys = new Map((body?.keys ?? []).filter(key => key?.kty === "RSA" && typeof key.kid === "string")
      .map(key => [key.kid, key]));
    if (keys.size === 0) throw unavailable();
    const maxAge = /(?:^|,)\s*max-age=(\d+)/iu.exec(response.headers?.get?.("cache-control") ?? "")?.[1];
    const ttlSeconds = Math.max(60, Math.min(Number(maxAge) || 300, 3_600));
    this.keys = keys;
    this.keysExpireAt = this.clock() + ttlSeconds * 1000;
  }
}

function decodeJson(value) {
  try {
    const buffer = Buffer.from(value, "base64url");
    if (buffer.length === 0 || buffer.length > 8_192) throw new Error("bounded JWT part required");
    const decoded = JSON.parse(buffer.toString("utf8"));
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error("JWT object required");
    return decoded;
  } catch {
    throw unauthorized();
  }
}

function unauthorized() {
  return new EmailConnectorError("unauthorized", "Gmail Pub/Sub push authentication failed", 401);
}

function unavailable() {
  return new EmailConnectorError("push_verification_unavailable", "Gmail Pub/Sub identity verification is unavailable", 503);
}
