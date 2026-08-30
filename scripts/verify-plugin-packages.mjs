// All product code now ships in DSH plugins; no private Relay runtime packs.
process.argv.push("--events-only");
await import("./verify-dsh-plugin-package.mjs");
