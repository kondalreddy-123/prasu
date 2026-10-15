export const DEMO_STATE_KEY = 'healthpass-local-demo-state-v1';
const DEMO_STATE_VERSION = 1;

const clone = (value) => JSON.parse(JSON.stringify(value));

function isStateCompatible(candidate, defaults) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
  const keys = Object.keys(defaults);
  return keys.every((key) => {
    const value = candidate[key];
    return Array.isArray(defaults[key])
      ? Array.isArray(value)
      : defaults[key] && typeof defaults[key] === 'object'
        ? Boolean(value && typeof value === 'object' && !Array.isArray(value))
        : typeof value === typeof defaults[key];
  });
}

export function loadDemoState(defaults, storage, key = DEMO_STATE_KEY) {
  if (!storage) return { state: clone(defaults), status: 'unavailable', writable: false };
  let raw;
  try { raw = storage.getItem(key); } catch { return { state: clone(defaults), status: 'unavailable', writable: false }; }
  if (raw == null) return { state: clone(defaults), status: 'empty', writable: true };
  try {
    const saved = JSON.parse(raw);
    if (saved?.version !== DEMO_STATE_VERSION || !isStateCompatible(saved.state, defaults)) {
      return { state: clone(defaults), status: 'invalid', writable: false };
    }
    return { state: { ...clone(defaults), ...saved.state }, status: 'loaded', writable: true };
  } catch {
    return { state: clone(defaults), status: 'corrupt', writable: false };
  }
}

export function saveDemoState(state, storage, key = DEMO_STATE_KEY) {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify({ version: DEMO_STATE_VERSION, state }));
    return true;
  } catch {
    return false;
  }
}

export function clearDemoState(defaults, storage, key = DEMO_STATE_KEY) {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify({ version: DEMO_STATE_VERSION, state: defaults }));
    return true;
  } catch {
    return false;
  }
}
