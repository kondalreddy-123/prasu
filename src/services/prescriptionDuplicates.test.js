import test from 'node:test';
import assert from 'node:assert/strict';
import { findActivePrescriptionDuplicate, isActivePrescription, normalizePrescriptionText } from './prescriptionDuplicates.js';
import { normalizeClinicalSafetyResult } from './clinicalSafetyShape.js';

const now = new Date('2026-10-15T12:00:00');
const regimen = { name: '  Metformin ', strength: '500 MG', dosage: '1 tablet', route: 'Oral', frequency: { morning: 1, noon: 0, night: 1 }, foodInstruction: 'With food', notes: 'Take daily' };
const active = (overrides = {}) => ({ id: 'rx-1', patientId: 'p1', status: 'ACTIVE', ...regimen, endDate: '2026-12-01', ...overrides });

test('normalizes case and surrounding/repeated whitespace', () => {
  assert.equal(normalizePrescriptionText('  METFORMIN   '), 'metformin');
  assert.ok(findActivePrescriptionDuplicate('p1', [{ ...regimen, name: 'metformin' }], [active()], now));
});

test('scopes duplicates to the same patient', () => {
  assert.equal(findActivePrescriptionDuplicate('p2', [regimen], [active()], now), null);
});

test('allows expired, cancelled, and discontinued prescriptions', () => {
  assert.equal(isActivePrescription(active({ endDate: '2026-10-14' }), now), false);
  assert.equal(isActivePrescription(active({ status: 'CANCELLED' }), now), false);
  assert.equal(isActivePrescription(active({ status: 'DISCONTINUED' }), now), false);
});

test('permits a materially different dose, formulation, duration, or instructions', () => {
  for (const change of [{ dosage: '2 tablets' }, { route: 'Topical' }, { formulation: 'extended release' }, { duration: '14 days' }, { notes: 'Taper over two weeks' }]) {
    assert.equal(findActivePrescriptionDuplicate('p1', [{ ...regimen, ...change }], [active()], now), null);
  }
});

test('treats active entries with no end date as ongoing; malformed end dates fail closed', () => {
  assert.equal(isActivePrescription(active({ endDate: '' }), now), true);
  assert.equal(isActivePrescription(active({ endDate: 'not-a-date' }), now), true);
});

test('normalizes generic success responses so consultation form alert lists stay usable', () => {
  assert.deepEqual(normalizeClinicalSafetyResult({ success: true }), {
    allergyAlerts: [], duplicateAlerts: [], interactionAlerts: [], repeatTestAlerts: [],
  });
});
