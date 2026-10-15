import test from 'node:test';
import assert from 'node:assert/strict';
import { decidePharmacistPrescriptionRequest, getPharmacistPrescriptionAccess, getPrescriptionDisplayStatus, PHARMACIST_PRESCRIPTION_CATEGORY, revokePharmacistPrescriptionAccess } from './pharmacistPrescriptionAccess.js';

const now = Date.parse('2026-10-15T12:00:00.000Z');
const makeGrant = (overrides = {}) => ({
  id: 'grant-1',
  patientId: 'pat-1',
  providerId: 'pharmacy-demo',
  providerType: 'pharmacist',
  status: 'GRANTED',
  requestedCategories: [PHARMACIST_PRESCRIPTION_CATEGORY],
  grantedCategories: [PHARMACIST_PRESCRIPTION_CATEGORY],
  expiresAt: '2026-10-16T12:00:00.000Z',
  ...overrides,
});
const context = { patientId: 'pat-1', pharmacistId: 'pharmacy-demo', now };

test('active prescription-only grant allows the matching patient and pharmacist', () => {
  assert.equal(getPharmacistPrescriptionAccess(makeGrant(), context).canRead, true);
});

test('pending and rejected requests do not allow prescription reads', () => {
  assert.equal(getPharmacistPrescriptionAccess(makeGrant({ status: 'PENDING' }), context).status, 'PENDING');
  assert.equal(getPharmacistPrescriptionAccess(makeGrant({ status: 'REJECTED' }), context).status, 'REJECTED');
});

test('revoked, expired, and missing-expiry grants deny reads', () => {
  assert.equal(getPharmacistPrescriptionAccess(makeGrant({ status: 'REVOKED' }), context).canRead, false);
  assert.equal(getPharmacistPrescriptionAccess(makeGrant({ expiresAt: '2026-10-15T11:59:59.000Z' }), context).status, 'EXPIRED');
  assert.equal(getPharmacistPrescriptionAccess(makeGrant({ expiresAt: '' }), context).canRead, false);
});

test('patient and pharmacist mismatches deny reads after account switching', () => {
  assert.equal(getPharmacistPrescriptionAccess(makeGrant(), { ...context, patientId: 'pat-2' }).canRead, false);
  assert.equal(getPharmacistPrescriptionAccess(makeGrant(), { ...context, pharmacistId: 'pharmacy-other' }).canRead, false);
});

test('non-prescription categories or other provider roles never grant access', () => {
  assert.equal(getPharmacistPrescriptionAccess(makeGrant({ grantedCategories: [PHARMACIST_PRESCRIPTION_CATEGORY, 'Allergies'] }), context).canRead, false);
  assert.equal(getPharmacistPrescriptionAccess(makeGrant({ providerType: 'doctor' }), context).canRead, false);
});

test('prescription display status preserves cancelled and discontinued states and marks expired validity', () => {
  assert.equal(getPrescriptionDisplayStatus({ status: 'CANCELLED' }, now), 'CANCELLED');
  assert.equal(getPrescriptionDisplayStatus({ status: 'DISCONTINUED' }, now), 'DISCONTINUED');
  assert.equal(getPrescriptionDisplayStatus({ status: 'ACTIVE', validUntil: '2026-10-14T00:00:00.000Z' }, now), 'EXPIRED');
  assert.equal(getPrescriptionDisplayStatus({ status: 'ACTIVE', validUntil: '' }, now), 'ACTIVE');
  assert.equal(getPrescriptionDisplayStatus({ validUntil: '' }, now), 'UNAVAILABLE');
});

test('patient approval grants only the prescription category for a temporary duration', () => {
  const pending = makeGrant({ status: 'PENDING', grantedCategories: undefined });
  const outcome = decidePharmacistPrescriptionRequest(pending, 'GRANT', { durationHours: 2, now });
  assert.equal(outcome.ok, true);
  assert.deepEqual(outcome.grant.grantedCategories, [PHARMACIST_PRESCRIPTION_CATEGORY]);
  assert.equal(Date.parse(outcome.grant.expiresAt), now + 2 * 3600000);
});

test('patient rejection and revocation block subsequent pharmacist access', () => {
  const rejected = decidePharmacistPrescriptionRequest(makeGrant({ status: 'PENDING' }), 'DENY', { now });
  assert.equal(rejected.grant.status, 'DENIED');
  assert.equal(getPharmacistPrescriptionAccess(rejected.grant, context).canRead, false);
  const revoked = revokePharmacistPrescriptionAccess(makeGrant(), now);
  assert.equal(revoked.grant.status, 'REVOKED');
  assert.equal(getPharmacistPrescriptionAccess(revoked.grant, context).canRead, false);
});

test('approval fails if a request attempts to include other record categories', () => {
  const outcome = decidePharmacistPrescriptionRequest(makeGrant({
    status: 'PENDING', requestedCategories: [PHARMACIST_PRESCRIPTION_CATEGORY, 'Allergies'],
  }), 'GRANT', { now });
  assert.equal(outcome.ok, false);
});
