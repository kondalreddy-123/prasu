import React, { useState } from 'react';
import {
  Activity,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Heart,
  Layers,
  MapPin,
  Phone,
  Shield,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  User,
  Users,
  ArrowRight,
  FileText,
  BadgeCheck,
} from 'lucide-react';
import { SupportedLang, tr } from '../i18n/translations.ts';

interface Department {
  id: string;
  name: string;
  category: string;
  headOfDept: string;
  degrees: string;
  opdHours: string;
  icon: any;
  color: string;
  badge: string;
  stats: string;
  keyProcedures: string[];
  description: string;
}

const DEPARTMENTS: Department[] = [
  {
    id: 'cardiology',
    name: 'Institute of Cardiac Sciences',
    category: 'Heart & Vascular',
    headOfDept: 'Dr. Priya Sharma',
    degrees: 'MBBS, MD, DM (Cardiology), FACC',
    opdHours: 'Mon - Sat: 09:00 - 16:00 (Room 204)',
    icon: Heart,
    color: 'from-rose-500/10 to-rose-50/40 border-rose-200 text-rose-600',
    badge: 'Cath Lab Active 24/7',
    stats: 'Door-to-balloon time: 38 mins (Benchmark < 90 min)',
    keyProcedures: [
      'Primary Percutaneous Coronary Intervention (PCI / Angioplasty)',
      'Fractional Flow Reserve (FFR) & IVUS Imaging',
      'Dual Chamber Pacemaker & ICD Implantation',
      'Comprehensive 3D Echocardiography & Stress Testing',
    ],
    description: 'Tertiary cardiovascular care offering rapid acute myocardial infarction intervention, complex coronary stenting, and telemetry-guided recovery.',
  },
  {
    id: 'trauma',
    name: 'Emergency Medicine & Level-1 Trauma',
    category: 'Critical Care',
    headOfDept: 'Dr. Vikram Rao',
    degrees: 'MBBS, MD (Emergency Medicine), FACEM',
    opdHours: 'Open 24 Hours / 365 Days (Emergency Bay A)',
    icon: ShieldAlert,
    color: 'from-red-500/10 to-red-50/40 border-red-200 text-red-600',
    badge: 'Zero-Wait Triage',
    stats: '3.4 min average patient triage response',
    keyProcedures: [
      'Advanced Cardiac Life Support (ACLS) & Rapid Resuscitation',
      'Emergency Endotracheal Airway & Ventilator Management',
      'Polytrauma Damage Control & Emergency Chest Tube Thoracostomy',
      'Anonymous Emergency Triage & Post-Stabilization Record Linking',
    ],
    description: 'Round-the-clock emergency department equipped with dedicated trauma CT, resuscitation bays, and emergency surgical teams on continuous standby.',
  },
  {
    id: 'neurology',
    name: 'Neurosciences & Comprehensive Stroke Unit',
    category: 'Brain & Spine',
    headOfDept: 'Dr. Rahul Verma',
    degrees: 'MBBS, MD, DM (Neurology)',
    opdHours: 'Mon - Fri: 10:00 - 15:30 (Room 312)',
    icon: Activity,
    color: 'from-sky-500/10 to-sky-50/40 border-sky-200 text-sky-600',
    badge: 'Certified Stroke Center',
    stats: 'Thrombolysis window: < 45 min door-to-needle',
    keyProcedures: [
      'Intravenous Thrombolytic Therapy for Acute Ischaemic Stroke',
      'Video-Telemetry Long-Term EEG Monitoring for Epilepsy',
      'Electromyography (EMG) & Nerve Conduction Studies (NCS)',
      'Neuromuscular Disorder & Parkinsonian Movement Clinics',
    ],
    description: 'Specialized neuro-intensive care focusing on acute stroke thrombolysis, epilepsy profiling, and neuro-rehabilitation.',
  },
  {
    id: 'diagnostics',
    name: 'NABL Pathology & Molecular Genomics',
    category: 'Diagnostic Services',
    headOfDept: 'Dr. Sunita Patil',
    degrees: 'MBBS, MD (Pathology), Cert. Clinical Genomics',
    opdHours: 'Mon - Sun: 07:00 - 21:00 (Central Lab)',
    icon: Award,
    color: 'from-purple-500/10 to-purple-50/40 border-purple-200 text-purple-600',
    badge: 'NABL ISO 15189 Certified',
    stats: '99.8% Automated Analyzer Accuracy',
    keyProcedures: [
      'Fully Automated Clinical Chemistry & Immunoassay Panels',
      'Digital Hematology with Five-Part Differential & Peripheral Smear',
      'Cryptographic SHA-256 Tamper-Evident Report Digitization',
      'Real-Time Molecular RT-PCR & Antimicrobial Sensitivity Testing',
    ],
    description: 'NABL accredited diagnostic center delivering rapid, verified digital pathology reports directly into the patient HealthPass wallet.',
  },
];

interface Props {
  lang?: SupportedLang;
  onSelectDoctorPortal: () => void;
  onSelectPatientPortal: () => void;
}

export const HospitalDepartmentsShowcase: React.FC<Props> = ({
  lang = 'EN',
  onSelectDoctorPortal,
  onSelectPatientPortal,
}) => {
  const [selectedDept, setSelectedDept] = useState<Department>(DEPARTMENTS[0]);

  return (
    <section className="space-y-6 rounded-3xl bg-white/95 p-6 sm:p-8 backdrop-blur-xl border border-slate-200/90 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-[#0E7C86] text-xs font-bold mb-1">
            <Stethoscope className="w-3.5 h-3.5" />
            <span>Clinical Excellence & Specialties</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Hospital Specialized Care Departments
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            World-class medical departments staffed by board-certified clinical professors and supported by digital HealthPass records.
          </p>
        </div>

        <button
          type="button"
          onClick={onSelectDoctorPortal}
          className="clay-btn-primary px-4 py-2 text-xs font-bold inline-flex items-center gap-2 rounded-xl shadow-sm self-start sm:self-center cursor-pointer hover:scale-105 transition-transform"
        >
          <Calendar className="w-4 h-4" />
          <span>{tr('doctorPortal', lang)}</span>
        </button>
      </div>

      {/* Department Tabs & Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left List of Departments */}
        <div className="lg:col-span-5 space-y-2.5">
          {DEPARTMENTS.map((dept) => {
            const isSelected = selectedDept.id === dept.id;
            return (
              <button
                key={dept.id}
                type="button"
                onClick={() => setSelectedDept(dept)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'border-[#0E7C86] bg-gradient-to-r from-teal-50/80 to-white shadow-md ring-2 ring-[#0E7C86]/30'
                    : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/70'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      isSelected ? 'bg-[#0E7C86] text-white border-[#0E7C86]' : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    <dept.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 truncate">{dept.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      Head: {dept.headOfDept} · {dept.category}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-[#0E7C86]">
                    {dept.badge}
                  </span>
                  <ArrowRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-[#0E7C86] translate-x-1' : 'text-slate-300'}`} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Active Department Comprehensive Detail */}
        <div className="lg:col-span-7 rounded-2xl border-2 border-teal-100 bg-gradient-to-br from-white via-teal-50/20 to-slate-50 p-6 space-y-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-100 text-[#0E7C86] border border-teal-200">
                {selectedDept.category}
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-1">{selectedDept.name}</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {selectedDept.description}
              </p>
            </div>
          </div>

          {/* Department Head & OPD Schedule */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Department Director
              </span>
              <div className="text-sm font-extrabold text-slate-900">{selectedDept.headOfDept}</div>
              <div className="text-[11px] text-teal-700 font-semibold">{selectedDept.degrees}</div>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Outpatient Timings & Location
              </span>
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-600" />
                <span>{selectedDept.opdHours}</span>
              </div>
              <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>{selectedDept.stats}</span>
              </div>
            </div>
          </div>

          {/* Key Clinical Procedures */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <BadgeCheck className="w-4 h-4 text-[#0E7C86]" />
              <span>Standard Clinical Interventions & Protocols</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {selectedDept.keyProcedures.map((proc, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-xs text-slate-700 flex items-start gap-2 shadow-2xs"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                  <span className="leading-snug">{proc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Shield className="w-4 h-4 text-[#0E7C86]" />
              <span>All consultations automatically issue HL7 FHIR structured e-prescriptions</span>
            </div>

            <button
              type="button"
              onClick={onSelectDoctorPortal}
              className="clay-btn-primary px-4 py-2 text-xs font-bold rounded-xl shadow-sm inline-flex items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform"
            >
              <span>Consult with {selectedDept.headOfDept.split(' ')[1] || 'Doctor'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
