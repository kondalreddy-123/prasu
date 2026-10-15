import test from 'node:test';
import assert from 'node:assert/strict';
import { createReportSpeechController, findReportSpeechVoice, findSpeechVoiceForLocale, getReportSpeechLocale } from './reportSpeech.js';

test('report read-aloud uses the correct Indian language tags and matching voice', () => {
  assert.equal(getReportSpeechLocale('en'), 'en-IN');
  assert.equal(getReportSpeechLocale('te'), 'te-IN');
  assert.equal(getReportSpeechLocale('hi'), 'hi-IN');
  const voices = [{ lang: 'en-IN' }, { lang: 'te-IN' }, { lang: 'hi-IN' }];
  assert.equal(findReportSpeechVoice(voices, 'te'), voices[1]);
  assert.equal(findReportSpeechVoice(voices, 'hi'), voices[2]);
  assert.equal(findSpeechVoiceForLocale([{ lang: 'ta-IN' }], 'ta-IN').lang, 'ta-IN');
});

test('missing Telugu voice is reported and unrelated English voice is never used', () => {
  const english = { lang: 'en-US' };
  assert.equal(findReportSpeechVoice([english], 'te'), null);
  const controller = createReportSpeechController({ synthesis: { getVoices: () => [english] }, createUtterance: () => ({}) });
  assert.deepEqual(controller.start('తెలుగు వాక్యం', 'te'), { ok: false, error: 'VOICE_UNAVAILABLE' });
});

test('stop then restart cancels the prior utterance and stale events cannot change state', () => {
  const utterances = [];
  let cancels = 0;
  const synthesis = { getVoices: () => [{ lang: 'en-IN' }], cancel: () => { cancels += 1; }, speak: (utterance) => utterances.push(utterance), pause() {}, resume() {} };
  const controller = createReportSpeechController({ synthesis, createUtterance: (text) => ({ text }) });
  assert.equal(controller.start('first', 'en').ok, true);
  const old = utterances[0];
  controller.stop();
  assert.equal(controller.start('second', 'en').ok, true);
  old.onend();
  assert.equal(controller.getState(), 'speaking');
  assert.equal(utterances.length, 2);
  assert.equal(cancels, 3);
});

test('pause, resume, and repeat operate on the same selected reading', () => {
  const utterances = [];
  const synthesis = { getVoices: () => [{ lang: 'en-IN' }], cancel() {}, speak: (u) => utterances.push(u), pause() {}, resume() {} };
  const controller = createReportSpeechController({ synthesis, createUtterance: (text) => ({ text }) });
  controller.start('report section', 'en', 0.8);
  assert.equal(controller.pause(), true);
  assert.equal(controller.resume(), true);
  assert.equal(controller.repeat().ok, true);
  assert.equal(utterances[1].text, 'report section');
  assert.equal(utterances[1].rate, 0.8);
});
