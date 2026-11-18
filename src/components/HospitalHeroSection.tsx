import React, { useState } from 'react';
import {
  Activity,
  Award,
  Bed,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Heart,
  Layers,
  Lock,
  Phone,
  Plus,
  QrCode,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  User,
  Users,
  Video,
} from 'lucide-react';
import { HospitalCardiac3DVisualizer } from './HospitalCardiac3DVisualizer.tsx';
import { HospitalCampus3D } from './HospitalCampus3D.tsx';
import { ThreeHealthCard3D } from './ThreeHealthCard3D.tsx';
import { SupportedLang, tr } from '../i18n/translations.ts';

interface Props {
  lang?: SupportedLang;
  onOpenPatientWallet: () => void;
  onOpenDoctorPortal: () => void;
  onOpenEmergencyPortal: () => void;
  onOpenPharmacyPortal: () => void;
  onOpenLabPortal: () => void;
  onOpenCreateAccount: (role?: 'patient' | 'doctor') => void;
  onOpenSignIn: () => void;
}

export const HospitalHeroSection: React.FC<Props> = ({
  lang = 'EN',
  onOpenPatientWallet,
  onOpenDoctorPortal,
  onOpenEmergencyPortal,
  onOpenPharmacyPortal,
  onOpenLabPortal,
  onOpenCreateAccount,
  onOpenSignIn,
}) => {
  const [active3DTab, setActive3DTab] = useState<'cardiac' | 'campus' | 'smartcard'>('cardiac');
  const [searchQuery, setSearchQuery] = useState('');

  const specialties = [
    { name: 'Cardiology & Heart Institute', icon: Heart, badge: 'Cath Lab Active', color: 'text-rose-500' },
    { name: 'Neurology & Acute Stroke Unit', icon: Activity, badge: 'Comprehensive Center', color: 'text-sky-500' },
    { name: 'Trauma & Emergency Medicine', icon: ShieldAlert, badge: '24/7 Level-1', color: 'text-amber-500' },
    { name: 'Orthopaedics & Joint Robotics', icon: Award, badge: 'Robotic Precision', color: 'text-teal-500' },
    { name: 'Oncology & Precision Care', icon: Sparkles, badge: 'Targeted Therapies', color: 'text-purple-500' },
  ];

  const filteredSpecialties = specialties.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <section className="space-y-6">
      {/* ============================================================== */}
      {/* 1. REAL HOSPITAL OPERATIONAL & ACCREDITATION RIBBON            */}
      {/* ============================================================== */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-[#071F2D] to-slate-900 border border-teal-500/30 p-3 sm:p-4 text-white shadow-xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          {/* Left: Emergency Status */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-extrabold tracking-wide uppercase text-[11px]">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              24/7 Level 1 Trauma Care
            </span>
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <Phone className="w-3.5 h-3.5 text-rose-400" />
              <span>Trauma Hotline: <strong className="text-white font-mono text-sm">108</strong> / <strong className="text-teal-300 font-mono">1800-425-HPASS</strong></span>
            </div>
            <span className="hidden sm:inline text-slate-600">|</span>
            <div className="flex items-center gap-2 text-slate-300">
              <Bed className="w-3.5 h-3.5 text-teal-400" />
              <span>ICU Beds: <span className="text-emerald-400 font-bold">14 Available</span></span>
            </div>
          </div>

          {/* Right: Hospital Accreditations */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[11px] text-slate-400 font-semibold">
            <span className="inline-flex items-center gap-1 text-slate-200">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              NABH Accredited Tertiary Center
            </span>
            <span className="hidden sm:inline text-slate-600">·</span>
            <span className="inline-flex items-center gap-1 text-slate-200">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              NABL Certified ISO 15189
            </span>
            <span className="hidden sm:inline text-slate-600">·</span>
            <span className="inline-flex items-center gap-1 text-slate-200">
              <Lock className="w-3.5 h-3.5 text-sky-400" />
              ABDM (M3) & HIPAA Compliant
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. MAIN HERO BANNER & 3D CLINICAL VISUALIZER                   */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Hospital Mission & Clinical Entrypoints */}
        <div className="lg:col-span-5 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50/90 px-3.5 py-1 text-xs font-bold text-[#0E7C86] shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#0E7C86] animate-pulse" />
            <span>Apex Institute of Medical Sciences & HealthPass Network</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-[1.15]">
              World-Class Care. <br />
              <span className="bg-gradient-to-r from-[#0E7C86] via-[#1769AA] to-teal-600 bg-clip-text text-transparent">
                Digital Health Clarity.
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Experience seamless clinical care from inpatient tertiary surgery to automated rural pharmacy dispensing. Keep your complete medical history encrypted under your personal cryptographic consent.
            </p>
          </div>

          {/* Quick Action Clinical Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenPatientWallet}
              className="min-h-12 rounded-2xl clay-btn-primary px-5 py-3 text-sm font-bold inline-flex items-center gap-2 cursor-pointer shadow-md hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              <User className="w-4 h-4" />
              <span>{tr('patientPortal', lang)}</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onOpenDoctorPortal}
              className="min-h-12 rounded-2xl border-2 border-[#1769AA] bg-white hover:bg-sky-50 px-5 py-3 text-sm font-bold text-[#1769AA] inline-flex items-center gap-2 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              <Stethoscope className="w-4 h-4" />
              <span>{tr('doctorPortal', lang)}</span>
            </button>

            <button
              type="button"
              onClick={onOpenEmergencyPortal}
              className="min-h-12 rounded-2xl border-2 border-rose-300 bg-rose-50 hover:bg-rose-100 px-4 py-3 text-xs font-extrabold text-rose-700 inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>{tr('navEmergencyRecords', lang)}</span>
            </button>
          </div>

          {/* Hospital Specialty Search Bar */}
          <div className="space-y-2 pt-2 border-t border-slate-200/80">
            <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-[#0E7C86]" />
              <span>Search Clinical Specialties & OPD Departments</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. Cardiology, Stroke, Trauma, Pathology..."
                className="w-full min-h-[44px] px-3.5 py-2 pl-9 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 placeholder-slate-400 shadow-xs focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
            </div>

            {/* Specialty Quick Chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {filteredSpecialties.slice(0, 4).map((spec, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={onOpenDoctorPortal}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <spec.icon className={`w-3 h-3 ${spec.color}`} />
                  <span>{spec.name.split(' ')[0]}</span>
                  <span className="text-[9px] text-slate-400">({spec.badge})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: 3D Interactive Clinical Visualizer Tabbed Display */}
        <div className="lg:col-span-7 space-y-3">
          {/* 3D Tab Switcher */}
          <div className="flex items-center justify-between p-1.5 rounded-2xl bg-slate-900/90 border border-teal-500/30 backdrop-blur-md shadow-md">
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActive3DTab('cardiac')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  active3DTab === 'cardiac'
                    ? 'bg-gradient-to-r from-teal-500 to-[#0E7C86] text-white shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Heart className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                <span>3D Cardiac Digital Twin & ECG</span>
              </button>

              <button
                type="button"
                onClick={() => setActive3DTab('campus')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  active3DTab === 'campus'
                    ? 'bg-gradient-to-r from-teal-500 to-[#0E7C86] text-white shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>3D Hospital Campus & Wings</span>
              </button>

              <button
                type="button"
                onClick={() => setActive3DTab('smartcard')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  active3DTab === 'smartcard'
                    ? 'bg-gradient-to-r from-teal-500 to-[#0E7C86] text-white shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <QrCode className="w-3.5 h-3.5 text-amber-400" />
                <span>3D Biometric Pass</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-teal-300 font-bold px-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Interactive 3D</span>
            </div>
          </div>

          {/* Active 3D Component Rendering */}
          <div className="transition-all duration-300">
            {active3DTab === 'cardiac' && (
              <HospitalCardiac3DVisualizer
                className="w-full shadow-2xl"
                onConsultDoctor={onOpenDoctorPortal}
              />
            )}

            {active3DTab === 'campus' && (
              <HospitalCampus3D
                className="w-full shadow-2xl"
                onNavigateMode={(targetMode) => {
                  if (targetMode === 'EMERGENCY') onOpenEmergencyPortal();
                  else if (targetMode === 'DOCTOR') onOpenDoctorPortal();
                  else if (targetMode === 'LAB') onOpenLabPortal();
                  else if (targetMode === 'PHARMACY') onOpenPharmacyPortal();
                  else if (targetMode === 'PATIENT') onOpenPatientWallet();
                }}
              />
            )}

            {active3DTab === 'smartcard' && (
              <div className="rounded-3xl bg-gradient-to-br from-[#06121E] via-[#091D34] to-[#0A1B2E] border-2 border-teal-500/30 p-8 shadow-2xl text-center flex flex-col items-center justify-center min-h-[460px]">
                <div className="max-w-md space-y-2 mb-6">
                  <span className="text-xs font-black uppercase tracking-wider text-teal-300">
                    Holographic Citizen Pass
                  </span>
                  <h3 className="text-xl font-extrabold text-white">
                    Tamper-Evident Physical & Digital Identity
                  </h3>
                  <p className="text-xs text-slate-400">
                    Hover and move your mouse to inspect 3D perspective depth, micro-etched chip refraction, and encrypted QR matrix. Click card to flip.
                  </p>
                </div>

                <ThreeHealthCard3D
                  patientName="Ananya Rao"
                  healthPassId="HP-PAT-0417"
                  bloodGroup="O+"
                  age={32}
                  gender="Female"
                  allergies={['Sulfa Drugs (Sulfonamides)']}
                  emergencyContact="+91 98480 22334"
                  className="w-full"
                />

                <div className="mt-6 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onOpenPatientWallet}
                    className="clay-btn-primary px-5 py-2 text-xs font-bold rounded-xl shadow-md cursor-pointer"
                  >
                    Open Active Patient Wallet
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenCreateAccount('patient')}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 cursor-pointer"
                  >
                    Generate New ABHA HealthPass
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
