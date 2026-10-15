export const REPORT_SPEECH_LANGUAGES = Object.freeze({
  en: { label: 'English', locale: 'en-IN' },
  te: { label: 'తెలుగు', locale: 'te-IN' },
  hi: { label: 'हिन्दी', locale: 'hi-IN' },
});

export function getReportSpeechLocale(language) {
  return REPORT_SPEECH_LANGUAGES[language]?.locale || null;
}

export function findSpeechVoiceForLocale(voices, locale) {
  if (!locale || !Array.isArray(voices)) return null;
  const exact = voices.find((voice) => String(voice.lang || '').toLowerCase() === locale.toLowerCase());
  if (exact) return exact;
  const base = locale.split(/[-_]/)[0].toLowerCase();
  return voices.find((voice) => String(voice.lang || '').toLowerCase().split(/[-_]/)[0] === base) || null;
}

export function findReportSpeechVoice(voices, language) {
  const locale = getReportSpeechLocale(language);
  return findSpeechVoiceForLocale(voices, locale);
}

export function createReportSpeechController({ synthesis, createUtterance, onState = () => {} }) {
  let current = null;
  let sequence = 0;
  let state = 'idle';

  const setState = (next) => {
    state = next;
    onState(next);
  };

  const start = (text, language, rate = 1) => {
    const cleanText = String(text || '').trim();
    if (!cleanText) return { ok: false, error: 'EMPTY_TEXT' };
    if (!synthesis || typeof createUtterance !== 'function') return { ok: false, error: 'UNSUPPORTED' };
    const voice = findReportSpeechVoice(synthesis.getVoices?.() || [], language);
    if (!voice) return { ok: false, error: 'VOICE_UNAVAILABLE' };
    const id = ++sequence;
    synthesis.cancel();
    const utterance = createUtterance(cleanText);
    utterance.lang = getReportSpeechLocale(language);
    utterance.voice = voice;
    utterance.rate = rate;
    utterance.onstart = () => { if (id === sequence) setState('speaking'); };
    utterance.onend = () => { if (id === sequence) setState('idle'); };
    utterance.onerror = () => { if (id === sequence) setState('error'); };
    current = { text: cleanText, language, rate, id };
    setState('speaking');
    synthesis.speak(utterance);
    return { ok: true };
  };

  return {
    start,
    pause() {
      if (state !== 'speaking') return false;
      synthesis.pause();
      setState('paused');
      return true;
    },
    resume() {
      if (state !== 'paused') return false;
      synthesis.resume();
      setState('speaking');
      return true;
    },
    stop() {
      ++sequence;
      current = null;
      synthesis?.cancel?.();
      setState('idle');
    },
    repeat() {
      if (!current) return { ok: false, error: 'NO_PREVIOUS_READING' };
      return start(current.text, current.language, current.rate);
    },
    getState: () => state,
  };
}
