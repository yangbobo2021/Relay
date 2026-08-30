// The neutral import hub is infrastructure, not Relay event/runtime ownership.
export function forbiddenBackendDependencies(dependencies = {}) {
  return Object.keys(dependencies).filter(name =>
    (name.startsWith("@relay/") || name.startsWith("relay-dsh-plugin-"))
      && name !== "relay-dsh-plugin-session-import");
}
