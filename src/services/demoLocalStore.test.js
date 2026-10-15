import test from 'node:test';
import assert from 'node:assert/strict';
import { clearDemoState, DEMO_STATE_KEY, loadDemoState, saveDemoState } from './demoLocalStore.js';

function storageStub(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

const defaults = { grants: [], reports: [], profiles: {} };

test('initializes absent local data from fictional defaults without mutation', () => {
  const storage = storageStub();
  const result = loadDemoState(defaults, storage);
  assert.equal(result.status, 'empty');
  assert.deepEqual(result.state, defaults);
  assert.equal(storage.getItem(DEMO_STATE_KEY), null);
});

test('persists and reloads created records across app reloads', () => {
  const storage = storageStub();
  const changed = { ...defaults, grants: [{ id: 'request-1', patientId: 'patient-1' }] };
  assert.equal(saveDemoState(changed, storage), true);
  const loaded = loadDemoState(defaults, storage);
  assert.equal(loaded.status, 'loaded');
  assert.deepEqual(loaded.state, changed);
});

test('corrupt or incompatible data fails safely without overwriting saved bytes', () => {
  const original = '{bad json';
  const storage = storageStub({ [DEMO_STATE_KEY]: original });
  const loaded = loadDemoState(defaults, storage);
  assert.equal(loaded.status, 'corrupt');
  assert.equal(loaded.writable, false);
  assert.equal(storage.getItem(DEMO_STATE_KEY), original);
  const invalidStorage = storageStub({ [DEMO_STATE_KEY]: JSON.stringify({ version: 1, state: { grants: 'wrong' } }) });
  assert.equal(loadDemoState(defaults, invalidStorage).status, 'invalid');
});

test('explicit reset writes the demo defaults', () => {
  const storage = storageStub();
  assert.equal(clearDemoState(defaults, storage), true);
  assert.deepEqual(loadDemoState(defaults, storage).state, defaults);
});
