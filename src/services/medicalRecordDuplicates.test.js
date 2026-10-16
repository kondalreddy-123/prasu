import test from 'node:test';
import assert from 'node:assert/strict';
import { findMedicalRecordDuplicate } from './medicalRecordDuplicates.js';

const activeReport = (overrides = {}) => ({
  id: 'record-1', patientId: 'patient-a', medicalCategory: 'Laboratory Reports',
  title: 'Complete Blood Count', resultSummary: 'Hemoglobin 12.4 g/dL', reportDate: '2026-10-15',
  facilityName: 'District Lab', status: 'ACTIVE', ...overrides,
});

test('allows a genuinely new record', () => {
  assert.equal(findMedicalRecordDuplicate('patient-a', activeReport({ title: 'Lipid profile' }), [activeReport()]), null);
});

test('blocks an exact active duplicate after normalizing whitespace and case', () => {
  const duplicate = findMedicalRecordDuplicate('patient-a', activeReport({ title: ' complete   blood COUNT ', resultSummary: 'HEMOGLOBIN 12.4 G/DL', facilityName: ' district   LAB ' }), [activeReport()]);
  assert.equal(duplicate.id, 'record-1');
});

test('scopes duplicate checks to the same patient', () => {
  assert.equal(findMedicalRecordDuplicate('patient-b', activeReport(), [activeReport()]), null);
});

test('allows the same category and report on a different date', () => {
  assert.equal(findMedicalRecordDuplicate('patient-a', activeReport({ reportDate: '2026-10-16' }), [activeReport()]), null);
});

test('allows similar but non-identical results and a different issuing facility', () => {
  assert.equal(findMedicalRecordDuplicate('patient-a', activeReport({ resultSummary: 'Hemoglobin 13.1 g/dL' }), [activeReport()]), null);
  assert.equal(findMedicalRecordDuplicate('patient-a', activeReport({ facilityName: 'Mandal Lab' }), [activeReport()]), null);
});

test('uses a stable source record identifier when present', () => {
  const existing = activeReport({ extractedFields: { accessionNumber: ' LAB-7788 ' } });
  const candidate = activeReport({ title: 'Different OCR title', extractedFields: { accessionNumber: 'lab-7788' } });
  assert.equal(findMedicalRecordDuplicate('patient-a', candidate, [existing]).id, 'record-1');
});

test('uses an exact document fingerprint when present', () => {
  const existing = activeReport({ documentFingerprint: 'sha256:abc123' });
  const candidate = activeReport({ title: 'Different OCR title', documentFingerprint: 'SHA256:ABC123' });
  assert.equal(findMedicalRecordDuplicate('patient-a', candidate, [existing]).id, 'record-1');
});

test('a repeated request key is idempotently recognized for the same patient and category', () => {
  const existing = activeReport({ idempotencyKey: 'save-attempt-1' });
  const candidate = activeReport({ idempotencyKey: 'SAVE-ATTEMPT-1', title: 'Retry title' });
  assert.equal(findMedicalRecordDuplicate('patient-a', candidate, [existing]).id, 'record-1');
});

test('does not block a matching inactive record', () => {
  for (const status of ['REVOKED', 'ARCHIVED', 'CANCELLED', 'INACTIVE']) {
    assert.equal(findMedicalRecordDuplicate('patient-a', activeReport(), [activeReport({ status })]), null);
  }
});

test('does not infer a duplicate from category and title when event details are absent', () => {
  assert.equal(findMedicalRecordDuplicate('patient-a', activeReport({ resultSummary: '', reportDate: '' }), [activeReport({ resultSummary: '', reportDate: '' })]), null);
});
