import test from 'node:test';
import assert from 'node:assert/strict';
import { createReportExplanationService } from './reportExplanationService.mjs';

const explanation = { language: 'en', whatIsThisReport: 'A blood count report.', mainFindings: ['The document lists blood cell measurements.'], importantValues: [], medicalTerms: [], whatThisDoesNotEstablish: 'It does not establish a diagnosis.', questionsForDoctor: ['How should I understand these results?'] };

test('AI service reports unavailable configuration without forwarding report text', async () => {
  let calls = 0;
  const service = createReportExplanationService({ apiKey: '', fetchImpl: () => { calls += 1; } });
  const result = await service({ externalAiConsent: true, language: 'en', reportText: 'demo' });
  assert.equal(result.status, 503);
  assert.equal(calls, 0);
});

test('AI service requires consent and rejects invalid language or content', async () => {
  const service = createReportExplanationService({ apiKey: 'test-key', fetchImpl: async () => { throw new Error('should not be called'); } });
  assert.equal((await service({ language: 'en', reportText: 'demo' })).status, 400);
  assert.equal((await service({ externalAiConsent: true, language: 'fr', reportText: 'demo' })).status, 400);
  assert.equal((await service({ externalAiConsent: true, language: 'en', reportText: '  ' })).status, 422);
  assert.equal((await service({ externalAiConsent: true, language: 'en', reportText: 'x'.repeat(8001) })).status, 413);
});

test('AI provider errors are returned safely and do not echo medical text', async () => {
  const service = createReportExplanationService({ apiKey: 'test-key', fetchImpl: async () => { throw new Error('provider failed'); } });
  const result = await service({ externalAiConsent: true, language: 'en', reportText: 'private test values' });
  assert.equal(result.status, 502);
  assert.doesNotMatch(JSON.stringify(result), /private test values/);
});

test('configured request uses no-store structured output, validates it, and sends only report text', async () => {
  let request;
  const service = createReportExplanationService({ apiKey: 'test-key', model: 'test-model', fetchImpl: async (_url, init) => {
    request = JSON.parse(init.body);
    return { ok: true, json: async () => ({ output_text: JSON.stringify(explanation) }) };
  } });
  const result = await service({ externalAiConsent: true, language: 'en', reportText: 'Patient Name: Demo\nCBC: values' });
  assert.equal(result.status, 200);
  assert.equal(result.data.explanation.aiGenerated, true);
  assert.equal(request.store, false);
  assert.equal(request.model, 'test-model');
  assert.match(request.input[0].content[0].text, /CBC: values/);
  assert.doesNotMatch(request.input[0].content[0].text, /Demo/);
  assert.equal(request.input[0].content[0].text.includes('health history'), false);
});

test('invalid model structure is rejected and missing measurements stay empty', async () => {
  const service = createReportExplanationService({ apiKey: 'test-key', fetchImpl: async () => ({ ok: true, json: async () => ({ output_text: JSON.stringify({ ...explanation, language: 'te', importantValues: [{ name: 'Glucose' }] }) }) }) });
  const result = await service({ externalAiConsent: true, language: 'en', reportText: 'No values shown.' });
  assert.equal(result.status, 502);
});

test('AI responses with measurements absent from the report are rejected', async () => {
  const service = createReportExplanationService({ apiKey: 'test-key', fetchImpl: async () => ({ ok: true, json: async () => ({ output_text: JSON.stringify({ ...explanation, mainFindings: ['The result is 98.'] }) }) }) });
  const result = await service({ externalAiConsent: true, language: 'en', reportText: 'No values shown.' });
  assert.equal(result.status, 502);
});
