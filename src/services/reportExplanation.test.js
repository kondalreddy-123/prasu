import test from 'node:test';
import assert from 'node:assert/strict';
import { canExplainDoctorReport, formatReportExplanation, getReportExplanationSections, getReportTextForExplanation, labelReportExplanation, sanitizeReportText, validateReportExplanation } from './reportExplanation.js';

const doctorReport = { id: 'r1', patientId: 'pat-1', source: 'DOCTOR_UPLOAD', rawOcrText: 'CBC\nPatient Name: Demo Person\nHaemoglobin: 13.8 g/dL (range 12-15)\nPhone: 9876543210' };

test('empty, unsupported, and overlong content is handled without invented values', () => {
  assert.equal(getReportTextForExplanation({ rawOcrText: '  ', resultSummary: '' }), '');
  assert.equal(getReportTextForExplanation({ rawOcrText: 'CBC only' }), 'CBC only');
  assert.equal(getReportTextForExplanation({ resultSummary: 'x'.repeat(8500) }).length, 8000);
});

test('report preparation removes common patient identifiers and preserves stated measurements', () => {
  const text = getReportTextForExplanation(doctorReport);
  assert.match(text, /Haemoglobin: 13.8 g\/dL/);
  assert.doesNotMatch(text, /Demo Person|9876543210/);
  assert.equal(sanitizeReportText('email: person@example.com'), '');
  assert.match(sanitizeReportText('Additional note person@example.com'), /redacted email/i);
});

test('explanation requests require matching patient ownership, doctor source, consent, and supported language', () => {
  assert.equal(canExplainDoctorReport({ requestingPatientId: 'pat-2', report: doctorReport, externalAiConsent: true, language: 'en' }).code, 'PATIENT_OWNERSHIP_REQUIRED');
  assert.equal(canExplainDoctorReport({ requestingPatientId: 'pat-1', report: { ...doctorReport, source: 'PATIENT_UPLOAD' }, externalAiConsent: true, language: 'en' }).code, 'DOCTOR_REPORT_REQUIRED');
  assert.equal(canExplainDoctorReport({ requestingPatientId: 'pat-1', report: doctorReport, externalAiConsent: false, language: 'en' }).code, 'EXTERNAL_AI_CONSENT_REQUIRED');
  for (const language of ['en', 'te', 'hi']) assert.equal(canExplainDoctorReport({ requestingPatientId: 'pat-1', report: doctorReport, externalAiConsent: true, language }).ok, true);
  assert.equal(canExplainDoctorReport({ requestingPatientId: 'pat-1', report: doctorReport, externalAiConsent: true, language: 'fr' }).code, 'UNSUPPORTED_LANGUAGE');
});

const valid = { language: 'en', whatIsThisReport: 'A CBC.', mainFindings: ['The document lists a blood count.'], importantValues: [], medicalTerms: [], whatThisDoesNotEstablish: 'It does not establish a diagnosis.', questionsForDoctor: ['What does this mean for me?'] };

test('AI response structure and selected language are validated; absent measurements stay absent', () => {
  assert.equal(validateReportExplanation(valid, 'en'), true);
  assert.equal(validateReportExplanation({ ...valid, language: 'te' }, 'en'), false);
  assert.equal(validateReportExplanation({ ...valid, importantValues: [{ name: 'Glucose' }] }, 'en'), false);
  assert.deepEqual(valid.importantValues, []);
  assert.equal(validateReportExplanation({ ...valid, mainFindings: ['The value is 98.'] }, 'en', 'No values shown.'), false);
});

test('AI output carries explanation label and required medical safety notice', () => {
  const output = labelReportExplanation(valid);
  assert.equal(output.label, 'AI-generated explanation, not a diagnosis');
  assert.match(output.medicalSafetyNotice, /not a diagnosis or treatment recommendation/);
});

test('read-aloud and copy sections retain the selected language and do not invent absent measurements', () => {
  const telugu = { ...valid, language: 'te', whatIsThisReport: 'రక్త పరీక్ష నివేదిక.', mainFindings: [], importantValues: [], medicalTerms: [], whatThisDoesNotEstablish: 'రోగ నిర్ధారణ కాదు.', questionsForDoctor: [] };
  const sections = getReportExplanationSections(telugu);
  assert.equal(sections[0].label, 'ఈ నివేదిక ఏమిటి?');
  assert.match(sections.find((section) => section.key === 'values').text, /ఈ నివేదికలో/);
  assert.doesNotMatch(formatReportExplanation(telugu), /Glucose|98 mg/);
});
