import assert from "node:assert/strict";
import test from "node:test";

import {
  ADVANCED_DEBUG_STORAGE_KEY,
  AdvancedDebugPreference,
} from "../advanced-debug-preference.mjs";

test("advanced debugging defaults off and persists explicit changes", () => {
  const storage = new MemoryStorage();
  const preference = new AdvancedDebugPreference({ storage, eventTarget: null });
  const snapshots = [];
  const unsubscribe = preference.subscribe(() => snapshots.push(preference.getSnapshot()));

  assert.equal(preference.getSnapshot(), false);
  preference.set(true);
  preference.set(true);
  preference.set(false);

  assert.deepEqual(snapshots, [true, false]);
  assert.equal(storage.getItem(ADVANCED_DEBUG_STORAGE_KEY), "false");
  unsubscribe();
  preference.dispose();
});

test("advanced debugging restores only an exact true value", () => {
  const enabled = new MemoryStorage([[ADVANCED_DEBUG_STORAGE_KEY, "true"]]);
  const malformed = new MemoryStorage([[ADVANCED_DEBUG_STORAGE_KEY, "yes"]]);
  assert.equal(new AdvancedDebugPreference({ storage: enabled, eventTarget: null }).getSnapshot(), true);
  assert.equal(new AdvancedDebugPreference({ storage: malformed, eventTarget: null }).getSnapshot(), false);
});

test("advanced debugging follows changes from another browser tab", () => {
  const storage = new MemoryStorage();
  const events = new MemoryEventTarget();
  const preference = new AdvancedDebugPreference({ storage, eventTarget: events });
  let notifications = 0;
  preference.subscribe(() => { notifications += 1; });

  storage.setItem(ADVANCED_DEBUG_STORAGE_KEY, "true");
  events.dispatch({ key: ADVANCED_DEBUG_STORAGE_KEY });
  assert.equal(preference.getSnapshot(), true);
  assert.equal(notifications, 1);

  preference.dispose();
  storage.setItem(ADVANCED_DEBUG_STORAGE_KEY, "false");
  events.dispatch({ key: ADVANCED_DEBUG_STORAGE_KEY });
  assert.equal(preference.getSnapshot(), true);
});

test("advanced debugging remains usable when browser storage is unavailable", () => {
  const preference = new AdvancedDebugPreference({
    storage: {
      getItem() { throw new Error("storage denied"); },
      setItem() { throw new Error("storage denied"); },
    },
    eventTarget: null,
  });
  let notifications = 0;
  preference.subscribe(() => { notifications += 1; });

  assert.equal(preference.getSnapshot(), false);
  assert.doesNotThrow(() => { preference.set(true); });
  assert.equal(preference.getSnapshot(), true);
  assert.equal(notifications, 1);
  preference.dispose();
});

class MemoryStorage {
  constructor(entries = []) { this.values = new Map(entries); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

class MemoryEventTarget {
  constructor() { this.listeners = new Set(); }
  addEventListener(type, listener) { if (type === "storage") this.listeners.add(listener); }
  removeEventListener(type, listener) { if (type === "storage") this.listeners.delete(listener); }
  dispatch(event) { for (const listener of this.listeners) listener(event); }
}
