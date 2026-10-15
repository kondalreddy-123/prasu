import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  FlipHorizontal,
  HeartPulse,
  HelpCircle,
  Hospital,
  Info,
  Lock,
  Mic,
  MicOff,
  Moon,
  Printer,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  Sun,
  Sunrise,
  Unlock,
  Volume2,
  X,
  XCircle,
} from 'lucide-react';
import { LANG_META, SupportedLang, TRANSLATIONS, translateUiPhrase } from '../i18n/translations.ts';

export type FacilityLevel = 'VILLAGE' | 'MANDAL' | 'DISTRICT' | 'PHARMACY' | 'LAB';

export type FacilityType =
  | 'Village Health Centre'
  | 'Mandal Health Centre'
  | 'District Hospital'
  | 'Pharmacy'
  | 'Diagnostic Lab'
  | string;

export const FacilityBadge: React.FC<{
  lang?: SupportedLang;
  level?: FacilityLevel | string;
  type?: FacilityType;
  name?: string;
}> = ({ level, type, name, lang = 'EN' }) => {
  const locale = (text: string) => translateUiPhrase(text, lang);
  const normLevel =
    level ||
    (type?.includes('Village') || type === 'PHC'
      ? 'VILLAGE'
      : type?.includes('District')
      ? 'DISTRICT'
      : 'MANDAL');

  if (normLevel === 'VILLAGE') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E8E5A] whitespace-nowrap shrink-0">
        <HeartPulse className="w-3.5 h-3.5 shrink-0" />
        <span>{name ? `${name} · ${locale('Village')}` : `${locale('Village Health Centre')} · ${locale('Village')}`}</span>
      </span>
    );
  }
  if (normLevel === 'DISTRICT') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-800 whitespace-nowrap shrink-0">
        <Hospital className="w-3.5 h-3.5 shrink-0" />
        <span>{name ? `${name} · ${locale('District')}` : `${locale('District Hospital')} · ${locale('District')}`}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1769AA] whitespace-nowrap shrink-0">
      <Building2 className="w-3.5 h-3.5 shrink-0" />
      <span>{name ? `${name} · ${locale(normLevel === 'PHARMACY' ? 'Pharmacy' : normLevel === 'LAB' ? 'Diagnostic Lab' : 'Mandal')}` : `${type ? locale(type) : locale('Mandal Health Centre')} · ${locale(normLevel === 'PHARMACY' ? 'Pharmacy' : normLevel === 'LAB' ? 'Diagnostic Lab' : 'Mandal')}`}</span>
    </span>
  );
};

export const StatusChip: React.FC<{
  lang?: SupportedLang;
  status:
    | 'GRANTED'
    | 'PENDING'
    | 'REVOKED'
    | 'EXPIRED'
    | 'DENIED'
    | 'ACTIVE'
    | 'COMPLETED'
    | 'STOPPED'
    | 'NORMAL'
    | 'BORDERLINE'
    | 'CRITICAL';
  label?: string;
}> = ({ status, label, lang = 'EN' }) => {
  const text = translateUiPhrase(label || status, lang);
  if (status === 'GRANTED' || status === 'ACTIVE' || status === 'NORMAL') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E8E5A] whitespace-nowrap shrink-0">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>{text}</span>
      </span>
    );
  }
  if (status === 'PENDING' || status === 'BORDERLINE') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#B7791F] whitespace-nowrap shrink-0">
        <Clock className="w-4 h-4 shrink-0" />
        <span>{text}</span>
      </span>
    );
  }
  if (status === 'REVOKED' || status === 'DENIED' || status === 'CRITICAL') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D32F2F] whitespace-nowrap shrink-0">
        <XCircle className="w-4 h-4 shrink-0" />
        <span>{text}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5B6B7A] whitespace-nowrap shrink-0">
      <Clock className="w-4 h-4 shrink-0" />
      <span>{text}</span>
    </span>
  );
};

export const SpeechButton: React.FC<{
  text: string;
  lang: SupportedLang;
  label?: string;
}> = ({ text, lang, label }) => {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

  useEffect(() => () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const handleSpeak = () => {
    if (!supported) {
      return;
    }
    window.speechSynthesis.cancel();
    if (speaking) {
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANG_META[lang].speechLang;
    utterance.rate = 0.95;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <button
      type="button"
      onClick={handleSpeak}
      disabled={!supported}
      aria-label={speaking ? TRANSLATIONS[lang].stopAudio : label || TRANSLATIONS[lang].readAloud}
      title={supported ? TRANSLATIONS[lang].readAloud : TRANSLATIONS[lang].speechUnavailable}
      className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] bg-white hover:bg-[#F5F9FA] text-xs font-semibold text-[#0E7C86] transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <Volume2 className={`w-4 h-4 ${speaking ? 'text-[#D32F2F]' : 'text-[#0E7C86]'}`} />
      <span>{speaking ? TRANSLATIONS[lang].stopAudio : label || TRANSLATIONS[lang].readAloud}</span>
    </button>
  );
};

export const VoiceSearchInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  lang: SupportedLang;
  placeholder: string;
  ariaLabel: string;
}> = ({ value, onChange, lang, placeholder, ariaLabel }) => {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = React.useRef<any>(null);
  const recognitionConstructor = typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

  useEffect(() => () => recognitionRef.current?.abort?.(), []);

  const startVoiceSearch = () => {
    if (!recognitionConstructor) return;
    setError('');
    const recognition = new recognitionConstructor();
    recognition.lang = LANG_META[lang]?.speechLang || 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) onChange(`${value ? `${value} ` : ''}${transcript}`.trim());
    };
    recognition.onerror = () => setError(TRANSLATIONS[lang].voiceUnavailable);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    try { recognition.start(); } catch { setListening(false); setError(TRANSLATIONS[lang].voiceUnavailable); }
  };

  return <div className="space-y-1.5">
    <div className="flex gap-2 items-center">
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={ariaLabel} className="flex-1 min-w-0 min-h-[40px] px-3 rounded-xl border border-[#DDE7EA] bg-white text-xs" />
      <button type="button" onClick={() => listening ? recognitionRef.current?.stop?.() : startVoiceSearch()} disabled={!recognitionConstructor} aria-label={listening ? TRANSLATIONS[lang].stopAudio : TRANSLATIONS[lang].voiceSearch} title={recognitionConstructor ? TRANSLATIONS[lang].voiceSearch : TRANSLATIONS[lang].voiceUnavailable} className="min-h-[40px] min-w-[44px] px-2 rounded-xl border border-[#DDE7EA] bg-white text-[#0E7C86] inline-flex items-center justify-center gap-1 text-[11px] font-bold disabled:opacity-60 disabled:cursor-not-allowed">
        {recognitionConstructor ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}<span className="sr-only">{TRANSLATIONS[lang].voiceSearch}</span>
      </button>
    </div>
    <p className="text-[10px] text-[#5B6B7A]" role="note">{recognitionConstructor ? TRANSLATIONS[lang].voiceSearchPrivacy : TRANSLATIONS[lang].voiceUnavailable} {error}</p>
  </div>;
};

export const AllergyBanner: React.FC<{
  allergies: {
    id: string;
    allergen: string;
    severity: string;
    reaction: string;
    drugClassMatches: string[];
  }[];
  lang: SupportedLang;
}> = ({ allergies, lang }) => {
  if (!allergies || allergies.length === 0) return null;
  const speechText = allergies
    .map(
      (a) =>
        `Critical Allergy Warning: ${a.allergen}. Reaction: ${a.reaction}. Avoid ${a.drugClassMatches.join(', ')}.`
    )
    .join(' ');

  return (
    <div
      role="alert"
      className="rounded-2xl bg-[#FEF2F2] border-2 border-[#D32F2F] p-4 sm:p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#D32F2F] text-white flex items-center justify-center shrink-0 shadow-sm">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold tracking-wider text-[#D32F2F]">
                {TRANSLATIONS[lang]?.allergyWarningBanner || 'CRITICAL ALLERGY ALERT'}
              </span>
              <span className="text-xs text-[#991B1B] font-semibold">
                · {translateUiPhrase('Blocking Point-of-Care Safety Alert', lang)}
              </span>
            </div>
            {allergies.map((alg) => (
              <div key={alg.id} className="mt-1">
                <p className="text-lg sm:text-xl font-extrabold text-[#7F1D1D]">
                  {alg.allergen} ({alg.severity})
                </p>
                <p className="text-sm text-[#991B1B] mt-0.5 font-medium">
                  {translateUiPhrase('Reaction', lang)}: {alg.reaction}
                </p>
                <p className="text-xs text-[#7F1D1D] mt-1 font-mono">
                  {translateUiPhrase('Contraindicated Drug Class Match', lang)}: {alg.drugClassMatches.join(' · ')}
                </p>
              </div>
            ))}
          </div>
        </div>
        <SpeechButton text={speechText} lang={lang} />
      </div>
    </div>
  );
};

export const PatientBanner: React.FC<{
  lang?: SupportedLang;
  patient: {
    name: string;
    age?: number;
    gender?: string;
    bloodGroup?: string;
    healthPassId?: string;
    qrToken?: string;
    abhaNumber?: string;
    phrAddress?: string;
    guardianName?: string;
    emergencyContact?: { name: string; relation: string; phone: string };
  };
  recordOpenSeconds?: number | null;
  onCopyId?: (id: string) => void;
  onShowQr?: () => void;
}> = ({ patient, recordOpenSeconds, onCopyId, onShowQr, lang = 'EN' }) => {
  const [copied, setCopied] = useState(false);
  const hpId = patient.healthPassId || 'HP-DEMO-0417';

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(hpId).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (onCopyId) onCopyId(hpId);
  };

  return (
    <div className="clay-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-[#0E7C86] text-white flex items-center justify-center font-display font-bold text-lg shrink-0 shadow-sm">
          {patient.bloodGroup || 'HP'}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-[#1F2D3D]">{patient.name}</h2>
            {patient.age !== undefined && (
              <span className="text-sm text-[#5B6B7A] font-medium">
                · {patient.age} yrs · {patient.gender}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#5B6B7A] mt-1 font-mono tabular-nums">
              <span className="font-semibold text-[#0E7C86]">{translateUiPhrase('Verified ID', lang)}: {hpId}</span>
            {patient.abhaNumber && (
              <>
                <span>·</span>
                <span>ABHA: {patient.abhaNumber}</span>
              </>
            )}
            {patient.guardianName && (
              <>
                <span>·</span>
                <span className="text-[#1769AA] font-sans font-semibold">
                  {translateUiPhrase('Guardian', lang)}: {patient.guardianName}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {(onCopyId || onShowQr) && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F5F9FA] border border-[#DDE7EA] hover:bg-white text-xs font-bold text-[#1F2D3D] inline-flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5 text-[#0E7C86]" />
              <span>{copied ? translateUiPhrase('Copied ID ✓', lang) : translateUiPhrase('Copy ID', lang)}</span>
            </button>
            {onShowQr && (
              <button
                type="button"
                onClick={onShowQr}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#0E7C86] hover:bg-[#0A626A] text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{translateUiPhrase('Show My QR', lang)}</span>
              </button>
            )}
          </div>
        )}
        {typeof recordOpenSeconds === 'number' && (
          <div className="px-3 py-1.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-xs font-bold text-[#1E8E5A] font-mono tabular-nums">
            {translateUiPhrase('Record opened in', lang)} {recordOpenSeconds.toFixed(1)}s
          </div>
        )}
        {patient.bloodGroup && (
          <div className="text-right pl-1">
            <div className="text-xs text-[#5B6B7A]">{translateUiPhrase('Blood Group', lang)}</div>
            <div className="text-base font-extrabold text-[#D32F2F] font-mono">
              {patient.bloodGroup}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const AccessTimer: React.FC<{
  expiresAt?: string;
  onExtend?: () => void;
  onRevoke?: () => void;
  onExpired?: () => void;
  lang: SupportedLang;
}> = ({ expiresAt, onExtend, onRevoke, onExpired, lang }) => {
  const [remainingText, setRemainingText] = useState('23h 59m');

  useEffect(() => {
    if (!expiresAt) return;
    let triggered = false;
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemainingText('EXPIRED');
        if (!triggered && onExpired) {
          triggered = true;
          onExpired();
        }
        return;
      }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setRemainingText(`${h}h ${m}m ${s}s`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onExpired]);

  const formattedUntil = expiresAt
    ? new Date(expiresAt).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '24 Hours';

  return (
    <div className="rounded-2xl bg-[#ECFDF5] border border-[#1E8E5A]/30 p-3.5 sm:px-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <ShieldCheck className="w-5 h-5 text-[#1E8E5A] shrink-0" />
        <div className="text-sm">
          <span className="font-bold text-[#1E8E5A]">{translateUiPhrase('Access until', lang)} {formattedUntil}</span>
          <span className="text-[#5B6B7A] mx-2">·</span>
          <span className="font-mono tabular-nums font-semibold text-[#1F2D3D]">
            {translateUiPhrase('Live Countdown', lang)}: {remainingText}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onExtend && (
          <button
            type="button"
            onClick={onExtend}
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white border border-[#DDE7EA] hover:bg-[#F5F9FA] text-xs font-bold text-[#0E7C86] transition-colors whitespace-nowrap shrink-0"
          >
            {TRANSLATIONS[lang]?.extendAccessBtn || '+24h Extend'}
          </button>
        )}
        {onRevoke && (
          <button
            type="button"
            onClick={onRevoke}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl clay-btn-danger text-xs font-bold whitespace-nowrap shrink-0"
          >
            {TRANSLATIONS[lang].revokeAccessBtn}
          </button>
        )}
      </div>
    </div>
  );
};

export const LockAnimation: React.FC<{
  lang?: SupportedLang;
  isUnlocked: boolean;
  revokedByPatient?: boolean;
  expiredAccess?: boolean;
  denialCode?: string;
  title?: string;
  subtitle?: string;
  onAction?: () => void;
  actionLabel?: string;
}> = ({
  isUnlocked,
  revokedByPatient,
  expiredAccess,
  denialCode,
  title,
  subtitle,
  onAction,
  actionLabel,
  lang = 'EN',
}) => {
  const ui = (text: string) => translateUiPhrase(text, lang);
  const isRevoked = revokedByPatient || denialCode === 'ACCESS_REVOKED';
  const isExpired = expiredAccess || denialCode === 'ACCESS_EXPIRED';

  return (
    <div
      className={`clay-card p-6 sm:p-8 text-center transition-all duration-300 ${
        isRevoked
          ? 'border-2 border-[#D32F2F] bg-[#FEF2F2]/60'
          : isExpired
          ? 'border-2 border-[#E8A317] bg-[#FFFBEB]/60'
          : isUnlocked
          ? 'border-[#1E8E5A]/40'
          : 'border-[#DDE7EA]'
      }`}
    >
      <div className="mx-auto w-24 h-24 rounded-3xl flex items-center justify-center relative mb-4 clay-tile">
        {isUnlocked ? (
          <div className="w-16 h-16 rounded-2xl bg-[#1E8E5A] text-white flex items-center justify-center shadow-md transition-transform duration-300 scale-105">
            <Unlock className="w-9 h-9" />
          </div>
        ) : (
          <div
            className={`w-16 h-16 rounded-2xl text-white flex items-center justify-center shadow-md transition-transform duration-300 ${
              isRevoked
                ? 'bg-[#D32F2F] scale-105'
                : isExpired
                ? 'bg-[#B7791F] scale-105'
                : 'bg-[#0E7C86]'
            }`}
          >
            {isExpired ? <Clock className="w-9 h-9" /> : <Lock className="w-9 h-9" />}
          </div>
        )}
      </div>

      {isRevoked && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#D32F2F] text-white text-xs font-extrabold tracking-wide mb-2">
          <ShieldAlert className="w-4 h-4" />
          <span>HTTP 403 · {ui('Access revoked')}</span>
        </div>
      )}

      {isExpired && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#B7791F] text-white text-xs font-extrabold tracking-wide mb-2">
          <Clock className="w-4 h-4" />
          <span>HTTP 403 · {ui('Access expired')}</span>
        </div>
      )}

      {!isUnlocked && !isRevoked && !isExpired && denialCode && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#0E7C86]/15 text-[#0E7C86] text-xs font-extrabold tracking-wide mb-2">
          <Lock className="w-3.5 h-3.5" />
          <span>HTTP 403 · CODE: {denialCode}</span>
        </div>
      )}

      <h3 className="text-xl font-bold text-[#1F2D3D]">
        {ui(title ||
          (isRevoked
            ? 'ACCESS REVOKED BY PATIENT - You can no longer view this medical record.'
            : isExpired
            ? 'Access time ended'
            : isUnlocked
            ? 'Consent Active — Record Unlocked'
            : 'Clinical Record Locked'))}
      </h3>
      <p className="text-sm text-[#5B6B7A] max-w-md mx-auto mt-1.5">
        {ui(subtitle ||
          (isRevoked
            ? 'The patient has withdrawn permission. All clinical data has been cleared from the screen.'
            : isExpired
            ? 'Your time-bound consent grant has expired on the server. Request access again to continue.'
            : 'Before consent, only the patient name and verified ID are visible. Clinical data requires explicit patient approval.'))}
      </p>

      {onAction && actionLabel && (
        <div className="mt-5">
          <button
            type="button"
            onClick={onAction}
            className="min-h-[48px] px-6 py-3 clay-btn-primary font-bold text-sm inline-flex items-center gap-2"
          >
            <span>{actionLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export const RxSlipCard: React.FC<{
  med: {
    id: string;
    name: string;
    genericName: string;
    strength: string;
    dosage?: string;
    route?: string;
    startDate?: string;
    endDate?: string;
    frequency: { morning: number; noon: number; night: number };
    durationDays: number;
    daysRemaining?: number;
    computedStatus?: string;
    foodInstruction: string;
    notes?: string;
    prescriberName: string;
    facilityName: string;
    facilityLevel?: FacilityLevel | string;
    facilityType?: FacilityType;
    consultationId?: string;
    prescriptionId?: string;
    selfReported?: boolean;
    refillRequested?: boolean;
    lastTakenAt?: string;
  };
  lang: SupportedLang;
  isPatientView?: boolean;
  onPatientAction?: (medId: string, action: 'MARK_TAKEN' | 'TOGGLE_STOP' | 'REQUEST_REFILL' | 'DELETE_SELF_REPORTED') => void;
  onDoctorRepeatOrContinue?: (med: any) => void;
}> = ({ med, lang, isPatientView, onPatientAction, onDoctorRepeatOrContinue }) => {
  const isActive = med.computedStatus === 'ACTIVE' || typeof med.computedStatus === 'undefined';
  const speechSummary = `${med.name} ${med.strength}. ${
    med.frequency.morning ? `${med.frequency.morning} tablet in the morning.` : ''
  } ${med.frequency.noon ? `${med.frequency.noon} tablet at noon.` : ''} ${
    med.frequency.night ? `${med.frequency.night} tablet at night.` : ''
  } ${med.foodInstruction}. Prescribed by ${med.prescriberName}.`;

  const renderDots = (count: number) => {
    if (!count || count <= 0) return <span className="text-xs text-[#8A97A3]">—</span>;
    return (
      <span className="inline-flex items-center gap-1">
        {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
          <span key={i} className="w-2.5 h-2.5 rounded-full bg-[#0E7C86] inline-block" />
        ))}
        <span className="text-xs font-bold text-[#1F2D3D] ml-0.5">{count}</span>
      </span>
    );
  };

  return (
    <div className="clay-card p-4 sm:p-5 flex flex-col justify-between gap-4">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#0E7C86]/10 text-[#0E7C86] flex items-center justify-center shrink-0 font-display font-extrabold text-base">
              Rx
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base sm:text-lg font-bold text-[#1F2D3D]">
                  {med.name} <span className="text-[#0E7C86] font-mono">{med.strength}</span>
                </h4>
                <StatusChip
                  lang={lang}
                  status={(med.computedStatus as any) || 'ACTIVE'}
                  label={
                    isActive
                      ? `ACTIVE · ${med.daysRemaining ?? med.durationDays} ${TRANSLATIONS[lang].daysLeft}`
                      : med.computedStatus
                  }
                />
              </div>
              <p className="text-xs text-[#5B6B7A] mt-0.5">
                Generic: <span className="font-mono">{med.genericName}</span>
                {med.dosage ? ` · Dose: ${med.dosage}` : ''}
                {med.route ? ` · Route: ${med.route}` : ''} ·{' '}
                <span className="font-semibold text-[#1F2D3D]">{med.foodInstruction}</span>
                {med.startDate
                  ? ` · ${new Date(med.startDate).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}${
                      med.endDate
                        ? ` to ${new Date(med.endDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}`
                        : ` (${med.durationDays}d)`
                    }`
                  : ''}
              </p>
            </div>
          </div>
          <SpeechButton text={speechSummary} lang={lang} />
        </div>

        <div className="grid grid-cols-3 gap-2.5 mt-4 p-3 rounded-xl bg-[#F5F9FA] border border-[#DDE7EA]">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-1 text-xs font-semibold text-[#5B6B7A]">
              <Sunrise className="w-4 h-4 text-[#E8A317]" />
              <span>{TRANSLATIONS[lang].morning}</span>
            </div>
            <div className="mt-1">{renderDots(med.frequency.morning)}</div>
          </div>
          <div className="flex flex-col items-center text-center border-x border-[#DDE7EA]">
            <div className="flex items-center gap-1 text-xs font-semibold text-[#5B6B7A]">
              <Sun className="w-4 h-4 text-[#E8A317]" />
              <span>{TRANSLATIONS[lang].noon}</span>
            </div>
            <div className="mt-1">{renderDots(med.frequency.noon)}</div>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-1 text-xs font-semibold text-[#5B6B7A]">
              <Moon className="w-4 h-4 text-[#1769AA]" />
              <span>{TRANSLATIONS[lang].night}</span>
            </div>
            <div className="mt-1">{renderDots(med.frequency.night)}</div>
          </div>
        </div>

        {med.notes && <p className="text-xs text-[#5B6B7A] mt-2.5">{med.notes}</p>}
      </div>

      <div className="pt-3 border-t border-[#DDE7EA] flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-[#5B6B7A]">
          {med.selfReported ? (
            <span className="font-semibold text-[#B7791F]">
              ⚠️ {lang === 'TE' ? 'రోగి స్వయంగా తెలిపిన మందు' : lang === 'HI' ? 'मरीज द्वारा बताई गई दवा' : 'Patient Self-Reported'}
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-[#0E7C86]" />
              <span className="font-semibold text-[#1F2D3D]">{med.prescriberName}</span>
              <span>·</span>
              <FacilityBadge
                level={med.facilityLevel}
                type={med.facilityType}
                name={med.facilityName}
              />
            </div>
          )}
        </div>

        {isPatientView && onPatientAction && (
          <div className="flex flex-wrap items-center gap-2">
            {med.source === 'SELF_REPORTED' && <button type="button" onClick={() => onPatientAction(med.id, 'DELETE_SELF_REPORTED')} className="min-h-[40px] px-3 py-1.5 rounded-lg border border-rose-200 bg-white text-rose-700 text-xs font-bold hover:bg-rose-50 transition-colors whitespace-nowrap shrink-0">Remove my entry</button>}
            <button
              type="button"
              onClick={() => onPatientAction(med.id, 'MARK_TAKEN')}
              className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[#ECFDF5] text-[#1E8E5A] text-xs font-bold hover:bg-[#D1FAE5] transition-colors whitespace-nowrap shrink-0"
            >
              {med.lastTakenAt
                ? '✓ Dose Logged'
                : lang === 'TE'
                ? 'తీసుకున్నట్లు గుర్తించు'
                : lang === 'HI'
                ? 'लिया गया चिह्नित करें'
                : 'Mark Taken'}
            </button>
            <button
              type="button"
              onClick={() => onPatientAction(med.id, 'REQUEST_REFILL')}
              className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[#F5F9FA] border border-[#DDE7EA] text-[#1769AA] text-xs font-bold hover:bg-white transition-colors whitespace-nowrap shrink-0"
            >
              {med.refillRequested
                ? 'Refill Requested ✓'
                : lang === 'TE'
                ? 'రీఫిల్ అభ్యర్థన'
                : lang === 'HI'
                ? 'रिफिल अनुरोध'
                : 'Request Refill'}
            </button>
            <button
              type="button"
              onClick={() => onPatientAction(med.id, 'TOGGLE_STOP')}
              className="min-h-[40px] px-3 py-1.5 rounded-lg bg-white border border-[#DDE7EA] text-[#5B6B7A] text-xs font-semibold hover:text-[#D32F2F] transition-colors whitespace-nowrap shrink-0"
            >
              {isActive
                ? lang === 'TE'
                  ? 'ఆపినట్లు గుర్తించు'
                  : lang === 'HI'
                  ? 'रोका गया चिह्नित करें'
                  : 'Mark Stopped'
                : lang === 'TE'
                ? 'మళ్ళీ ప్రారంభించు'
                : lang === 'HI'
                ? 'पुनः शुरू करें'
                : 'Resume'}
            </button>
          </div>
        )}

        {!isPatientView && onDoctorRepeatOrContinue && (
          <button
            type="button"
            onClick={() => onDoctorRepeatOrContinue(med)}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#0E7C86]/10 hover:bg-[#0E7C86] text-[#0E7C86] hover:text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
          >
            {isActive ? 'Continue Course (+5d)' : 'Repeat Prescription'}
          </button>
        )}
      </div>
    </div>
  );
};

export const WalletCard: React.FC<{
  patient: {
    name: string;
    age?: number;
    gender?: string;
    bloodGroup?: string;
    healthPassId?: string;
    qrToken?: string;
    abhaNumber?: string;
    phrAddress?: string;
    emergencyContact?: { name: string; relation: string; phone: string };
  };
  allergies: { allergen: string; severity: string }[];
  lang?: SupportedLang;
  onRegenerateQr?: () => void;
}> = ({ patient, allergies, onRegenerateQr, lang = 'EN' }) => {
  const [flipped, setFlipped] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const qrPayload = patient.qrToken || patient.healthPassId || 'HP-DEMO-0417';

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (flipped) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -10;
    setTilt({ x, y });
  };

  return (
    <div className="space-y-4">
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTilt({ x: 0, y: 0 })}
        onClick={() => {
          setTilt({ x: 0, y: 0 });
          setFlipped(!flipped);
        }}
        style={{
          transform: flipped
            ? 'rotateY(0deg)'
            : `perspective(1000px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
          transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="cursor-pointer select-none max-w-lg mx-auto"
      >
        {!flipped ? (
          <div className="rounded-3xl bg-gradient-to-br from-[#0E7C86] via-[#0B6770] to-[#1769AA] text-white p-6 sm:p-7 shadow-xl border border-white/20">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center font-display font-extrabold text-lg">
                  HP
                </div>
                <div>
                  <div className="text-xs font-semibold text-white/80">
                    PATIENT-HELD DIGITAL HEALTH RECORD
                  </div>
                  <div className="text-lg font-display font-bold tracking-tight">
                    HealthPass Wallet Card
                  </div>
                </div>
              </div>
              <div className="px-3 py-1 rounded-xl bg-white/15 text-white font-mono font-bold text-xs">
                PRIVATE RECORD
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
          <div className="text-xs text-white/75">{translateUiPhrase('Patient Name', lang)}</div>
                <div className="text-xl font-bold mt-0.5">{patient.name}</div>
                <div className="text-xs text-white/80 mt-0.5">
                  {patient.age} Years · {patient.gender}
                </div>
              </div>
              <div className="sm:text-right">
          <div className="text-xs text-white/75">{translateUiPhrase('HealthPass Token ID', lang)}</div>
                <div className="text-lg font-mono font-bold tracking-wider mt-0.5">
                  {patient.healthPassId}
                </div>
                <div className="text-xs font-mono text-white/80 mt-0.5">
                  ABHA: {patient.abhaNumber}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs text-white/85">
              <span>{translateUiPhrase('Medical details are private and require patient consent.', lang)}</span>
              <span className="inline-flex items-center gap-1 font-bold text-white underline">
                <FlipHorizontal className="w-4 h-4" />
                Flip for Flat QR
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl bg-white text-[#1F2D3D] p-6 sm:p-7 shadow-xl border-2 border-[#0E7C86]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#0E7C86]">
                  OPTICAL POINT-OF-CARE SCANNER VIEW
                </span>
                <h4 className="text-lg font-bold text-[#1F2D3D]">{patient.name}</h4>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0E7C86]">
                <FlipHorizontal className="w-4 h-4" />
                Flip to Front
              </span>
            </div>

            <div className="my-5 flex flex-col items-center justify-center p-5 rounded-2xl bg-white border-2 border-[#1F2D3D]">
              <QRCodeSVG
                value={qrPayload}
                size={200}
                level="H"
                includeMargin={true}
                bgColor="#FFFFFF"
                fgColor="#000000"
              />
              <div className="mt-3 font-mono font-extrabold text-lg tracking-widest text-[#1F2D3D]">
                {qrPayload}
              </div>
              <div className="text-xs text-[#1E8E5A] font-semibold mt-1">
                ✓ Token-Only QR Payload — Zero Clinical Data Encoded Inside QR
              </div>
            </div>

            <p className="text-xs text-center text-[#5B6B7A]">
              Scanning this QR identifies the record only. The doctor cannot view any medical data
              until you grant selective consent.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 no-print">
        <button
          type="button"
          onClick={() => {
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
              navigator.clipboard.writeText(patient.healthPassId || qrPayload).catch(() => {});
            }
          }}
          className="min-h-[44px] px-4 py-2 rounded-xl clay-tile text-xs font-bold text-[#1F2D3D] inline-flex items-center gap-2"
        >
          <Copy className="w-4 h-4 text-[#0E7C86]" />
          <span>Copy ID ({patient.healthPassId || qrPayload})</span>
        </button>
        <button
          type="button"
          onClick={() => setFlipped(!flipped)}
          className="min-h-[44px] px-4 py-2 rounded-xl clay-tile text-xs font-bold text-[#1F2D3D] inline-flex items-center gap-2"
        >
          <FlipHorizontal className="w-4 h-4 text-[#0E7C86]" />
          <span>{translateUiPhrase(flipped ? 'Show Front Identity Card' : 'Flip to Flat Scannable QR', lang)}</span>
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-[44px] px-4 py-2 rounded-xl clay-tile text-xs font-bold text-[#1F2D3D] inline-flex items-center gap-2"
        >
          <Printer className="w-4 h-4 text-[#1769AA]" />
          <span>{translateUiPhrase('Print Large-Print Wallet Card', lang)}</span>
        </button>
        {onRegenerateQr && (
          <button
            type="button"
            onClick={onRegenerateQr}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-[#D32F2F]/40 bg-[#FEF2F2] text-xs font-bold text-[#D32F2F] inline-flex items-center gap-2 hover:bg-[#FEE2E2]"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{translateUiPhrase('Revoke & Regenerate QR Token', lang)}</span>
          </button>
        )}
      </div>
    </div>
  );
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsInstalled(isStandalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (isInstalled) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] bg-white hover:bg-[#F5F9FA] text-xs font-bold text-[#0E7C86] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>Install Offline Wallet</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="clay-card max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-[#1F2D3D]">
              Install HealthPass Offline QR Wallet (PWA)
            </h3>
            <p className="text-sm text-[#5B6B7A] mt-2">
              HealthPass includes an active Service Worker and Web App Manifest so your QR Card,
              Blood Group, and Allergy Banner work even in zero-network rural clinics.
            </p>
            <ul className="text-xs text-[#1F2D3D] space-y-1.5 mt-3 bg-[#F5F9FA] p-3.5 rounded-xl border border-[#DDE7EA]">
              <li>• On Chrome / Edge / Android: Click the install icon in the browser address bar.</li>
              <li>• On iPhone / iPad Safari: Tap Share → Add to Home Screen.</li>
            </ul>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="mt-4 w-full min-h-[44px] clay-btn-primary text-sm font-bold"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};

function describeLabTestEducationalInfo(testName: string, status: 'NORMAL' | 'HIGH' | 'LOW', value: string, unit: string, referenceRange: string) {
  const lower = testName.toLowerCase();
  let whatItMeasures =
    'This laboratory test measures a biochemical or cellular marker in your sample to help your doctor assess organ or metabolic function.';
  let questionsToAsk = [
    'What does this result mean in the context of my overall health and symptoms?',
    'Do I need a follow-up test or any lifestyle adjustments?',
  ];

  if (lower.includes('haemoglobin') || lower.includes('hemoglobin') || lower === 'hb') {
    whatItMeasures =
      'Haemoglobin is the iron-rich protein in red blood cells that carries oxygen from your lungs to tissues throughout your body.';
    questionsToAsk = [
      'Is my haemoglobin level healthy for my age and gender?',
      'Should I include more iron-rich or vitamin-rich foods in my diet?',
    ];
  } else if (lower.includes('wbc') || lower.includes('leukocyte') || lower.includes('white blood')) {
    whatItMeasures =
      'Total White Blood Cell (WBC) count measures the immune system cells that help your body respond to infections and inflammation.';
    questionsToAsk = [
      'Does my white blood cell count suggest my body is recovering normally?',
      'Are any differential white cell counts needed?',
    ];
  } else if (lower.includes('platelet')) {
    whatItMeasures =
      'Platelets are tiny blood cell fragments that help blood clot properly and prevent excessive bleeding.';
    questionsToAsk = [
      'Is my platelet count in a safe range following my recent fever?',
      'Do any of my current medicines affect platelet function?',
    ];
  } else if (lower.includes('sugar') || lower.includes('glucose') || lower.includes('fbs') || lower.includes('hba1c')) {
    whatItMeasures =
      'Fasting Blood Sugar / HbA1c measures how your body regulates blood glucose levels for energy.';
    questionsToAsk = [
      'What dietary or walking habits can help keep my blood sugar in the target range?',
      'When should I repeat a fasting glucose or HbA1c test?',
    ];
  } else if (lower.includes('creatinine') || lower.includes('urea')) {
    whatItMeasures =
      'Serum Creatinine is a routine waste product filtered by the kidneys and helps indicate how smoothly your kidneys are working.';
    questionsToAsk = [
      'Does this result show my kidney filtration is normal?',
      'How much daily water intake do you recommend for me?',
    ];
  } else if (lower.includes('cholesterol') || lower.includes('ldl') || lower.includes('hdl') || lower.includes('triglyceride')) {
    whatItMeasures =
      'Lipid and cholesterol tests measure fats in the bloodstream that relate to long-term heart and blood vessel health.';
    questionsToAsk = [
      'How do my cholesterol numbers relate to my overall cardiovascular health?',
      'What cooking oils or food changes would be helpful?',
    ];
  } else if (lower.includes('sodium') || lower.includes('potassium')) {
    whatItMeasures =
      'Electrolytes like Sodium and Potassium help maintain fluid balance, nerve signaling, and steady muscle/heart function.';
    questionsToAsk = [
      'Are my hydration and electrolyte levels balanced?',
      'Do any of my blood pressure or hydration medicines affect electrolytes?',
    ];
  } else if (lower.includes('inr') || lower.includes('prothrombin')) {
    whatItMeasures =
      'INR (International Normalized Ratio) measures how quickly your blood clots, often monitored for patients taking blood-thinning medication.';
    questionsToAsk = [
      'Is my INR within the target therapeutic window for my condition?',
      'Should my current dose remain the same until the next check?',
    ];
  } else if (lower.includes('tsh') || lower.includes('thyroid')) {
    whatItMeasures =
      'TSH (Thyroid Stimulating Hormone) helps evaluate whether the thyroid gland is producing hormones at a balanced pace.';
    questionsToAsk = [
      'Does my thyroid level explain any fatigue or weight changes?',
      'When should my thyroid panel be rechecked?',
    ];
  }

  const hasPrintedRange = Boolean(referenceRange && referenceRange.trim() && referenceRange !== '—');
  let relativeNote = '';
  if (!hasPrintedRange) {
    relativeNote = `Recorded value is ${value} ${unit}. No reference range was printed on this report; please ask your doctor for the laboratory's reference interval.`;
  } else if (status === 'LOW') {
    relativeNote = `Your result (${value} ${unit}) is below the printed reference range (${referenceRange} ${unit}). Mild variations can happen for many reasons; discuss this with your doctor.`;
  } else if (status === 'HIGH') {
    relativeNote = `Your result (${value} ${unit}) is above the printed reference range (${referenceRange} ${unit}). Please review this value with a qualified doctor.`;
  } else {
    relativeNote = `Your result (${value} ${unit}) is within the printed reference range (${referenceRange} ${unit}).`;
  }

  return { whatItMeasures, relativeNote, questionsToAsk, hasPrintedRange };
}

export const LabReportExplanationPanel: React.FC<{
  report: {
    id: string;
    title: string;
    testName?: string;
    date?: string;
    facilityName?: string;
    doctorName?: string;
    resultSummary: string;
    plainExplanation?: string;
    extractedFields?: {
      labValues?: {
        id?: string;
        testName: string;
        value: string;
        unit: string;
        referenceRange: string;
        status?: 'NORMAL' | 'HIGH' | 'LOW';
      }[];
    };
  };
  lang: SupportedLang;
}> = ({ report, lang }) => {
  const labValues = React.useMemo(() => {
    if (report.extractedFields?.labValues && report.extractedFields.labValues.length > 0) {
      return report.extractedFields.labValues;
    }
    const items: {
      id?: string;
      testName: string;
      value: string;
      unit: string;
      referenceRange: string;
      status?: 'NORMAL' | 'HIGH' | 'LOW';
    }[] = [];
    const parts = (report.resultSummary || '').split(/[·|;\n]+/);
    for (const part of parts) {
      const m = part.trim().match(/^([A-Za-z0-9\s()/+-]+?)\s*[:=-]\s*([0-9.,]+)\s*([A-Za-z/%µμdL]+)?/);
      if (m) {
        items.push({
          testName: m[1].trim(),
          value: m[2].trim(),
          unit: (m[3] || '').trim(),
          referenceRange: '',
          status: 'NORMAL',
        });
      }
    }
    return items;
  }, [report]);

  return (
    <div className="mt-3 rounded-2xl bg-[#F5F9FA] border border-[#DDE7EA] p-4 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-[#0E7C86]" />
          <span className="text-xs font-extrabold tracking-wide text-[#0E7C86]">
            PATIENT-FRIENDLY LAB REPORT EXPLANATION
          </span>
        </div>
        <SpeechButton
          text={`${report.title}. ${report.plainExplanation || report.resultSummary}. This explanation is for general understanding only and is not a medical diagnosis. Please consult a qualified doctor to interpret these results.`}
          lang={lang}
        />
      </div>

      {labValues.length > 0 ? (
        <div className="space-y-3">
          {labValues.map((lv, idx) => {
            const resolvedStatus = lv.status || 'NORMAL';
            const info = describeLabTestEducationalInfo(
              lv.testName,
              resolvedStatus,
              lv.value,
              lv.unit,
              lv.referenceRange
            );
            const statusBadge = !info.hasPrintedRange
              ? {
                  label: 'No Printed Range on Report',
                  cls: 'bg-white text-[#5B6B7A] border-[#DDE7EA]',
                }
              : resolvedStatus === 'LOW'
              ? {
                  label: 'Below Reference Range',
                  cls: 'bg-[#FFFBEB] text-[#B7791F] border-[#FDE68A]',
                }
              : resolvedStatus === 'HIGH'
              ? {
                  label: 'Above Reference Range',
                  cls: 'bg-[#FFFBEB] text-[#B7791F] border-[#FDE68A]',
                }
              : {
                  label: 'Within Reference Range',
                  cls: 'bg-[#ECFDF5] text-[#1E8E5A] border-[#A7F3D0]',
                };

            return (
              <div
                key={lv.id || idx}
                className="p-3.5 rounded-xl bg-white border border-[#DDE7EA] space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-bold text-[#1F2D3D]">{lv.testName}</span>
                    <span className="ml-2 font-mono text-sm font-extrabold text-[#0E7C86]">
                      {lv.value} {lv.unit}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-[#5B6B7A]">
                      Printed Reference Range:{' '}
                      <strong>
                        {info.hasPrintedRange ? `${lv.referenceRange} ${lv.unit}` : 'Not provided on report'}
                      </strong>
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${statusBadge.cls}`}
                    >
                      {statusBadge.label}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#1F2D3D]">
                  <strong>What this test measures:</strong> {info.whatItMeasures}
                </p>
                <p className="text-xs text-[#5B6B7A]">
                  <strong>Understanding your value:</strong> {info.relativeNote}
                </p>

                <div className="pt-1.5 border-t border-[#DDE7EA]/70">
                  <div className="text-[11px] font-bold text-[#1769AA] flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Questions you may want to ask your doctor:</span>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-xs text-[#5B6B7A] list-disc list-inside">
                    {info.questionsToAsk.map((q, qIdx) => (
                      <li key={qIdx}>{q}</li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-[#1F2D3D]">{report.plainExplanation || report.resultSummary}</p>
      )}

      <div className="p-3 rounded-xl bg-[#FFFBEB] border border-[#E8A317]/60 text-xs font-semibold text-[#92400E]">
        ⚠️ This explanation is for general understanding only and is not a medical diagnosis. Please consult a qualified doctor to interpret these results.
      </div>
    </div>
  );
};

export const PrescriptionDetailModal: React.FC<{
  prescription: {
    id: string;
    consultationId: string;
    patientId: string;
    healthPassId: string;
    doctorId: string;
    doctorName: string;
    doctorLicense?: string;
    facilityName: string;
    facilityLevel: FacilityLevel | string;
    facilityType: FacilityType;
    createdAt: string;
    date: string;
    chiefComplaint: string;
    diagnosis: string;
    clinicalFindings?: string;
    instructions?: string;
    followUpDate?: string;
    confirmedByClinician?: boolean;
    medicines: any[];
    flaggedCorrection?: string;
    correctionHistory?: {
      id: string;
      timestamp: string;
      actorName: string;
      actorRole: string;
      note: string;
    }[];
  };
  lang: SupportedLang;
  onClose: () => void;
  onAmend?: (prescriptionId: string, note: string) => Promise<void>;
}> = ({ prescription, lang, onClose, onAmend }) => {
  const [amendNote, setAmendNote] = useState('');
  const [submittingAmend, setSubmittingAmend] = useState(false);

  const handleAmendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amendNote.trim() || !onAmend) return;
    setSubmittingAmend(true);
    try {
      await onAmend(prescription.id, amendNote.trim());
      setAmendNote('');
    } finally {
      setSubmittingAmend(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="clay-card max-w-2xl w-full p-5 sm:p-6 my-8 max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-[#DDE7EA] pb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-lg bg-[#0E7C86] text-white text-xs font-mono font-bold">
                Rx ID: {prescription.id}
              </span>
              <FacilityBadge
                level={prescription.facilityLevel}
                type={prescription.facilityType}
                name={prescription.facilityName}
              />
            </div>
            <h3 className="text-lg font-bold text-[#1F2D3D] mt-1">
              {prescription.diagnosis || 'Clinical Prescription Record'}
            </h3>
            <p className="text-xs text-[#5B6B7A] font-mono mt-0.5">
              Prescribed by <strong>{prescription.doctorName}</strong>
              {prescription.doctorLicense ? ` (${prescription.doctorLicense})` : ''} · Created:{' '}
              {new Date(prescription.createdAt).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              · Consultation Ref: {prescription.consultationId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#F5F9FA] hover:bg-[#DDE7EA] flex items-center justify-center text-[#1F2D3D]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#F5F9FA] p-3.5 rounded-xl border border-[#DDE7EA]">
          <div>
            <span className="font-bold text-[#5B6B7A]">Chief Complaint:</span>
            <div className="font-semibold text-[#1F2D3D] mt-0.5">{prescription.chiefComplaint}</div>
          </div>
          <div>
            <span className="font-bold text-[#5B6B7A]">Diagnosis:</span>
            <div className="font-semibold text-[#1F2D3D] mt-0.5">{prescription.diagnosis}</div>
          </div>
          {prescription.clinicalFindings && (
            <div className="sm:col-span-2">
              <span className="font-bold text-[#5B6B7A]">Clinical Findings:</span>
              <div className="text-[#1F2D3D] mt-0.5">{prescription.clinicalFindings}</div>
            </div>
          )}
          {prescription.instructions && (
            <div className="sm:col-span-2">
              <span className="font-bold text-[#5B6B7A]">Instructions & Follow-Up:</span>
              <div className="text-[#1F2D3D] mt-0.5">
                {prescription.instructions}
                {prescription.followUpDate ? ` · Follow-up: ${prescription.followUpDate}` : ''}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#1F2D3D] flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#0E7C86]" />
              <span>Prescribed Medicines ({prescription.medicines?.length || 0})</span>
            </h4>
            {prescription.confirmedByClinician && (
              <span className="text-[11px] font-bold text-[#1E8E5A] bg-[#ECFDF5] border border-[#A7F3D0] px-2.5 py-0.5 rounded-lg">
                ✓ Clinician Verified & Signed
              </span>
            )}
          </div>
          <div className="space-y-2.5">
            {(prescription.medicines || []).map((med: any, idx: number) => (
              <RxSlipCard key={med.id || idx} med={med} lang={lang} isPatientView={false} />
            ))}
          </div>
        </div>

        {prescription.correctionHistory && prescription.correctionHistory.length > 0 && (
          <div className="p-3.5 rounded-xl bg-[#FFFBEB] border border-[#E8A317] space-y-2">
            <div className="text-xs font-extrabold text-[#B7791F]">
              Traceable Correction / Amendment Audit History (Original Record Preserved):
            </div>
            {prescription.correctionHistory.map((corr) => (
              <div key={corr.id} className="text-xs text-[#1F2D3D] border-t border-[#E8A317]/30 pt-1.5">
                <span className="font-mono text-[11px] text-[#5B6B7A]">
                  {new Date(corr.timestamp).toLocaleString('en-IN')} · {corr.actorName} ({corr.actorRole}):
                </span>
                <p className="font-semibold mt-0.5">{corr.note}</p>
              </div>
            ))}
          </div>
        )}

        {onAmend && (
          <form onSubmit={handleAmendSubmit} className="pt-2 border-t border-[#DDE7EA] space-y-2">
            <label className="block text-xs font-bold text-[#1F2D3D]">
              Add Traceable Correction / Amendment Note (Preserves Original Prescription):
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={amendNote}
                onChange={(e) => setAmendNote(e.target.value)}
                placeholder="Document correction or clinical addendum..."
                className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] text-xs"
              />
              <button
                type="submit"
                disabled={submittingAmend || !amendNote.trim()}
                className="min-h-[40px] px-4 py-1.5 rounded-xl bg-[#0E7C86] text-white text-xs font-bold disabled:opacity-50"
              >
                {submittingAmend ? 'Saving...' : 'Append Traceable Note'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
