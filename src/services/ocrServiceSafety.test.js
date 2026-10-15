import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOcrClinicalText } from './ocrService.ts';

test('text extraction does not invent missing date, provider, diagnosis, units, or reference ranges', () => {
  const result = parseOcrClinicalText('Haemoglobin: 13.8');
  assert.equal(result.reportDate, '');
  assert.equal(result.facilityName, '');
  assert.equal(result.doctorName, '');
  assert.equal(result.diagnosis, '');
  assert.equal(result.labValues[0].unit, '');
  assert.equal(result.labValues[0].referenceRange, '');
  assert.equal(result.labValues[0].status, undefined);
});

test('text extraction preserves explicitly printed units and reference ranges without inferred status', () => {
  const result = parseOcrClinicalText('HbA1c: 6.4 % (reference range: 4.0 - 5.7)');
  assert.equal(result.labValues[0].value, '6.4');
  assert.equal(result.labValues[0].unit, '%');
  assert.equal(result.labValues[0].referenceRange, '4.0 - 5.7');
  assert.equal(result.labValues[0].status, undefined);
});

test('mentioning a medicine never invents strength or dosing instructions', () => {
  const result = parseOcrClinicalText('Prescription: Metformin');
  assert.equal(result.extractedMedicines[0].name, 'Metformin');
  assert.equal(result.extractedMedicines[0].strength, '');
  assert.equal(result.extractedMedicines[0].dosage, '');
  assert.equal(result.extractedMedicines[0].durationDays, 0);
  assert.equal(result.extractedMedicines[0].confirmed, false);
});
