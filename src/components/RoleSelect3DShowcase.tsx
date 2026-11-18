import React, { useState } from 'react';
import { Stethoscope, Pill, FlaskConical, User, ShieldCheck, ArrowRight, Sparkles, CheckCircle2, Zap, Users } from 'lucide-react';
import { ThreeRoleCanvas, RoleType } from './ThreeRoleCanvas';

interface RoleSelect3DShowcaseProps {
  onSelectRole: (role: RoleType, mode: 'register' | 'login') => void;
  onQuickDemoLaunch?: (role: RoleType) => void;
  className?: string;
}

interface RoleCardData {
  id: RoleType;
  title: string;
  badge: string;
  badgeColor: string;
  icon: any;
  themeColor: string;
  accentBg: string;
  borderHover: string;
  ringColor: string;
  description: string;
  keyFeatures: string[];
  regulationTag: string;
  demoLabel: string;
}

const ROLES: RoleCardData[] = [
  {
    id: 'patient',
    title: 'Patient Health Wallet',
    badge: 'UNIVERSAL CITIZEN PASS',
    badgeColor: 'text-[#0E7C86] bg-[#0E7C86]/10 border-[#0E7C86]/30',
    icon: User,
    themeColor: '#0E7C86',
    accentBg: 'from-[#0E7C86]/10 to-teal-500/5',
    borderHover: 'hover:border-[#0E7C86]',
    ringColor: 'hover:shadow-[0_20px_40px_-15px_rgba(14,124,134,0.3)]',
    description: 'Universal digital health wallet with offline emergency QR code, full records ownership, and granular doctor consent control.',
    keyFeatures: [
      'Encrypted ABHA ID & Offline Emergency Pass',
      'One-tap time-bound consent approval',
      'Lifetime digital prescriptions & lab reports',
      'Emergency blood group & allergy beacon',
    ],
    regulationTag: 'ABHA & NDHM Compliant',
    demoLabel: 'Demo Patient',
  },
  {
    id: 'doctor',
    title: 'Doctor Practice Portal',
    badge: 'CLINICAL PRACTITIONER',
    badgeColor: 'text-[#1769AA] bg-[#1769AA]/10 border-[#1769AA]/30',
    icon: Stethoscope,
    themeColor: '#1769AA',
    accentBg: 'from-[#1769AA]/10 to-blue-500/5',
    borderHover: 'hover:border-[#1769AA]',
    ringColor: 'hover:shadow-[0_20px_40px_-15px_rgba(23,105,170,0.3)]',
    description: 'Accredited clinical workbench to inspect patient medical records via consent QR, check drug allergies, and author digital e-prescriptions.',
    keyFeatures: [
      'Instant patient history via OTP / QR consent',
      'Real-time drug allergy & interaction alerts',
      'Generic medicine prescription generator',
      'Integrated diagnostic lab order dispatch',
    ],
    regulationTag: 'MCI / NMC Accredited',
    demoLabel: 'Demo Doctor',
  },
  {
    id: 'pharmacy',
    title: 'Jan Aushadhi Pharmacy',
    badge: 'GENERIC MEDICINE DISPENSER',
    badgeColor: 'text-[#1E8E5A] bg-[#1E8E5A]/10 border-[#1E8E5A]/30',
    icon: Pill,
    themeColor: '#1E8E5A',
    accentBg: 'from-[#1E8E5A]/10 to-emerald-500/5',
    borderHover: 'hover:border-[#1E8E5A]',
    ringColor: 'hover:shadow-[0_20px_40px_-15px_rgba(30,142,90,0.3)]',
    description: 'Verify digital prescriptions in seconds with zero patient privacy leak, dispense subsidized generic medicines, and track inventory.',
    keyFeatures: [
      'Cryptographic prescription verification',
      'Direct Jan Aushadhi generic substitution',
      'Up to 80% patient cost savings calculator',
      'Zero clinical leak: shows only required meds',
    ],
    regulationTag: 'PMBI Jan Aushadhi Licensed',
    demoLabel: 'Demo Pharmacist',
  },
  {
    id: 'lab',
    title: 'Diagnostic Pathology Lab',
    badge: 'NABL PATHOLOGY & IMAGING',
    badgeColor: 'text-[#7C3AED] bg-[#7C3AED]/10 border-[#7C3AED]/30',
    icon: FlaskConical,
    themeColor: '#7C3AED',
    accentBg: 'from-[#7C3AED]/10 to-purple-500/5',
    borderHover: 'hover:border-[#7C3AED]',
    ringColor: 'hover:shadow-[0_20px_40px_-15px_rgba(124,58,237,0.3)]',
    description: 'Access authorized diagnostic test orders, upload structured lab test values, and deliver tamper-evident reports straight to patient passes.',
    keyFeatures: [
      'Digital test requisitions from doctors',
      'Direct NABL-grade blood & pathology uploader',
      'Automated normal range & flag highlighting',
      'Voice read-aloud AI patient summary ready',
    ],
    regulationTag: 'NABL ISO 15189 Certified',
    demoLabel: 'Demo Lab',
  },
  {
    id: 'caregiver',
    title: 'Caregiver Assisted Portal',
    badge: 'FAMILY & HEALTH WORKER',
    badgeColor: 'text-[#4F46E5] bg-[#4F46E5]/10 border-[#4F46E5]/30',
    icon: Users,
    themeColor: '#4F46E5',
    accentBg: 'from-[#4F46E5]/10 to-indigo-500/5',
    borderHover: 'hover:border-[#4F46E5]',
    ringColor: 'hover:shadow-[0_20px_40px_-15px_rgba(79,70,229,0.3)]',
    description: 'Assist elderly or dependent family members with medicine reminders, appointment tracking, and verified record uploads under patient consent.',
    keyFeatures: [
      'Patient-authorized assisted care links',
      'Daily medication dose confirmation',
      'Doctor appointment & lab follow-up alerts',
      'Assisted document capture & camera upload',
    ],
    regulationTag: 'Patient-Controlled Consent',
    demoLabel: 'Demo Caregiver',
  },
];

export const RoleSelect3DShowcase: React.FC<RoleSelect3DShowcaseProps> = ({
  onSelectRole,
  onQuickDemoLaunch,
  className = '',
}) => {
  const [hoveredRole, setHoveredRole] = useState<RoleType | null>(null);

  return (
    <section className={`relative w-full py-12 px-4 sm:px-6 lg:px-8 overflow-hidden ${className}`}>
      {/* 3D Cybernetic Ambient Gradient Lighting */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-[#0E7C86]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-[#7C3AED]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-10 relative z-10">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#DDE7EA] shadow-xs text-xs font-bold text-[#0E7C86]">
            <Sparkles className="w-4 h-4 text-[#0E7C86] animate-pulse" />
            <span className="tracking-wide uppercase">Unified Healthcare Ecosystem</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#1E8E5A]" />
            <span className="text-[#5B6B7A] font-medium">Open Registration for All Roles</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1F2D3D] tracking-tight">
            Select Your Role & Join HealthPass in 3D
          </h2>

          <p className="text-sm sm:text-base text-[#5B6B7A] leading-relaxed">
            Whether you are a patient managing care, a doctor treating patients, a pharmacist dispensing generic meds,
            or a diagnostic lab delivering pathology results — create your dedicated account with 1-click.
          </p>
        </div>

        {/* 4 Interactive 3D Role Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {ROLES.map((role) => {
            const isHovered = hoveredRole === role.id;
            const Icon = role.icon;

            return (
              <div
                key={role.id}
                onMouseEnter={() => setHoveredRole(role.id)}
                onMouseLeave={() => setHoveredRole(null)}
                className={`clay-card group relative flex flex-col justify-between p-6 rounded-3xl border border-[#DDE7EA] bg-white/95 backdrop-blur-md transition-all duration-300 card-3d-tilt ${role.borderHover} ${role.ringColor} overflow-hidden`}
              >
                {/* Subtle Dynamic Ambient Gradient */}
                <div
                  className={`absolute inset-0 bg-gradient-to-b ${role.accentBg} opacity-40 group-hover:opacity-100 transition-opacity pointer-events-none`}
                />

                {/* Holographic light sheen reflection */}
                <div className="hologram-shimmer" />

                <div className="relative z-10 space-y-4">
                  {/* Badge & Icon Row */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${role.badgeColor}`}
                    >
                      {role.badge}
                    </span>
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-110 group-hover:rotate-6"
                      style={{ backgroundColor: role.themeColor }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  {/* 3D Interactive WebGL Model Visual */}
                  <div className="flex items-center justify-center py-2 relative">
                    <div className="relative flex items-center justify-center w-[160px] h-[160px] rounded-2xl bg-gradient-to-b from-slate-50 to-white/60 border border-slate-100/80 shadow-inner group-hover:shadow-md transition-shadow">
                      <ThreeRoleCanvas
                        role={role.id}
                        size={150}
                        interactive={true}
                        className="transition-transform duration-300 group-hover:scale-105"
                      />
                      {/* Interactive 3D Orbit Badge */}
                      <div className="absolute bottom-1 px-2 py-0.5 rounded-full bg-white/80 backdrop-blur-xs border border-slate-200 text-[9px] font-bold text-slate-500 shadow-xs pointer-events-none flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping" />
                        <span>Interactive 3D</span>
                      </div>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-xl font-bold text-[#1F2D3D] group-hover:text-[#0E7C86] transition-colors">
                      {role.title}
                    </h3>
                    <p className="text-xs text-[#5B6B7A] mt-1.5 leading-relaxed line-clamp-3">
                      {role.description}
                    </p>
                  </div>

                  {/* Key Capabilities List */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    {role.keyFeatures.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[11px] text-[#455468]">
                        <CheckCircle2
                          className="w-3.5 h-3.5 shrink-0 mt-0.5"
                          style={{ color: role.themeColor }}
                        />
                        <span className="leading-tight">{feat}</span>
                      </div>
                    ))}
                  </div>

                  {/* Accreditation Tag */}
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{role.regulationTag}</span>
                  </div>
                </div>

                {/* Call to Actions */}
                <div className="relative z-10 space-y-2 pt-4 mt-4 border-t border-slate-100">
                  {/* Primary Create Account Button */}
                  <button
                    type="button"
                    onClick={() => onSelectRole(role.id, 'register')}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl text-white text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-2 shadow-md hover:brightness-110 active:scale-98 transition-all group-hover:shadow-lg"
                    style={{ backgroundColor: role.themeColor }}
                  >
                    <span>Create {role.id === 'patient' ? 'Patient' : role.id === 'doctor' ? 'Doctor' : role.id === 'pharmacy' ? 'Pharmacist' : 'Lab'} Account</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>

                  {/* Secondary Sign In and Quick Demo Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onSelectRole(role.id, 'login')}
                      className="text-center py-1.5 px-2 rounded-lg text-[11px] font-bold text-slate-600 hover:text-[#0E7C86] bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                    >
                      Sign In
                    </button>

                    {onQuickDemoLaunch && (
                      <button
                        type="button"
                        onClick={() => onQuickDemoLaunch(role.id)}
                        className="text-center py-1.5 px-2 rounded-lg text-[11px] font-bold text-[#0E7C86] hover:text-[#0A626A] bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors cursor-pointer inline-flex items-center justify-center gap-1"
                      >
                        <Zap className="w-3 h-3 text-amber-500" />
                        <span>Instant Demo</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
