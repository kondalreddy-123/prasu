import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, Sparkles, AlertTriangle, Heart, Phone, RotateCw, CheckCircle, Award } from 'lucide-react';

interface ThreeHealthCard3DProps {
  patientName: string;
  healthPassId: string;
  bloodGroup: string;
  age?: number;
  gender?: string;
  allergies?: string[];
  emergencyContact?: string;
  qrPayload?: string;
  className?: string;
}

export const ThreeHealthCard3D: React.FC<ThreeHealthCard3DProps> = ({
  patientName,
  healthPassId,
  bloodGroup,
  age = 32,
  gender = 'Female',
  allergies = ['Penicillin', 'Sulfa Drugs'],
  emergencyContact = '+91 98765 43210',
  qrPayload,
  className = '',
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = ((y - centerY) / centerY) * -14;
    const rotY = ((x - centerX) / centerX) * 14;

    setRotateX(rotX);
    setRotateY(rotY);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
  };

  const codeValue = qrPayload || `HEALTHPASS:ID=${healthPassId}&NAME=${encodeURIComponent(patientName)}&BG=${bloodGroup}`;

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* 3D Perspective Card Container */}
      <div
        className="w-full max-w-[420px] h-[250px] perspective-1000 cursor-pointer"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div
          className="relative w-full h-full rounded-3xl transition-transform duration-500 preserve-3d shadow-2xl"
          style={{
            transform: `rotateX(${rotateX}deg) rotateY(${rotateY + (isFlipped ? 180 : 0)}deg) ${
              isHovered ? 'scale(1.02)' : 'scale(1)'
            }`,
          }}
        >
          {/* ================= CARD FRONT ================= */}
          <div
            className="absolute inset-0 w-full h-full rounded-3xl p-6 text-white overflow-hidden backface-hidden border border-white/20"
            style={{
              background: 'linear-gradient(135deg, #094C55 0%, #0E7C86 45%, #1769AA 100%)',
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.4), 0 20px 35px -10px rgba(14,124,134,0.4)',
            }}
          >
            {/* Holographic Security Grid Overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff18_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

            {/* Light glare sheen */}
            <div className="hologram-shimmer" />

            {/* Card Header */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center text-teal-200 shadow-inner">
                  <Shield className="w-5 h-5 text-teal-300" />
                </div>
                <div>
                  <div className="text-[10px] font-black tracking-widest text-teal-200 uppercase">
                    BHARAT DIGITAL HEALTH
                  </div>
                  <div className="text-sm font-black tracking-tight flex items-center gap-1.5">
                    <span>Universal HealthPass</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Smart Card Golden Biometric Chip */}
              <div className="w-11 h-8 rounded-lg bg-gradient-to-tr from-amber-300 via-yellow-200 to-amber-500 p-1 border border-amber-600/40 shadow-sm flex flex-col justify-between">
                <div className="w-full h-0.5 bg-amber-700/30 rounded-full" />
                <div className="flex justify-between items-center px-0.5">
                  <div className="w-2 h-2 rounded-full border border-amber-800/40" />
                  <div className="w-2 h-2 rounded-full border border-amber-800/40" />
                </div>
                <div className="w-full h-0.5 bg-amber-700/30 rounded-full" />
              </div>
            </div>

            {/* Card Body with Name and QR Pass */}
            <div className="relative z-10 flex items-end justify-between mt-4">
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-teal-200/90 tracking-wider">
                  Verified Identity
                </div>
                <div className="text-xl font-black tracking-tight text-white drop-shadow-sm">
                  {patientName}
                </div>
                <div className="text-xs font-mono font-semibold tracking-wider text-teal-100 bg-white/10 px-2 py-0.5 rounded-md inline-block border border-white/20">
                  {healthPassId}
                </div>
                <div className="text-[11px] text-teal-100/90 font-medium pt-1">
                  {age} Yrs · {gender} · Blood <span className="font-extrabold text-white bg-red-600/80 px-1.5 py-0.5 rounded text-[10px]">{bloodGroup}</span>
                </div>
              </div>

              {/* Miniature Interactive Offline QR Pass */}
              <div className="p-2 rounded-2xl bg-white shadow-lg border border-teal-100 flex flex-col items-center">
                <QRCodeSVG value={codeValue} size={64} level="M" />
                <span className="text-[8px] font-black text-slate-700 mt-1 uppercase tracking-wider">
                  SCAN FOR CONSENT
                </span>
              </div>
            </div>

            {/* Card Footer */}
            <div className="relative z-10 flex items-center justify-between pt-3 mt-3 border-t border-white/15 text-[10px] text-teal-100/80">
              <span className="flex items-center gap-1 font-semibold">
                <CheckCircle className="w-3 h-3 text-emerald-400" />
                NDHM / ABHA Compliant
              </span>
              <span className="flex items-center gap-1 text-teal-200 hover:text-white transition-colors">
                <RotateCw className="w-3 h-3" />
                Click to flip for emergency pass
              </span>
            </div>
          </div>

          {/* ================= CARD BACK (EMERGENCY PASS) ================= */}
          <div
            className="absolute inset-0 w-full h-full rounded-3xl p-6 text-slate-800 overflow-hidden backface-hidden border border-red-200"
            style={{
              background: 'linear-gradient(135deg, #FFF5F5 0%, #FFFFFF 50%, #FEE2E2 100%)',
              transform: 'rotateY(180deg)',
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.8), 0 20px 35px -10px rgba(220,38,38,0.25)',
            }}
          >
            {/* Red Alert Header Stripe */}
            <div className="flex items-center justify-between border-b border-red-200 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center font-black">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-black tracking-wider text-red-600 uppercase">
                    FIRST RESPONDER PROTOCOL
                  </div>
                  <div className="text-xs font-black text-slate-900">
                    Offline Emergency Critical Pass
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-red-100 border border-red-300 text-[10px] font-black text-red-700">
                BLOOD {bloodGroup}
              </span>
            </div>

            {/* Critical Biometrics & Allergies */}
            <div className="grid grid-cols-2 gap-3 py-3 text-xs">
              <div className="space-y-1 bg-white/80 p-2.5 rounded-xl border border-red-100">
                <span className="text-[10px] font-bold text-red-600 uppercase flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Known Allergies
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {allergies.length > 0 ? (
                    allergies.map((alg, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-bold text-[10px] border border-red-200">
                        {alg}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500 text-[10px]">No documented allergies</span>
                  )}
                </div>
              </div>

              <div className="space-y-1 bg-white/80 p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1">
                  <Phone className="w-3 h-3 text-[#0E7C86]" />
                  Emergency Contact
                </span>
                <div className="font-mono font-bold text-slate-900 text-[11px] mt-1">
                  {emergencyContact}
                </div>
                <div className="text-[9px] text-slate-500">Next of Kin · Kinship Verified</div>
              </div>
            </div>

            {/* Bottom Disclaimer */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3 text-red-500 fill-red-500" />
                Organ Donor: Registered
              </span>
              <span className="flex items-center gap-1 text-[#0E7C86] font-semibold">
                <RotateCw className="w-3 h-3" />
                Click to return
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Helper Text */}
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 font-medium">
        <Sparkles className="w-3.5 h-3.5 text-[#0E7C86]" />
        <span>Move cursor to tilt in 3D · Click card to flip between Front Pass and Emergency Pass</span>
      </div>
    </div>
  );
};
