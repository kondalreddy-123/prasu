import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  HelpCircle,
  Lock,
  Pause,
  Play,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Unlock,
  X,
} from 'lucide-react';
import { SupportedLang, TRANSLATIONS } from '../i18n/translations.ts';

interface HowItWorksStoryProps {
  lang: SupportedLang;
  reduceMotion?: boolean;
  onTryStepLive?: (stepIndex: number) => void;
  compact?: boolean;
}

export const HowItWorksStory: React.FC<HowItWorksStoryProps> = ({
  lang,
  reduceMotion = false,
  onTryStepLive,
  compact = false,
}) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.EN;
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(!reduceMotion);

  useEffect(() => {
    if (reduceMotion) {
      setIsPlaying(false);
    }
  }, [reduceMotion]);

  useEffect(() => {
    if (!isPlaying || reduceMotion) return;
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 4000);
    return () => clearInterval(timer);
  }, [isPlaying, reduceMotion]);

  const steps = [
    {
      index: 0,
      title: t.storyStep1Title,
      desc: t.storyStep1Desc,
      badge: 'VILLAGE → PATIENT',
      accent: 'teal',
    },
    {
      index: 1,
      title: t.storyStep2Title,
      desc: t.storyStep2Desc,
      badge: 'SELECTIVE CONSENT (24h)',
      accent: 'emerald',
    },
    {
      index: 2,
      title: t.storyStep3Title,
      desc: t.storyStep3Desc,
      badge: 'VILLAGE · MANDAL · DISTRICT',
      accent: 'sky',
    },
    {
      index: 3,
      title: t.storyStep4Title,
      desc: t.storyStep4Desc,
      badge: 'HTTP 403 ACCESS_REVOKED',
      accent: 'red',
    },
  ];

  const current = steps[activeStep];

  return (
    <section
      aria-label={t.howItWorks}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm"
    >
      {/* Top Header & Playback Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-300">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              {t.howItWorks} — 4-Step Visual Journey
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Village Clinic → Patient Phone → Mandal Health Centre → District Hospital
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            aria-label={isPlaying ? t.storyPause : t.storyPlay}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer hover:bg-slate-100"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? t.storyPause : t.storyPlay}
          </button>

          {onTryStepLive && (
            <button
              type="button"
              onClick={() => onTryStepLive(activeStep)}
              className="px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-extrabold cursor-pointer shadow-xs"
            >
              {t.storyTryLive} →
            </button>
          )}
        </div>
      </div>

      {/* Step Selector Pills (1-4) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {steps.map((s) => {
          const isActive = s.index === activeStep;
          return (
            <button
              key={s.index}
              type="button"
              onClick={() => {
                setActiveStep(s.index);
                setIsPlaying(false);
              }}
              className={`text-left p-2.5 rounded-xl border transition cursor-pointer ${
                isActive
                  ? s.index === 3
                    ? 'bg-red-50 dark:bg-red-950/40 border-red-500 text-red-950 dark:text-red-200 shadow-xs'
                    : 'bg-teal-50 dark:bg-teal-950/40 border-teal-600 text-teal-950 dark:text-teal-200 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-900/80">
                  Step {s.index + 1}
                </span>
                {isActive && (
                  <span className="w-2 h-2 rounded-full bg-teal-600 dark:bg-teal-400 animate-ping" />
                )}
              </div>
              <p className="text-xs font-extrabold line-clamp-1">{s.title}</p>
            </button>
          );
        })}
      </div>

      {/* Connected SVG Illustration Stage */}
      <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* Animated SVG Healthcare Network Diagram */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 overflow-hidden">
            <svg
              viewBox="0 0 680 230"
              className="w-full h-auto"
              role="img"
              aria-label={`Step ${activeStep + 1}: ${current.title}`}
            >
              <defs>
                <linearGradient id="hpLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0E7C86" />
                  <stop offset="50%" stopColor="#1769AA" />
                  <stop offset="100%" stopColor="#5B21B6" />
                </linearGradient>
              </defs>

              <rect width="680" height="230" rx="12" fill="transparent" />

              <path
                d="M 115 115 L 285 115 L 455 115 L 595 115"
                fill="none"
                stroke={activeStep === 3 ? '#B91C1C' : 'url(#hpLineGrad)'}
                strokeWidth="4"
                strokeDasharray={activeStep === 3 ? '6 6' : '8 6'}
              />

              {activeStep !== 3 && (
                <circle
                  cx={activeStep === 0 ? 195 : activeStep === 1 ? 365 : 525}
                  cy="115"
                  r="8"
                  fill="#0E7C86"
                />
              )}

              {/* NODE 1: Village Clinic */}
              <g transform="translate(35, 48)">
                <rect
                  width="125"
                  height="134"
                  rx="14"
                  fill={activeStep === 0 ? '#ECFDF5' : '#F8FAFC'}
                  stroke={activeStep === 0 ? '#059669' : '#CBD5E1'}
                  strokeWidth={activeStep === 0 ? '3' : '1.5'}
                />
                <rect x="14" y="12" width="97" height="20" rx="5" fill="#D1FAE5" />
                <text
                  x="62"
                  y="25"
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="800"
                  fill="#065F46"
                >
                  VILLAGE CLINIC
                </text>
                <text
                  x="62"
                  y="46"
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill="#1E293B"
                >
                  Dr. Kavitha Nair
                </text>

                <rect
                  x="28"
                  y="56"
                  width="68"
                  height="52"
                  rx="8"
                  fill="#FFFFFF"
                  stroke={activeStep === 0 ? '#0E7C86' : '#94A3B8'}
                  strokeWidth="2"
                />
                <rect x="42" y="66" width="16" height="16" fill="#0F172A" />
                <rect x="64" y="66" width="16" height="16" fill="#0F172A" />
                <rect x="42" y="86" width="38" height="12" rx="3" fill="#0E7C86" />
                {activeStep === 0 && !reduceMotion && (
                  <line
                    x1="32"
                    y1="72"
                    x2="92"
                    y2="72"
                    stroke="#10B981"
                    strokeWidth="3"
                  />
                )}
                <text
                  x="62"
                  y="124"
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill="#047857"
                >
                  {activeStep === 0 ? '✓ QR Verified' : 'Kothapalli PHC'}
                </text>
              </g>

              {/* NODE 2: Patient Phone */}
              <g transform="translate(215, 34)">
                <rect
                  width="140"
                  height="162"
                  rx="18"
                  fill="#0F172A"
                  stroke={
                    activeStep === 3
                      ? '#EF4444'
                      : activeStep === 1
                      ? '#0E7C86'
                      : '#475569'
                  }
                  strokeWidth="3"
                />
                <rect x="10" y="14" width="120" height="134" rx="10" fill="#FFFFFF" />
                <text
                  x="70"
                  y="31"
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="800"
                  fill="#0E7C86"
                >
                  PATIENT HEALTHPASS
                </text>

                <rect x="18" y="39" width="104" height="20" rx="5" fill="#ECFDF5" />
                <text x="25" y="52" fontSize="8.5" fontWeight="700" fill="#065F46">
                  ✓ History &amp; Meds (24h)
                </text>

                <rect x="18" y="64" width="104" height="20" rx="5" fill="#FEF3C7" />
                <text x="25" y="77" fontSize="8.5" fontWeight="700" fill="#92400E">
                  🔒 Lab Reports: Locked
                </text>

                <rect
                  x="18"
                  y="94"
                  width="104"
                  height="26"
                  rx="6"
                  fill={activeStep === 3 ? '#B91C1C' : '#0E7C86'}
                />
                <text
                  x="70"
                  y="110"
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="800"
                  fill="#FFFFFF"
                >
                  {activeStep === 3 ? 'REVOKED (403)' : 'GRANT ACCESS'}
                </text>

                <text
                  x="70"
                  y="138"
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fill="#475569"
                >
                  HP-DEMO-0417
                </text>
              </g>

              {/* NODE 3: Mandal Health Centre */}
              <g transform="translate(400, 48)">
                <rect
                  width="120"
                  height="134"
                  rx="14"
                  fill={
                    activeStep === 3
                      ? '#FEF2F2'
                      : activeStep === 2
                      ? '#E0F2FE'
                      : '#F8FAFC'
                  }
                  stroke={
                    activeStep === 3
                      ? '#EF4444'
                      : activeStep === 2
                      ? '#0284C7'
                      : '#CBD5E1'
                  }
                  strokeWidth={activeStep === 2 || activeStep === 3 ? '3' : '1.5'}
                />
                <rect x="12" y="12" width="96" height="20" rx="5" fill="#BAE6FD" />
                <text
                  x="60"
                  y="25"
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="800"
                  fill="#075985"
                >
                  MANDAL CENTRE
                </text>
                <text
                  x="60"
                  y="45"
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill="#1E293B"
                >
                  Dr. Meena Rao
                </text>

                {activeStep === 3 ? (
                  <g>
                    <rect
                      x="16"
                      y="56"
                      width="88"
                      height="52"
                      rx="8"
                      fill="#FEE2E2"
                      stroke="#DC2626"
                    />
                    <text
                      x="60"
                      y="78"
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="800"
                      fill="#991B1B"
                    >
                      🔒 403 LOCKED
                    </text>
                    <text
                      x="60"
                      y="94"
                      textAnchor="middle"
                      fontSize="8"
                      fontWeight="700"
                      fill="#B91C1C"
                    >
                      ACCESS_REVOKED
                    </text>
                  </g>
                ) : (
                  <g>
                    <rect
                      x="16"
                      y="55"
                      width="88"
                      height="24"
                      rx="5"
                      fill="#FEE2E2"
                    />
                    <text
                      x="60"
                      y="70"
                      textAnchor="middle"
                      fontSize="8.5"
                      fontWeight="800"
                      fill="#991B1B"
                    >
                      ⚠ Sulfa Drug Allergy
                    </text>
                    <rect
                      x="16"
                      y="84"
                      width="88"
                      height="24"
                      rx="5"
                      fill="#FFFFFF"
                      stroke="#94A3B8"
                    />
                    <text
                      x="60"
                      y="99"
                      textAnchor="middle"
                      fontSize="8.5"
                      fontWeight="700"
                      fill="#0F172A"
                    >
                      + Add Consultation
                    </text>
                  </g>
                )}

                <text
                  x="60"
                  y="124"
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fill="#0369A1"
                >
                  Ibrahimpatnam CHC
                </text>
              </g>

              {/* NODE 4: District Hospital */}
              <g transform="translate(545, 48)">
                <rect
                  width="115"
                  height="134"
                  rx="14"
                  fill={activeStep === 2 ? '#F3E8FF' : '#F8FAFC'}
                  stroke={activeStep === 2 ? '#7C3AED' : '#CBD5E1'}
                  strokeWidth={activeStep === 2 ? '3' : '1.5'}
                />
                <rect x="10" y="12" width="95" height="20" rx="5" fill="#EDE9FE" />
                <text
                  x="57"
                  y="25"
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="800"
                  fill="#5B21B6"
                >
                  DISTRICT HOSP
                </text>
                <text
                  x="57"
                  y="45"
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="700"
                  fill="#1E293B"
                >
                  Dr. Arvind Sharma
                </text>
                <rect
                  x="14"
                  y="56"
                  width="87"
                  height="50"
                  rx="8"
                  fill="#FFFFFF"
                  stroke="#C4B5FD"
                />
                <text
                  x="57"
                  y="76"
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fill="#4C1D95"
                >
                  Sees Village &amp;
                </text>
                <text
                  x="57"
                  y="90"
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fill="#4C1D95"
                >
                  Mandal History
                </text>
                <text
                  x="57"
                  y="124"
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fill="#6D28D9"
                >
                  Vijayawada
                </text>
              </g>
            </svg>
          </div>

          {/* Active Step Narrative Card */}
          <div className="lg:col-span-5 space-y-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-teal-100 dark:bg-teal-900/50 text-teal-900 dark:text-teal-200 text-xs font-extrabold">
              <span>Step {activeStep + 1} of 4</span>
              <span>·</span>
              <span>{current.badge}</span>
            </div>

            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
              {current.title}
            </h3>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {current.desc}
            </p>

            {!compact && (
              <div className="pt-2 flex flex-wrap items-center gap-2">
                {activeStep === 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <QrCode className="w-4 h-4" /> Pre-consent: Only Name &amp; ID visible
                  </span>
                )}
                {activeStep === 1 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 px-3 py-1.5 rounded-lg border border-teal-200 dark:border-teal-800">
                    <Unlock className="w-4 h-4" /> Category-level control + live countdown
                  </span>
                )}
                {activeStep === 2 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 px-3 py-1.5 rounded-lg border border-sky-200 dark:border-sky-800">
                    <CheckCircle2 className="w-4 h-4" /> Prevents duplicate drugs &amp; repeat tests
                  </span>
                )}
                {activeStep === 3 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-950/50 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800">
                    <Lock className="w-4 h-4" /> Instant SSE lock + HTTP 403 ACCESS_REVOKED
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
