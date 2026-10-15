import test from 'node:test';
import assert from 'node:assert/strict';
import { routeApiRequest } from './apiBackendRouting.js';

test('demo requests stay on the demo handler', async () => {
  const calls = [];
  const result = await routeApiRequest('demo', '/api/test', { method: 'GET' }, {
    demo: (...args) => { calls.push(['demo', ...args]); return 'demo result'; },
    supabase: (...args) => { calls.push(['supabase', ...args]); return 'cloud result'; },
  });
  assert.equal(result, 'demo result');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'demo');
});

test('authenticated requests never fall back to demo after a Supabase failure', async () => {
  const calls = [];
  await assert.rejects(routeApiRequest('supabase', '/api/patient/other/wallet', {}, {
    demo: () => { calls.push('demo'); return 'mock data'; },
    supabase: () => { calls.push('supabase'); throw new Error('database unavailable'); },
  }), /database unavailable/);
  assert.deepEqual(calls, ['supabase']);
});
