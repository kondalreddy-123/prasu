import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Repeat2, Square, Volume2 } from 'lucide-react';
import { translateUiPhrase, SupportedLang } from '../i18n/translations.ts';
import { createReportSpeechController, findReportSpeechVoice } from '../services/reportSpeech.js';

type LanguageCode = 'en' | 'te' | 'hi';
type ReadingSection = { key: string; label: string; text: string };

export const ReportReadAloudControls: React.FC<{ sections: ReadingSection[]; language: LanguageCode; uiLang: SupportedLang }> = ({ sections, language, uiLang }) => {
  const ui = (phrase: string) => translateUiPhrase(phrase, uiLang);
  const [sectionKey, setSectionKey] = useState('all');
  const [rate, setRate] = useState(1);
  const [playbackState, setPlaybackState] = useState('idle');
  const [speechMessage, setSpeechMessage] = useState('');
  const [, setVoicesVersion] = useState(0);
  const controllerRef = useRef<ReturnType<typeof createReportSpeechController> | null>(null);
  const text = useMemo(() => {
    if (sectionKey === 'all') return sections.map((section) => `${section.label}. ${section.text}`).join('\n\n');
    return sections.find((section) => section.key === sectionKey)?.text || '';
  }, [sections, sectionKey]);

  useEffect(() => {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
    const synthesis = window.speechSynthesis;
    const controller = createReportSpeechController({
      synthesis,
      createUtterance: (value: string) => new SpeechSynthesisUtterance(value),
      onState: (state: string) => setPlaybackState(state as any),
    });
    controllerRef.current = controller;
    const onVoicesChanged = () => setVoicesVersion((version) => version + 1);
    synthesis.addEventListener?.('voiceschanged', onVoicesChanged);
    onVoicesChanged();
    return () => {
      synthesis.removeEventListener?.('voiceschanged', onVoicesChanged);
      controller.stop();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.stop();
    setSpeechMessage('');
  }, [language, sectionKey]);

  const browserSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  const matchingVoice = browserSupported ? findReportSpeechVoice(window.speechSynthesis.getVoices(), language) : null;
  const stateText = playbackState === 'speaking' ? ui('Speaking') : playbackState === 'paused' ? ui('Paused') : playbackState === 'error' ? ui('Speech playback stopped with an error.') : ui('Ready');
  const start = (repeat = false) => {
    setSpeechMessage('');
    const result = repeat ? controllerRef.current?.repeat() : controllerRef.current?.start(text, language, rate);
    if (result?.error === 'VOICE_UNAVAILABLE') setSpeechMessage(ui('No matching system voice is available for this language. Install an English, Telugu, or Hindi voice in Windows speech settings, then retry.'));
    else if (result?.error === 'UNSUPPORTED') setSpeechMessage(ui('Read aloud is not supported by this browser.'));
    else if (result?.error) setSpeechMessage(ui('Select report text before using read aloud.'));
  };

  return (
    <div className="rounded-xl border border-[#DDE7EA] bg-[#F8FBFC] p-3 space-y-3" aria-label={ui('Report read-aloud controls')}>
      <div className="flex flex-wrap items-center gap-3">
        <Volume2 className="w-5 h-5 text-[#0E7C86]" aria-hidden="true" />
        <label className="text-xs font-semibold text-[#1F2D3D]">{ui('Read section')}
          <select value={sectionKey} onChange={(event) => setSectionKey(event.target.value)} className="ml-2 min-h-[40px] px-2 rounded-lg border border-[#DDE7EA] bg-white" aria-label={ui('Read section')}>
            <option value="all">{ui('Entire explanation')}</option>
            {sections.map((section) => <option key={section.key} value={section.key}>{section.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-[#1F2D3D]">{ui('Speech speed')}
          <select value={rate} onChange={(event) => setRate(Number(event.target.value))} className="ml-2 min-h-[40px] px-2 rounded-lg border border-[#DDE7EA] bg-white" aria-label={ui('Speech speed')}>
            <option value={1}>{ui('Normal')}</option><option value={0.78}>{ui('Slower')}</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => start(false)} disabled={!browserSupported || !text || playbackState === 'speaking'} className="min-h-[44px] px-3 rounded-lg bg-[#0E7C86] text-white text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50"><Play className="w-4 h-4" />{ui('Read aloud')}</button>
        {playbackState === 'speaking' ? <button type="button" onClick={() => controllerRef.current?.pause()} className="min-h-[44px] px-3 rounded-lg border border-[#DDE7EA] bg-white text-sm font-bold inline-flex items-center gap-2"><Pause className="w-4 h-4" />{ui('Pause')}</button> : playbackState === 'paused' ? <button type="button" onClick={() => controllerRef.current?.resume()} className="min-h-[44px] px-3 rounded-lg border border-[#DDE7EA] bg-white text-sm font-bold inline-flex items-center gap-2"><Play className="w-4 h-4" />{ui('Resume')}</button> : null}
        <button type="button" onClick={() => start(true)} disabled={!browserSupported || !text} className="min-h-[44px] px-3 rounded-lg border border-[#DDE7EA] bg-white text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50"><Repeat2 className="w-4 h-4" />{ui('Repeat')}</button>
        <button type="button" onClick={() => controllerRef.current?.stop()} disabled={playbackState === 'idle'} className="min-h-[44px] px-3 rounded-lg border border-[#DDE7EA] bg-white text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50"><Square className="w-4 h-4" />{ui('Stop')}</button>
        <span className="self-center text-xs font-semibold text-[#1F2D3D]" aria-live="polite">{ui('Playback status')}: {stateText}{matchingVoice ? ` · ${matchingVoice.name}` : ''}</span>
      </div>
      {!browserSupported && <p role="status" className="text-xs text-amber-800">{ui('Read aloud is not supported by this browser.')}</p>}
      {browserSupported && !matchingVoice && <p role="status" className="text-xs text-amber-800">{ui('No matching system voice is available for this language. Install an English, Telugu, or Hindi voice in Windows speech settings, then retry.')}</p>}
      {speechMessage && <p role="alert" className="text-xs text-amber-800">{speechMessage}</p>}
    </div>
  );
};
