export const ADVANCED_DEBUG_STORAGE_KEY = "relay.ui.advanced-debug";

export class AdvancedDebugPreference {
  constructor({ storage = availableStorage(), eventTarget = availableEventTarget() } = {}) {
    this.storage = storage;
    this.eventTarget = eventTarget;
    this.listeners = new Set();
    this.value = readPreference(storage);
    this.onStorage = (event) => {
      if (event?.key !== ADVANCED_DEBUG_STORAGE_KEY) return;
      this.update(readPreference(this.storage), false);
    };
    this.eventTarget?.addEventListener?.("storage", this.onStorage);
  }

  getSnapshot = () => this.value;

  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  set(enabled) {
    this.update(Boolean(enabled), true);
  }

  dispose() {
    this.eventTarget?.removeEventListener?.("storage", this.onStorage);
    this.listeners.clear();
  }

  update(next, persist) {
    if (persist) writePreference(this.storage, next);
    if (next === this.value) return;
    this.value = next;
    for (const listener of this.listeners) listener();
  }
}

function readPreference(storage) {
  try {
    return storage?.getItem?.(ADVANCED_DEBUG_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writePreference(storage, enabled) {
  try {
    storage?.setItem?.(ADVANCED_DEBUG_STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // Browser privacy modes may reject storage; the in-memory preference still works.
  }
}

function availableStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function availableEventTarget() {
  return globalThis.window;
}
