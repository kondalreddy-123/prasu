import React, { useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  FileCheck,
  FileText,
  Filter,
  Flame,
  Heart,
  HelpCircle,
  Layers,
  Lock,
  Pill,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Tag,
  User,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import { SupportedLang, tr, translateUiPhrase } from '../i18n/translations.ts';

export interface FastOrderTemplate {
  id: string;
  title: string;
  category: string;
  icdCode: string;
  indication: string;
  medicines: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
  }>;
  labOrders: string[];
  lifestyleAdvice: string;
}

export const FAST_ORDER_PROTOCOLS: FastOrderTemplate[] = [
  {
    id: 't2d_protocol',
    title: 'Type 2 Diabetes Mellitus Protocol',
    category: 'Endocrinology & Diabetes',
    icdCode: 'E11.9',
    indication: 'Non-insulin dependent diabetes mellitus, glycemic maintenance',
    medicines: [
      {
        name: 'Metformin Hydrochloride (Prolonged Release)',
        dosage: '500 mg',
        frequency: 'Twice daily (BD)',
        duration: '90 days',
        instructions: 'Take immediately with or after meals to minimize gastrointestinal upset.',
      },
    ],
    labOrders: ['Glycated Hemoglobin (HbA1c) in 90 days', 'Comprehensive Metabolic Panel (CMP) with eGFR', 'Urine Microalbumin/Creatinine Ratio'],
    lifestyleAdvice: 'Low glycemic index diet. Limit refined sugars. 150 min/week moderate aerobic exercise.',
  },
  {
    id: 'htn_protocol',
    title: 'Essential Hypertension Standard Regimen',
    category: 'Cardiology',
    icdCode: 'I10',
    indication: 'Essential (primary) hypertension, Stage 1/2 control',
    medicines: [
      {
        name: 'Telmisartan Tablets IP',
        dosage: '40 mg',
        frequency: 'Once daily (OD) in morning',
        duration: '90 days',
        instructions: 'Take consistently at the same hour each morning. Monitor for postural dizziness.',
      },
    ],
    labOrders: ['Serum Electrolytes (Potassium & Sodium)', 'Serum Creatinine & eGFR at 4 weeks', 'Lipid Profile fasting'],
    lifestyleAdvice: 'DASH diet with dietary sodium < 2,000 mg/day (< 5g salt). Routine home BP logging.',
  },
  {
    id: 'cad_secondary_protocol',
    title: 'Post-PCI / CAD Secondary Prevention',
    category: 'Cardiology',
    icdCode: 'I25.10',
    indication: 'Coronary artery disease, post-stent / revascularization prophylaxis',
    medicines: [
      {
        name: 'Aspirin (Gastro-resistant)',
        dosage: '75 mg',
        frequency: 'Once daily (OD)',
        duration: '180 days',
        instructions: 'Take after principal meal. Do not crush.',
      },
      {
        name: 'Atorvastatin Tablets',
        dosage: '40 mg',
        frequency: 'Once daily (OD) at bedtime',
        duration: '90 days',
        instructions: 'Target LDL < 55 mg/dL. Report unexplained muscle soreness.',
      },
      {
        name: 'Metoprolol Succinate Prolonged Release',
        dosage: '25 mg',
        frequency: 'Once daily (OD)',
        duration: '90 days',
        instructions: 'Heart rate target 55-65 bpm resting. Do not discontinue abruptly.',
      },
    ],
    labOrders: ['Lipid Profile at 6 weeks', 'Liver Function Enzymes (AST/ALT)', '12-Lead ECG at 3 months'],
    lifestyleAdvice: 'Cardiac rehabilitation guidelines. Strict smoking cessation. Mediterranean diet.',
  },
  {
    id: 'uri_stewardship_protocol',
    title: 'Acute Viral URI (Antimicrobial Stewardship)',
    category: 'General Medicine',
    icdCode: 'J06.9',
    indication: 'Acute upper respiratory tract infection, viral etiology (no antibiotics indicated)',
    medicines: [
      {
        name: 'Paracetamol Tablets IP',
        dosage: '650 mg',
        frequency: 'Every 6 to 8 hours as needed (SOS)',
        duration: '5 days',
        instructions: 'Take for fever > 100°F or body aches. Maximum 3,000 mg in 24 hours.',
      },
      {
        name: 'Normal Saline Nasal Spray (0.9% NaCl)',
        dosage: '2 sprays each nostril',
        frequency: 'Three times daily (TDS)',
        duration: '7 days',
        instructions: 'Symptomatic nasal decongestion without rebound rhinitis.',
      },
    ],
    labOrders: ['CBC only if high fever persists > 5 days', 'Chest X-Ray if dyspnea or hemoptysis arises'],
    lifestyleAdvice: 'Warm fluids, honey-ginger hydration, steam inhalation. Antimicrobial stewardship: antibiotics avoid unnecessary resistance.',
  },
];

export interface IcdCodeItem {
  code: string;
  name: string;
  chapter: string;
  category: string;
}

export const ICD10_DATABASE: IcdCodeItem[] = [
  { code: 'E11.9', name: 'Type 2 diabetes mellitus without complications', chapter: 'Endocrine & Metabolic', category: 'Diabetes' },
  { code: 'E11.22', name: 'Type 2 diabetes mellitus with diabetic chronic kidney disease', chapter: 'Endocrine & Metabolic', category: 'Diabetes' },
  { code: 'I10', name: 'Essential (primary) hypertension', chapter: 'Circulatory', category: 'Cardiovascular' },
  { code: 'I25.10', name: 'Atherosclerotic heart disease of native coronary artery', chapter: 'Circulatory', category: 'Cardiovascular' },
  { code: 'I20.9', name: 'Angina pectoris, unspecified', chapter: 'Circulatory', category: 'Cardiovascular' },
  { code: 'I48.91', name: 'Unspecified atrial fibrillation', chapter: 'Circulatory', category: 'Cardiovascular' },
  { code: 'J06.9', name: 'Acute upper respiratory infection, unspecified', chapter: 'Respiratory', category: 'Infectious' },
  { code: 'J45.909', name: 'Unspecified asthma, uncomplicated', chapter: 'Respiratory', category: 'Pulmonary' },
  { code: 'J20.9', name: 'Acute bronchitis, unspecified', chapter: 'Respiratory', category: 'Pulmonary' },
  { code: 'K21.9', name: 'Gastro-esophageal reflux disease without esophagitis', chapter: 'Digestive', category: 'Gastroenterology' },
  { code: 'K29.70', name: 'Gastritis, unspecified, without bleeding', chapter: 'Digestive', category: 'Gastroenterology' },
  { code: 'M54.5', name: 'Low back pain / lumbago', chapter: 'Musculoskeletal', category: 'Orthopaedics' },
  { code: 'M17.9', name: 'Osteoarthritis of knee, unspecified', chapter: 'Musculoskeletal', category: 'Orthopaedics' },
  { code: 'N39.0', name: 'Urinary tract infection, site not specified', chapter: 'Genitourinary', category: 'Nephrology' },
  { code: 'G43.909', name: 'Migraine, unspecified, not intractable', chapter: 'Nervous System', category: 'Neurology' },
  { code: 'R05', name: 'Cough, unspecified', chapter: 'Symptoms & Signs', category: 'General' },
  { code: 'R50.9', name: 'Fever, unspecified', chapter: 'Symptoms & Signs', category: 'General' },
];

export interface QueuePatient {
  id: string;
  tokenNumber: number;
  name: string;
  age: number;
  gender: string;
  healthPassId: string;
  triageLevel: 1 | 2 | 3 | 4;
  triageLabel: 'Emergency' | 'Emergent' | 'Urgent' | 'Routine';
  chiefComplaint: string;
  vitals: {
    bp: string;
    pulse: number;
    spo2: number;
    temp: string;
  };
  waitTimeMins: number;
  status: 'WAITING' | 'IN_CABIN' | 'COMPLETED';
}

export const OPD_QUEUE: QueuePatient[] = [
  {
    id: 'pat-1',
    tokenNumber: 104,
    name: 'Ananya Rao',
    age: 32,
    gender: 'Female',
    healthPassId: 'HP-PAT-0417',
    triageLevel: 3,
    triageLabel: 'Urgent',
    chiefComplaint: 'Follow-up Type-2 Diabetes & Mild Hypertension; HbA1c review',
    vitals: { bp: '124/82 mmHg', pulse: 74, spo2: 99, temp: '98.4 °F' },
    waitTimeMins: 8,
    status: 'WAITING',
  },
  {
    id: 'pat-2',
    tokenNumber: 105,
    name: 'Aarav Kumar (Child)',
    age: 7,
    gender: 'Male',
    healthPassId: 'HP-CHILD-0892',
    triageLevel: 4,
    triageLabel: 'Routine',
    chiefComplaint: 'Pediatric allergic rhinitis & seasonal cough',
    vitals: { bp: '100/66 mmHg', pulse: 88, spo2: 100, temp: '98.6 °F' },
    waitTimeMins: 14,
    status: 'WAITING',
  },
  {
    id: 'pat-3',
    tokenNumber: 106,
    name: 'Lakshmi Narayana',
    age: 68,
    gender: 'Male',
    healthPassId: 'HP-ELDER-0931',
    triageLevel: 2,
    triageLabel: 'Emergent',
    chiefComplaint: 'Exertional chest tightness & shortness of breath; CAD follow-up',
    vitals: { bp: '138/88 mmHg', pulse: 82, spo2: 96, temp: '98.2 °F' },
    waitTimeMins: 4,
    status: 'WAITING',
  },
];

interface Props {
  doctorName?: string;
  facilityName?: string;
  patientName?: string;
  patientAllergies?: any[];
  lang?: SupportedLang;
  onSelectIcdCode?: (code: IcdCodeItem) => void;
  onApplyProtocol?: (template: FastOrderTemplate) => void;
  onCallPatient?: (patient: QueuePatient) => void;
  onQuickPrescription?: (med: any) => void;
}

export const DoctorClinicalWorkbench: React.FC<Props> = ({
  doctorName = 'Dr. Priya Sharma',
  facilityName = 'Apex Multispecialty Hospital',
  patientName = 'Ananya Rao',
  patientAllergies = [{ allergen: 'Sulfa Drugs (Sulfonamides)', severity: 'Severe' }],
  lang = 'EN',
  onSelectIcdCode,
  onApplyProtocol,
  onCallPatient,
  onQuickPrescription,
}) => {
  const [activeTab, setActiveTab] = useState<'cdss' | 'protocols' | 'icd10' | 'queue'>('cdss');
  const [drugInput, setDrugInput] = useState('');
  const [cdssResult, setCdssResult] = useState<{
    severity: 'SAFE' | 'WARNING' | 'CONTRAINDICATED';
    title: string;
    details: string;
    alternative?: string;
  } | null>(null);
  const [icdSearch, setIcdSearch] = useState('');
  const [queueState, setQueueState] = useState<QueuePatient[]>(OPD_QUEUE);
  const [activeCalledToken, setActiveCalledToken] = useState<number | null>(104);
  const [copiedProtocolId, setCopiedProtocolId] = useState<string | null>(null);

  // Check drug safety in CDSS engine
  const handleCheckDrugSafety = (testDrug?: string) => {
    const candidate = (testDrug || drugInput).trim().toLowerCase();
    if (!candidate) return;

    // Check Sulfa allergy cross-reactivity
    const hasSulfaAllergy = patientAllergies.some((a) =>
      /sulfa|sulfonamide|bactrim|septra/i.test(a.allergen || '')
    );

    if (
      hasSulfaAllergy &&
      (candidate.includes('sulfa') ||
        candidate.includes('bactrim') ||
        candidate.includes('septra') ||
        candidate.includes('cotrimoxazole') ||
        candidate.includes('sulfamethoxazole') ||
        candidate.includes('sulfasalazine'))
    ) {
      setCdssResult({
        severity: 'CONTRAINDICATED',
        title: 'CRITICAL ALLERGY CONTRAINDICATION (HIGH ALERT)',
        details: `Patient has a documented SEVERE allergy to Sulfa Drugs. Prescribing "${testDrug || drugInput}" poses an immediate risk of anaphylaxis or Stevens-Johnson syndrome (SJS).`,
        alternative: 'Recommended Safe Antibiotic: Amoxicillin-Clavulanate 625mg or Cefuroxime Axetil 500mg.',
      });
      return;
    }

    // Check Penicillin allergy
    const hasPenicillinAllergy = patientAllergies.some((a) =>
      /penicillin|amoxicillin|ampicillin/i.test(a.allergen || '')
    );
    if (
      hasPenicillinAllergy &&
      (candidate.includes('penicillin') ||
        candidate.includes('amoxicillin') ||
        candidate.includes('ampicillin') ||
        candidate.includes('augmentin'))
    ) {
      setCdssResult({
        severity: 'CONTRAINDICATED',
        title: 'CRITICAL PENICILLIN ALLERGY ALERT',
        details: `Patient has documented Penicillin hypersensitivity. Do not administer beta-lactam penicillins.`,
        alternative: 'Recommended Alternative: Azithromycin 500mg or Levofloxacin 500mg.',
      });
      return;
    }

    // Check Drug-Drug Interaction: Metformin + Contrast Dye
    if (candidate.includes('contrast') || candidate.includes('iodinated')) {
      setCdssResult({
        severity: 'WARNING',
        title: 'POTENTIAL DRUG-DRUG INTERACTION: Metformin + Contrast Dye',
        details: 'Patient is on daily Metformin 500mg. Intravascular iodinated contrast medium can cause acute renal failure and lactic acidosis. Withhold Metformin 48h before and after contrast injection.',
        alternative: 'Check baseline serum creatinine & eGFR prior to procedure.',
      });
      return;
    }

    // Check Drug-Drug Interaction: ACE-I + ARB
    if (candidate.includes('ramipril') || candidate.includes('enalapril') || candidate.includes('lisinopril')) {
      setCdssResult({
        severity: 'WARNING',
        title: 'DUAL RAAS BLOCKADE WARNING',
        details: 'Patient is currently prescribed Telmisartan (ARB). Combining an ACE Inhibitor with an ARB increases the risk of hyperkalemia, syncope, and renal impairment without additional benefit.',
        alternative: 'Continue monotherapy Telmisartan 40mg or add a Calcium Channel Blocker (Amlodipine 5mg).',
      });
      return;
    }

    // Safe
    setCdssResult({
      severity: 'SAFE',
      title: 'Safety Check Passed · No Direct Contraindications Detected',
      details: `"${testDrug || drugInput}" does not match documented patient allergies or high-risk contraindications in the active chart. Verify clinical renal dosing before signing.`,
    });
  };

  const filteredIcd = ICD10_DATABASE.filter(
    (item) =>
      item.code.toLowerCase().includes(icdSearch.toLowerCase()) ||
      item.name.toLowerCase().includes(icdSearch.toLowerCase()) ||
      item.category.toLowerCase().includes(icdSearch.toLowerCase())
  );

  const handleCallPatient = (p: QueuePatient) => {
    setActiveCalledToken(p.tokenNumber);
    setQueueState((prev) =>
      prev.map((item) =>
        item.id === p.id
          ? { ...item, status: 'IN_CABIN' }
          : item.status === 'IN_CABIN'
          ? { ...item, status: 'COMPLETED' }
          : item
      )
    );
    if (onCallPatient) {
      onCallPatient(p);
    }
  };

  const handleApplyProtocol = (template: FastOrderTemplate) => {
    setCopiedProtocolId(template.id);
    setTimeout(() => setCopiedProtocolId(null), 3000);
    if (onApplyProtocol) {
      onApplyProtocol(template);
    }
  };

  return (
    <div className="clay-card p-5 sm:p-6 space-y-6">
      {/* Workbench Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-[#0E7C86] text-xs font-bold uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5" />
            <span>Doctor Clinical Intelligence & CDSS Workbench</span>
          </div>
          <h3 className="text-xl font-bold text-slate-900 font-display mt-1">
            Clinical Tools for {patientName}
          </h3>
          <p className="text-xs text-slate-500">
            Real-time allergy cross-checks, one-click clinical order protocols, ICD-10 diagnostic coding, and live OPD triage queue.
          </p>
        </div>

        {/* Feature Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('cdss')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'cdss' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>CDSS & Safety</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('protocols')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'protocols' ? 'bg-white text-[#0E7C86] shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Fast Protocols</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('icd10')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'icd10' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>ICD-10 Coding</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'queue' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>OPD Triage ({queueState.length})</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: CLINICAL DECISION SUPPORT & ALLERGY CROSS-CHECKER           */}
      {/* =================================================================== */}
      {activeTab === 'cdss' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Drug-Allergy & Interaction Cross-Checker (CDSS Engine)</span>
              </h4>
              <span className="text-[11px] font-mono text-slate-500">
                Active Allergies: <strong className="text-rose-700">Sulfa Drugs (Sulfonamides)</strong>
              </span>
            </div>

            <p className="text-xs text-slate-600">
              Type or select a candidate drug to verify against patient allergy history and concurrent medications (Metformin, Telmisartan).
            </p>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={drugInput}
                  onChange={(e) => setDrugInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCheckDrugSafety();
                  }}
                  placeholder="Type drug name (e.g. Bactrim, Co-trimoxazole, Ramipril, Contrast dye, Paracetamol)..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0E7C86] bg-white font-medium"
                />
              </div>
              <button
                type="button"
                onClick={() => handleCheckDrugSafety()}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                Run Safety Check
              </button>
            </div>

            {/* Quick Test Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
              <span className="text-slate-400 font-semibold">Quick tests:</span>
              <button
                type="button"
                onClick={() => {
                  setDrugInput('Co-trimoxazole (Bactrim) 960mg');
                  handleCheckDrugSafety('Co-trimoxazole (Bactrim) 960mg');
                }}
                className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 hover:bg-rose-200 font-bold cursor-pointer transition-colors"
              >
                ⚡ Test Sulfa Drug (Co-trimoxazole)
              </button>
              <button
                type="button"
                onClick={() => {
                  setDrugInput('Ramipril 5mg (Dual RAAS)');
                  handleCheckDrugSafety('Ramipril 5mg (Dual RAAS)');
                }}
                className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 hover:bg-amber-200 font-bold cursor-pointer transition-colors"
              >
                ⚡ Test Dual RAAS (Ramipril + Telmisartan)
              </button>
              <button
                type="button"
                onClick={() => {
                  setDrugInput('Paracetamol 650mg');
                  handleCheckDrugSafety('Paracetamol 650mg');
                }}
                className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-bold cursor-pointer transition-colors"
              >
                ⚡ Test Safe Drug (Paracetamol)
              </button>
            </div>
          </div>

          {/* CDSS Safety Output Card */}
          {cdssResult && (
            <div
              className={`p-4 rounded-2xl border transition-all animate-fadeIn ${
                cdssResult.severity === 'CONTRAINDICATED'
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : cdssResult.severity === 'WARNING'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-900'
              }`}
            >
              <div className="flex items-start gap-3">
                {cdssResult.severity === 'CONTRAINDICATED' ? (
                  <AlertOctagon className="w-6 h-6 text-rose-600 shrink-0 mt-0.5 animate-bounce" />
                ) : cdssResult.severity === 'WARNING' ? (
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                )}

                <div className="space-y-1.5 flex-1">
                  <h5 className="text-sm font-extrabold tracking-tight">{cdssResult.title}</h5>
                  <p className="text-xs leading-relaxed">{cdssResult.details}</p>
                  {cdssResult.alternative && (
                    <div className="mt-2 p-2.5 rounded-xl bg-white/80 border border-slate-200 text-xs font-bold text-slate-800">
                      💡 {cdssResult.alternative}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: FAST-ORDER CLINICAL CARE PROTOCOLS                          */}
      {/* =================================================================== */}
      {activeTab === 'protocols' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            One-click clinical order sets designed for Indian tertiary and primary hospital practice. Applies medication, dosing instructions, lab panels, and lifestyle advice.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FAST_ORDER_PROTOCOLS.map((proto) => {
              const isCopied = copiedProtocolId === proto.id;
              return (
                <div
                  key={proto.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4.5 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0E7C86] bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                        {proto.category}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-500">ICD: {proto.icdCode}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">{proto.title}</h4>
                    <p className="text-xs text-slate-500">{proto.indication}</p>
                  </div>

                  {/* Medicines list */}
                  <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="font-bold text-[11px] text-slate-700 flex items-center gap-1.5">
                      <Pill className="w-3.5 h-3.5 text-[#0E7C86]" />
                      <span>Prescription Items:</span>
                    </div>
                    {proto.medicines.map((m, mIdx) => (
                      <div key={mIdx} className="text-[11px] text-slate-800 font-medium pl-4 border-l-2 border-teal-400">
                        <strong>{m.name} {m.dosage}</strong> — {m.frequency} × {m.duration}
                      </div>
                    ))}
                  </div>

                  {/* Labs list */}
                  <div className="text-[11px] text-slate-600 space-y-0.5">
                    <span className="font-bold text-slate-700">Lab Orders: </span>
                    <span>{proto.labOrders.join(' · ')}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApplyProtocol(proto)}
                    className="w-full py-2 px-3 rounded-xl bg-[#0E7C86] hover:bg-[#0b636b] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Protocol Applied to Chart!</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Apply Protocol to Consultation Pad</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: ICD-10 DIAGNOSTIC CODING ASSISTANT                          */}
      {/* =================================================================== */}
      {activeTab === 'icd10' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              Standardized World Health Organization (WHO) ICD-10 clinical diagnostic codes. Fast search by code, disease name, or organ system.
            </p>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={icdSearch}
                onChange={(e) => setIcdSearch(e.target.value)}
                placeholder="Search ICD-10 code or disease..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
            {filteredIcd.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  if (onSelectIcdCode) onSelectIcdCode(item);
                  void navigator.clipboard?.writeText(`${item.code} - ${item.name}`);
                }}
                className="p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/40 text-left transition-colors cursor-pointer space-y-1 group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                    {item.code}
                  </span>
                  <span className="text-[10px] text-slate-400">{item.chapter}</span>
                </div>
                <div className="text-xs font-bold text-slate-800 leading-snug group-hover:text-indigo-900">
                  {item.name}
                </div>
                <div className="text-[10px] text-[#0E7C86] font-semibold">Click to select & copy →</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: OPD CONSULTATION QUEUE & TRIAGE TRACKER                     */}
      {/* =================================================================== */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Live Outpatient (OPD) Waiting Room & Triage List
              </h4>
              <p className="text-xs text-slate-500">
                Priority color-coded by clinical urgency. Calling a patient updates the hospital digital display.
              </p>
            </div>
            {activeCalledToken && (
              <div className="px-3 py-1 rounded-xl bg-teal-50 border border-teal-200 text-xs font-bold text-[#0E7C86] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
                <span>Now In Cabin: Token #{activeCalledToken}</span>
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            {queueState.map((pat) => {
              const isCurrent = pat.tokenNumber === activeCalledToken;
              return (
                <div
                  key={pat.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isCurrent
                      ? 'bg-teal-50/70 border-[#0E7C86] shadow-sm'
                      : pat.triageLevel === 2
                      ? 'bg-rose-50/50 border-rose-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3">
                    {/* Token Badge */}
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex flex-col items-center justify-center font-mono shrink-0">
                      <span className="text-[9px] font-bold text-teal-300 uppercase">Token</span>
                      <span className="text-base font-extrabold leading-none">#{pat.tokenNumber}</span>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{pat.name}</span>
                        <span className="text-xs text-slate-500 font-medium">({pat.age}y, {pat.gender})</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            pat.triageLevel === 2
                              ? 'bg-rose-100 text-rose-800'
                              : pat.triageLevel === 3
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          Triage {pat.triageLevel}: {pat.triageLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-1">
                        <strong>Chief Complaint:</strong> {pat.chiefComplaint}
                      </p>
                      <div className="text-[11px] text-slate-500 font-mono flex flex-wrap gap-2 pt-0.5">
                        <span>BP: {pat.vitals.bp}</span>
                        <span>·</span>
                        <span>HR: {pat.vitals.pulse} bpm</span>
                        <span>·</span>
                        <span>SpO2: {pat.vitals.spo2}%</span>
                        <span>·</span>
                        <span>Wait: {pat.waitTimeMins} mins</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isCurrent ? (
                      <span className="px-3 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-bold inline-flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>In Consultation</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCallPatient(pat)}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Stethoscope className="w-3.5 h-3.5 text-teal-300" />
                        <span>Call to Cabin</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
