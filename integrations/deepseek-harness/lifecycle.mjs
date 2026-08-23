import { satisfiesVersion } from "@relay/plugin-sdk";

export const DSH_CORE_VERSION = "1.0.0";

const STATE = Symbol.for("relay.dsh.core.lifecycle.v1");

export async function acquireDshCore(root, options) {
  if (root === null || (typeof root !== "object" && typeof root !== "function")) {
    throw new TypeError("Relay DSH Core requires an object identity root");
  }
  const range = options?.range ?? "^1.0.0";
  let state = root[STATE];
  if (state === undefined) {
    const pending = Promise.resolve().then(options.activate);
    state = { version: DSH_CORE_VERSION, consumers: 0, pending, instance: undefined };
    Object.defineProperty(root, STATE, { value: state, configurable: true });
    try {
      state.instance = await pending;
    } catch (error) {
      delete root[STATE];
      throw error;
    }
  } else {
    await state.pending;
  }
  if (!satisfiesVersion(state.version, range)) {
    throw new Error(`Relay DSH Core ${state.version} does not satisfy ${range}`);
  }
  state.consumers += 1;
  let released = false;
  return Object.freeze({
    value: state.instance.value,
    async release() {
      if (released) return;
      released = true;
      state.consumers -= 1;
      if (state.consumers !== 0) return;
      delete root[STATE];
      await state.instance.dispose();
    },
  });
}

export function inspectDshCore(root) {
  const state = root?.[STATE];
  return state === undefined
    ? undefined
    : Object.freeze({ version: state.version, consumers: state.consumers });
}
