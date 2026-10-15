import React, { useEffect, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  FlaskConical,
  Pill,
  Plus,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { apiRequest } from '../api.ts';
import { normalizeClinicalSafetyResult } from '../services/clinicalSafetyShape.js';
import { SupportedLang, translateUiPhrase } from '../i18n/translations.ts';

export type AdministrationRoute =
  | 'Oral'
  | 'Topical'
  | 'Inhalation'
  | 'IV'
  | 'IM'
  | 'Subcutaneous'
  | 'Ophthalmic'
  | 'Otic'
  | 'Nasal';

interface CandidateMed {
  name: string;
  strength: string;
  dosage: string;
  route: AdministrationRoute;
  morning: number;
  noon: number;
  night: number;
  durationDays: number;
  startDate: string;
  endDate: string;
  foodInstruction: 'After food' | 'Before food' | 'With food' | 'Anytime';
  notes: string;
}

interface SafetyEvaluation {
  allergyAlerts: {
    medicineName: string;
    allergen: string;
    reaction: string;
    severity: string;
  }[];
  duplicateAlerts: {
    candidateName: string;
    normalizedGeneric: string;
    existingMed: {
      id: string;
      name: string;
      strength: string;
      facilityName: string;
      prescriberName: string;
    };
    daysRemaining: number;
  }[];
  interactionAlerts: {
    pair: string;
    severity: 'HIGH' | 'MODERATE';
    warning: string;
  }[];
  repeatTestAlerts: {
    orderedTest: string;
    existingReportTitle: string;
    daysAgo: number;
    date: string;
    facilityName: string;
    message: string;
  }[];
}

function computeEndDateStr(startDateStr: string, durationDays: number): string {
  const base = startDateStr ? new Date(startDateStr) : new Date();
  if (isNaN(base.getTime())) {
    return new Date(Date.now() + durationDays * 86400000).toISOString().slice(0, 10);
  }
  return new Date(base.getTime() + durationDays * 86400000).toISOString().slice(0, 10);
}

export const AddConsultationModal: React.FC<{
  lang: SupportedLang;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName?: string;
  facilityName?: string;
  prefillMed?: any | null;
  onClose: () => void;
  onSaved: (visit: any, prescription?: any, prescriptionWarning?: any) => void;
  onViewExistingPrescription?: (prescription: any) => void;
  onRevoked403: () => void;
}> = ({
  patientId,
  lang,
  patientName,
  doctorId,
  doctorName = 'Attending Clinician',
  facilityName = 'Authorized Healthcare Facility',
  prefillMed,
  onClose,
  onSaved,
  onViewExistingPrescription,
  onRevoked403,
}) => {
  const ui = (phrase: string) => translateUiPhrase(phrase, lang);
  const todayIsoDate = new Date().toISOString().slice(0, 10);
  const [consultationRef] = useState(
    () => `CONS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [idempotencyKey] = useState(
    () => `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  const [chiefComplaint, setChiefComplaint] = useState(
    prefillMed ? `Follow-up & renewal for ${prefillMed.name}` : ''
  );
  const [diagnosis, setDiagnosis] = useState(
    prefillMed ? `Medication course continuation` : ''
  );
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [referralSpecialist, setReferralSpecialist] = useState('');

  const [medicines, setMedicines] = useState<CandidateMed[]>(
    prefillMed
      ? [
          {
            name: prefillMed.name,
            strength: prefillMed.strength || '500 mg',
            dosage: prefillMed.dosage || '1 tablet',
            route: (prefillMed.route as AdministrationRoute) || 'Oral',
            morning: prefillMed.frequency?.morning ?? 1,
            noon: prefillMed.frequency?.noon ?? 0,
            night: prefillMed.frequency?.night ?? 1,
            durationDays: 5,
            startDate: todayIsoDate,
            endDate: computeEndDateStr(todayIsoDate, 5),
            foodInstruction: prefillMed.foodInstruction || 'After food',
            notes: 'Continued / repeated from previous course',
          },
        ]
      : []
  );

  const [testInput, setTestInput] = useState('');
  const [orderedTests, setOrderedTests] = useState<string[]>([]);

  const [safety, setSafety] = useState<SafetyEvaluation>({
    allergyAlerts: [],
    duplicateAlerts: [],
    interactionAlerts: [],
    repeatTestAlerts: [],
  });

  const [allergyOverrideReason, setAllergyOverrideReason] = useState('');
  const [duplicateResolutions, setDuplicateResolutions] = useState<
    Record<string, { mode: 'CONTINUE' | 'CHANGE_DOSE' | 'ADD_ANYWAY'; reason: string }>
  >({});

  const [confirmedByDoctor, setConfirmedByDoctor] = useState(false);
  const [showRxPreview, setShowRxPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [duplicatePrescription, setDuplicatePrescription] = useState<any>(null);
  const [revokedError, setRevokedError] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await apiRequest('/api/clinical/check-safety', {
          method: 'POST',
          doctorId,
          patientId,
          suppressGlobal403: true,
          body: JSON.stringify({
            patientId,
            doctorId,
            candidateMedicines: medicines,
            candidateTests: orderedTests,
          }),
        });
        if (res.ok) {
          // Keep the form resilient when an older API returns a generic success object
          // instead of all decision-support lists.
          setSafety(normalizeClinicalSafetyResult(res.data));
        }
      } catch {
        // Ignore network error during live evaluation
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [patientId, doctorId, medicines, orderedTests]);

  const addMedicineRow = (preset?: Partial<CandidateMed>) => {
    const dur = preset?.durationDays || 5;
    const st = preset?.startDate || todayIsoDate;
    setMedicines((prev) => [
      ...prev,
      {
        name: preset?.name || '',
        strength: preset?.strength || '500 mg',
        dosage: preset?.dosage || '1 tablet',
        route: preset?.route || 'Oral',
        morning: preset?.morning ?? 1,
        noon: preset?.noon ?? 0,
        night: preset?.night ?? 1,
        durationDays: dur,
        startDate: st,
        endDate: preset?.endDate || computeEndDateStr(st, dur),
        foodInstruction: preset?.foodInstruction || 'After food',
        notes: preset?.notes || '',
      },
    ]);
  };

  const updateMed = (index: number, patch: Partial<CandidateMed>) => {
    setMedicines((prev) =>
      prev.map((m, idx) => {
        if (idx !== index) return m;
        const updated = { ...m, ...patch };
        if (patch.startDate !== undefined || patch.durationDays !== undefined) {
          updated.endDate = computeEndDateStr(updated.startDate, updated.durationDays);
        }
        return updated;
      })
    );
  };

  const removeMed = (index: number) => {
    setMedicines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const addTestTag = (name: string) => {
    const clean = name.trim();
    if (!clean || orderedTests.includes(clean)) return;
    setOrderedTests((prev) => [...prev, clean]);
    setTestInput('');
  };

  const validMedicines = medicines.filter((m) => m.name.trim().length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!chiefComplaint.trim() || !diagnosis.trim()) {
      setErrorMsg('Please enter both the Chief Complaint and Clinical Diagnosis.');
      return;
    }

    if (!confirmedByDoctor) {
      setErrorMsg(
        'Please review the consultation and prescription details and check the clinician confirmation box before saving.'
      );
      return;
    }

    setSubmitting(true);

    try {
      const res = await apiRequest(`/api/provider/patient/${patientId}/consultation`, {
        method: 'POST',
        doctorId,
        patientId,
        headers: {
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          doctorId,
          medicalCategory: 'Consultation History',
          chiefComplaint: chiefComplaint.trim(),
          diagnosis: diagnosis.trim(),
          clinicalNotes: clinicalNotes.trim(),
          followUpDate: followUpDate.trim(),
          referralSpecialist: referralSpecialist.trim(),
          medicines: validMedicines.map((m) => ({
            ...m,
            instructions: m.notes,
            frequencyLabel: `${m.morning}-${m.noon}-${m.night}`,
          })),
          orderedTests,
          allergyOverrideReason,
          duplicateResolutions,
          confirmedByDoctor: true,
          idempotencyKey,
        }),
      });

      if (res.status === 403) {
        const code = res.data?.code || res.consentError?.code;
        if (code === 'WRITE_PERMISSION_DENIED' || code === 'PRESCRIPTION_PERMISSION_DENIED') {
          setErrorMsg(
            res.data?.message ||
              'Write permission denied: The patient did not grant access to Consultations or Prescriptions/Medicines.'
          );
          setSubmitting(false);
          return;
        }
        setRevokedError(true);
        setErrorMsg(
          res.data?.message ||
            'Access revoked — The patient has withdrawn permission. Typed notes are preserved below so you do not lose your work.'
        );
        onRevoked403();
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        if (res.data?.code === 'ACTIVE_PRESCRIPTION_DUPLICATE') {
          setDuplicatePrescription(res.data.existingPrescription || { id: res.data.existingPrescriptionId });
        }
        setErrorMsg(res.data?.error || 'Unable to save consultation.');
        setSubmitting(false);
        return;
      }

      onSaved(res.data.visit, res.data.prescription, res.data.prescriptionWarning);
    } catch {
      const queue = JSON.parse(localStorage.getItem('hp_offline_consultations') || '[]');
      queue.push({
        patientId,
        doctorId,
        chiefComplaint,
        diagnosis,
        clinicalNotes,
        medicines: validMedicines,
        orderedTests,
        idempotencyKey,
        queuedAt: new Date().toISOString(),
      });
      localStorage.setItem('hp_offline_consultations', JSON.stringify(queue));
      setErrorMsg(
        'Network offline: Consultation & prescription queued locally (Pending Sync) and will auto-sync when online.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const hasUnresolvedAllergy =
    safety.allergyAlerts.length > 0 && allergyOverrideReason.trim().length < 6;

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="clay-card max-w-4xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4 border-b border-[#DDE7EA] pb-4">
          <div>
            <span className="text-xs font-bold text-[#0E7C86]">
              POINT-OF-CARE CONSULTATION & PRESCRIPTION RECORDING
            </span>
            <h3 className="text-xl font-bold text-[#1F2D3D]">
              Consultation & Prescription for {patientName}
            </h3>
            <p className="text-xs text-[#5B6B7A] mt-0.5">
              Prescriber: <strong>{doctorName}</strong> · Facility: <strong>{facilityName}</strong> · Ref:{' '}
              <span className="font-mono">{consultationRef}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl border border-[#DDE7EA] flex items-center justify-center text-[#5B6B7A] hover:text-[#1F2D3D]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 p-3.5 rounded-2xl bg-[#F5F9FA] border border-[#DDE7EA]">
          <div className="text-xs font-bold text-[#1F2D3D] mb-2">
            ⚡ Clinical Safety Decision-Support Test Helpers (Optional):
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (!chiefComplaint) setChiefComplaint('Fever and throat pain for 2 days');
                if (!diagnosis) setDiagnosis('Acute viral pharyngitis');
                addMedicineRow({
                  name: 'Co-trimoxazole (Bactrim)',
                  strength: '480 mg',
                  dosage: '1 tablet',
                  route: 'Oral',
                  notes: 'Sulfa class antibiotic — triggers severe allergy block!',
                });
              }}
              className="px-3 py-1.5 rounded-xl bg-[#FEF2F2] border border-[#D32F2F]/40 text-xs font-bold text-[#D32F2F] hover:bg-[#FEE2E2]"
            >
              + Test Sulfa Allergy (Co-trimoxazole)
            </button>
            <button
              type="button"
              onClick={() => {
                if (!chiefComplaint) setChiefComplaint('Persistently elevated temperature');
                if (!diagnosis) setDiagnosis('Viral febrile illness');
                addMedicineRow({
                  name: 'Dolo 650',
                  strength: '650 mg',
                  dosage: '1 tablet',
                  route: 'Oral',
                  notes: 'Brand of Paracetamol — triggers active duplicate check!',
                });
              }}
              className="px-3 py-1.5 rounded-xl bg-[#FFFBEB] border border-[#E8A317]/50 text-xs font-bold text-[#B7791F] hover:bg-[#FEF3C7]"
            >
              + Test Active Duplicate (Dolo 650 → Paracetamol)
            </button>
            <button
              type="button"
              onClick={() => {
                if (!chiefComplaint) setChiefComplaint('Mild epigastric discomfort');
                if (!diagnosis) setDiagnosis('Acid peptic gastritis');
                addMedicineRow({
                  name: 'Pan 40',
                  strength: '40 mg',
                  dosage: '1 tablet',
                  route: 'Oral',
                  foodInstruction: 'Before food',
                  notes: 'Matches COMPLETED Pantoprazole — gives NO warning!',
                });
              }}
              className="px-3 py-1.5 rounded-xl bg-[#ECFDF5] border border-[#1E8E5A]/40 text-xs font-bold text-[#1E8E5A] hover:bg-[#D1FAE5]"
            >
              + Add Completed Med (Pan 40 — No Warning)
            </button>
            <button
              type="button"
              onClick={() => addTestTag('CBC (Complete Blood Count)')}
              className="px-3 py-1.5 rounded-xl bg-[#EFF6FF] border border-[#1769AA]/40 text-xs font-bold text-[#1769AA] hover:bg-[#DBEAFE]"
            >
              + Test Repeat Lab Warning (CBC)
            </button>
          </div>
        </div>

        {revokedError && (
          <div
            role="alert"
            className="mt-4 p-4 rounded-2xl bg-[#D32F2F] text-white font-bold text-sm flex items-start gap-3"
          >
            <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <div>{ui('Access revoked — Save rejected (HTTP 403 ACCESS_REVOKED)')}</div>
              <div className="text-xs font-normal text-white/95 mt-0.5">
                The patient has withdrawn permission while you were writing this consultation. Your
                typed diagnosis, clinical notes, and prescriptions are preserved below so you can
                copy them or re-request patient consent without losing your work.
              </div>
            </div>
          </div>
        )}

        {errorMsg && !revokedError && (
          <div className="mt-4 p-3.5 rounded-xl bg-[#FEF2F2] border border-[#D32F2F] text-xs font-bold text-[#D32F2F]">
            {ui(errorMsg)}
            {duplicatePrescription && <button type="button" className="ml-2 underline" onClick={() => onViewExistingPrescription?.(duplicatePrescription)}>View existing prescription</button>}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#1F2D3D] mb-1">
                {ui('Chief Complaint / Reason for Visit')} *
              </label>
              <input
                type="text"
                required
                placeholder={ui("Enter patient's presenting complaint...")}
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DDE7EA] bg-white text-sm text-[#1F2D3D] focus:outline-none focus:border-[#0E7C86]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1F2D3D] mb-1">
                {ui('Clinical Findings & Diagnosis')} *
              </label>
              <input
                type="text"
                required
                placeholder={ui('Enter clinical diagnosis...')}
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DDE7EA] bg-white text-sm text-[#1F2D3D] focus:outline-none focus:border-[#0E7C86]"
              />
            </div>
          </div>

          {safety.allergyAlerts.length > 0 && (
            <div className="rounded-2xl bg-[#FEF2F2] border-2 border-[#D32F2F] p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertOctagon className="w-6 h-6 text-[#D32F2F] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-extrabold text-[#7F1D1D]">
                    {ui('BLOCKING ALLERGY ALERT — CONTRAINDICATED PRESCRIPTION')}
                  </h4>
                  {safety.allergyAlerts.map((a, i) => (
                    <p key={i} className="text-xs text-[#991B1B] font-semibold mt-1">
                      • <strong>{a.medicineName}</strong> belongs to or triggers{' '}
                      <strong>{a.allergen}</strong> ({a.severity}: {a.reaction}).
                    </p>
                  ))}
                </div>
              </div>
              <div className="pt-2 border-t border-[#D32F2F]/20">
                <label className="block text-xs font-bold text-[#7F1D1D] mb-1">
                  Remove the medicine above OR provide mandatory clinical override reason (Logged to
                  Audit Trail):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Desensitization protocol completed in ICU under observation..."
                  value={allergyOverrideReason}
                  onChange={(e) => setAllergyOverrideReason(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-[#D32F2F] bg-white text-xs text-[#1F2D3D]"
                />
              </div>
            </div>
          )}

          {safety.interactionAlerts.length > 0 && (
            <div className="rounded-2xl bg-[#FFFBEB] border-2 border-[#E8A317] p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[#B7791F] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-[#92400E]">
                    DRUG-DRUG INTERACTION WARNING
                  </h4>
                  {safety.interactionAlerts.map((inter, idx) => (
                    <p key={idx} className="text-xs text-[#92400E] mt-1">
                      • <strong>{inter.pair}</strong> ({inter.severity}): {inter.warning}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {safety.duplicateAlerts.length > 0 && (
            <div className="rounded-2xl bg-[#EFF6FF] border-2 border-[#1769AA] p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Pill className="w-5 h-5 text-[#1769AA] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-[#1E3A8A]">
                    CURRENTLY TAKING — ACTIVE DUPLICATE DETECTED (Brand-to-Generic Match)
                  </h4>
                  <p className="text-xs text-[#1E40AF]">
                    Patient is already taking an ACTIVE medicine with the same generic ingredient (
                    <span className="font-mono font-bold">
                      {safety.duplicateAlerts[0].normalizedGeneric}
                    </span>
                    ). Choose how to handle:
                  </p>
                </div>
              </div>

              {safety.duplicateAlerts.map((dup, i) => {
                const currentRes = duplicateResolutions[dup.candidateName] || {
                  mode: 'CONTINUE',
                  reason: '',
                };
                return (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-white border border-[#1769AA]/30 space-y-2"
                  >
                    <div className="text-xs font-semibold text-[#1F2D3D]">
                      New entry <strong>{dup.candidateName}</strong> matches active{' '}
                      <strong>
                        {dup.existingMed.name} {dup.existingMed.strength}
                      </strong>{' '}
                      ({dup.daysRemaining} days left, prescribed by {dup.existingMed.prescriberName}{' '}
                      at {dup.existingMed.facilityName})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { id: 'CONTINUE', label: 'Continue Existing (1 Active Entry)' },
                          { id: 'CHANGE_DOSE', label: 'Change Dose (Replace Old via renewedFrom)' },
                          { id: 'ADD_ANYWAY', label: 'Add Anyway (Reason Required)' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setDuplicateResolutions((prev) => ({
                              ...prev,
                              [dup.candidateName]: { ...currentRes, mode: opt.id },
                            }))
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                            currentRes.mode === opt.id
                              ? 'bg-[#1769AA] text-white border-[#1769AA]'
                              : 'bg-[#F5F9FA] text-[#1F2D3D] border-[#DDE7EA]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {currentRes.mode === 'ADD_ANYWAY' && (
                      <input
                        type="text"
                        placeholder="Mandatory clinical reason for concurrent duplicate therapy..."
                        value={currentRes.reason}
                        onChange={(e) =>
                          setDuplicateResolutions((prev) => ({
                            ...prev,
                            [dup.candidateName]: { ...currentRes, reason: e.target.value },
                          }))
                        }
                        className="w-full min-h-[38px] px-3 py-1 rounded-lg border border-[#1769AA] text-xs"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Prescription Medicines Section */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold text-[#1F2D3D]">
                  Prescribed Medicines (Rx)
                </label>
                <p className="text-[11px] text-[#5B6B7A]">
                  Specify medicine name, strength, dosage, route, frequency, duration, start/end dates & instructions.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {validMedicines.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowRxPreview((prev) => !prev)}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#0E7C86]/30 bg-white text-[#0E7C86] text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#0E7C86]/5"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{ui(showRxPreview ? 'Hide Rx Preview' : 'Review Prescription Slip')}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => addMedicineRow()}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#0E7C86] text-white text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#0B636B] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>{ui('Add Prescribed Medicine')}</span>
                </button>
              </div>
            </div>

            {medicines.length === 0 ? (
              <div className="p-4 rounded-2xl bg-[#F5F9FA] border border-dashed border-[#DDE7EA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-[#5B6B7A]">
                  {ui('No medicines added yet. Click + Add Prescribed Medicine to record a prescription for this consultation.')}
                </div>
                <button
                  type="button"
                  onClick={() => addMedicineRow()}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white border border-[#DDE7EA] text-xs font-bold text-[#0E7C86] hover:border-[#0E7C86] shrink-0"
                >
                  {ui('+ Add Medicine Row')}
                </button>
              </div>
            ) : (
              medicines.map((med, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-[#F5F9FA] border border-[#DDE7EA] space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-[#5B6B7A]">
                        Medicine Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Paracetamol, Cetirizine..."
                        value={med.name}
                        onChange={(e) => updateMed(idx, { name: e.target.value })}
                        className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-[#DDE7EA] bg-white text-xs font-semibold"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[#5B6B7A]">
                        Strength
                      </label>
                      <input
                        type="text"
                        placeholder="500 mg"
                        value={med.strength}
                        onChange={(e) => updateMed(idx, { strength: e.target.value })}
                        className="w-full min-h-[40px] px-2.5 py-1.5 rounded-lg border border-[#DDE7EA] bg-white text-xs font-mono"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[#5B6B7A]">
                        Dosage
                      </label>
                      <input
                        type="text"
                        placeholder="1 tablet / 5 ml"
                        value={med.dosage}
                        onChange={(e) => updateMed(idx, { dosage: e.target.value })}
                        className="w-full min-h-[40px] px-2.5 py-1.5 rounded-lg border border-[#DDE7EA] bg-white text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[#5B6B7A]">
                        Route
                      </label>
                      <select
                        value={med.route}
                        onChange={(e) =>
                          updateMed(idx, { route: e.target.value as AdministrationRoute })
                        }
                        className="w-full min-h-[40px] px-2 py-1.5 rounded-lg border border-[#DDE7EA] bg-white text-xs font-semibold"
                      >
                        <option value="Oral">Oral</option>
                        <option value="Topical">Topical</option>
                        <option value="Inhalation">Inhalation</option>
                        <option value="IV">IV</option>
                        <option value="IM">IM</option>
                        <option value="Subcutaneous">Subcutaneous</option>
                        <option value="Ophthalmic">Ophthalmic</option>
                        <option value="Otic">Otic</option>
                        <option value="Nasal">Nasal</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[#5B6B7A]">
                        Morn - Noon - Night
                      </label>
                      <div className="grid grid-cols-3 gap-1">
                        <input
                          type="number"
                          min={0}
                          max={4}
                          value={med.morning}
                          onChange={(e) => updateMed(idx, { morning: Number(e.target.value) })}
                          className="min-h-[40px] text-center rounded-lg border border-[#DDE7EA] bg-white text-xs font-bold"
                        />
                        <input
                          type="number"
                          min={0}
                          max={4}
                          value={med.noon}
                          onChange={(e) => updateMed(idx, { noon: Number(e.target.value) })}
                          className="min-h-[40px] text-center rounded-lg border border-[#DDE7EA] bg-white text-xs font-bold"
                        />
                        <input
                          type="number"
                          min={0}
                          max={4}
                          value={med.night}
                          onChange={(e) => updateMed(idx, { night: Number(e.target.value) })}
                          className="min-h-[40px] text-center rounded-lg border border-[#DDE7EA] bg-white text-xs font-bold"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-1 flex justify-end pt-4">
                      <button
                        type="button"
                        onClick={() => removeMed(idx)}
                        className="min-h-[38px] min-w-[38px] rounded-lg text-[#D32F2F] hover:bg-[#FEF2F2] flex items-center justify-center"
                        title="Remove medicine"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[#5B6B7A]">
                        Duration (Days)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={med.durationDays}
                        onChange={(e) => updateMed(idx, { durationDays: Number(e.target.value) })}
                        className="w-full min-h-[38px] px-2.5 py-1 rounded-lg border border-[#DDE7EA] bg-white text-xs font-mono"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[#5B6B7A]">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={med.startDate}
                        onChange={(e) => updateMed(idx, { startDate: e.target.value })}
                        className="w-full min-h-[38px] px-2 py-1 rounded-lg border border-[#DDE7EA] bg-white text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[#5B6B7A]">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={med.endDate}
                        onChange={(e) => updateMed(idx, { endDate: e.target.value })}
                        className="w-full min-h-[38px] px-2 py-1 rounded-lg border border-[#DDE7EA] bg-white text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[#5B6B7A]">
                        Timing
                      </label>
                      <select
                        value={med.foodInstruction}
                        onChange={(e) =>
                          updateMed(idx, { foodInstruction: e.target.value as any })
                        }
                        className="w-full min-h-[38px] px-2.5 py-1 rounded-lg border border-[#DDE7EA] bg-white text-xs"
                      >
                        <option value="After food">After food</option>
                        <option value="Before food">Before food</option>
                        <option value="With food">With food</option>
                        <option value="Anytime">Anytime</option>
                      </select>
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-semibold text-[#5B6B7A]">
                        Special Instructions
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Swallow whole with warm water..."
                        value={med.notes}
                        onChange={(e) => updateMed(idx, { notes: e.target.value })}
                        className="w-full min-h-[38px] px-3 py-1 rounded-lg border border-[#DDE7EA] bg-white text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Prescription Review Slip */}
            {(showRxPreview || validMedicines.length > 0) && validMedicines.length > 0 && (
              <div className="p-4 rounded-2xl bg-white border-2 border-[#0E7C86]/30 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DDE7EA] pb-2">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-[#0E7C86]" />
                    <span className="text-xs font-extrabold text-[#0E7C86]">
                      PRESCRIPTION REVIEW SUMMARY (Rx)
                    </span>
                  </div>
                  <div className="text-[11px] text-[#5B6B7A] font-mono">
                    Ref: {consultationRef} · {new Date().toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-[#1F2D3D]">
                  <div>
                    <span className="text-[#5B6B7A]">Patient:</span>{' '}
                    <strong>{patientName}</strong>
                  </div>
                  <div>
                    <span className="text-[#5B6B7A]">Prescriber:</span>{' '}
                    <strong>{doctorName}</strong>
                  </div>
                  <div>
                    <span className="text-[#5B6B7A]">Facility:</span>{' '}
                    <strong>{facilityName}</strong>
                  </div>
                </div>
                <div className="divide-y divide-[#DDE7EA] pt-1">
                  {validMedicines.map((m, i) => (
                    <div key={i} className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-bold text-[#1F2D3D]">
                          {i + 1}. {m.name} {m.strength}
                        </span>{' '}
                        <span className="text-[#5B6B7A]">
                          ({m.dosage} · {m.route})
                        </span>
                        {m.notes && (
                          <div className="text-[11px] text-[#5B6B7A]">
                            Instructions: {m.notes}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-semibold">
                        <span className="px-2 py-0.5 rounded-md bg-[#F5F9FA] border border-[#DDE7EA] font-mono">
                          {m.morning}-{m.noon}-{m.night} ({m.foodInstruction})
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#0E7C86]/10 text-[#0E7C86] inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {m.durationDays}d ({m.startDate} → {m.endDate})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#1F2D3D]">
              {ui('Order Lab Tests (Checks for Repeat Tests within 30 Days)')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={ui('Type test name e.g. CBC, HbA1c, Lipid Panel...')}
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl border border-[#DDE7EA] bg-white text-xs"
              />
              <button
                type="button"
                onClick={() => addTestTag(testInput)}
                className="min-h-[42px] px-4 rounded-xl bg-[#F5F9FA] border border-[#DDE7EA] text-xs font-bold text-[#0E7C86]"
              >
                {ui('+ Add Test')}
              </button>
            </div>

            {orderedTests.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {orderedTests.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#0E7C86]/10 text-[#0E7C86] text-xs font-bold"
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    <span>{t}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setOrderedTests((prev) => prev.filter((item) => item !== t))
                      }
                      className="ml-1 text-[#D32F2F]"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {safety.repeatTestAlerts.length > 0 && (
              <div className="rounded-2xl bg-[#FFFBEB] border-2 border-[#E8A317] p-3.5 mt-2">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-[#B7791F] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-extrabold text-[#92400E]">
                      {ui('REPEAT DIAGNOSTIC TEST WARNING (Reduces Unnecessary Patient Spend)')}
                    </div>
                    {safety.repeatTestAlerts.map((rt, i) => (
                      <p key={i} className="text-xs text-[#92400E] font-semibold mt-0.5">
                        • {rt.message}. Review existing result before re-ordering.
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#1F2D3D] mb-1">
                {ui('Clinical Notes & Findings (Encrypted at Rest via AES-256-GCM)')}
              </label>
              <textarea
                rows={2}
                placeholder={ui('Enter physical examination findings and clinical notes...')}
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#DDE7EA] bg-white text-xs text-[#1F2D3D]"
              />
            </div>
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-bold text-[#1F2D3D] mb-1">
                  {ui('Follow-up Date & Specialist Referral (Optional)')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder={ui('Follow-up e.g. 25 Oct')}
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] bg-white text-xs"
                  />
                  <input
                    type="text"
                    placeholder={ui('Refer to Specialist...')}
                    value={referralSpecialist}
                    onChange={(e) => setReferralSpecialist(e.target.value)}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] bg-white text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#F5F9FA] border border-[#DDE7EA] cursor-pointer">
            <input
              type="checkbox"
              checked={confirmedByDoctor}
              onChange={(e) => setConfirmedByDoctor(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#0E7C86] rounded"
            />
            <span className="text-xs text-[#1F2D3D] leading-relaxed">
              <strong>{ui('Clinician Confirmation')}:</strong> {ui("I have reviewed the patient's allergies, active medicines, and the consultation/prescription details above.")} ({doctorName}, {facilityName}).
            </span>
          </label>

          <div className="pt-4 border-t border-[#DDE7EA] flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[46px] px-5 py-2.5 rounded-xl border border-[#DDE7EA] bg-white text-xs font-bold text-[#5B6B7A]"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={submitting || hasUnresolvedAllergy}
              className={`min-h-[46px] px-6 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 ${
                hasUnresolvedAllergy
                  ? 'bg-[#8A97A3] text-white cursor-not-allowed'
                  : 'clay-btn-primary'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {submitting
                  ? 'Verifying Consent & Saving...'
                  : hasUnresolvedAllergy
                  ? 'Blocked by Sulfa/Penicillin Allergy'
                  : validMedicines.length > 0
                  ? 'Confirm & Save Consultation + Prescription'
                  : 'Confirm & Save Consultation'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
