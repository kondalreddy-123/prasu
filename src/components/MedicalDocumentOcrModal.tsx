import React, { useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileCheck,
  FileText,
  FlaskConical,
  Pill,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  ExtractedLabValue,
  ExtractedMedicineItem,
  ocrService,
  OcrSupportedLang,
  parseOcrClinicalText,
  verifyClientFileSignature,
} from '../services/ocrService.ts';
import { apiRequest } from '../api.ts';
import { LabReportExplanationPanel } from './SharedUI.tsx';
import { SupportedLang, translateUiPhrase } from '../i18n/translations.ts';
import { getMedicalRecordCategory, MEDICAL_RECORD_CATEGORIES } from '../medicalRecordCategories.ts';

interface MedicalDocumentOcrModalProps {
  patientId: string;
  patientName: string;
  uploaderRole: 'patient' | 'doctor';
  doctorId?: string;
  lang: SupportedLang;
  onClose: () => void;
  onSaved: (savedReport: any) => void;
  onRevoked403?: (code: string, message: string) => void;
  initialReportType?: 'Prescription';
}

const DEMO_SAMPLE_FILES = [
  {
    label: 'Sample Prescription (Rx)',
    path: '/demo-reports/sample-prescription.svg',
    filename: 'sample-prescription.svg',
    badge: 'Prescription',
  },
  {
    label: 'Sample CBC & Sugar Lab Report',
    path: '/demo-reports/sample-blood-test.svg',
    filename: 'sample-blood-test.svg',
    badge: 'Lab Report',
  },
  {
    label: 'Sample Discharge Summary',
    path: '/demo-reports/sample-discharge-note.svg',
    filename: 'sample-discharge-note.svg',
    badge: 'Discharge Summary',
  },
  {
    label: 'Bilingual Lab Report (EN/HI/TE)',
    path: '/demo-reports/sample-hindi-telugu-lab.svg',
    filename: 'sample-hindi-telugu-lab.svg',
    badge: 'Multilingual OCR',
  },
];

const CONSENT_CATEGORY_OPTIONS = [
  'Lab reports',
  'Prescriptions',
  'Medical history',
  'Consultations',
  'Other documents',
] as const;

export const MedicalDocumentOcrModal: React.FC<MedicalDocumentOcrModalProps> = ({
  patientId,
  patientName,
  uploaderRole,
  doctorId,
  lang,
  onClose,
  onSaved,
  onRevoked403,
  initialReportType,
}) => {
  const ui = (phrase: string) => translateUiPhrase(phrase, lang);
  const [ocrLang, setOcrLang] = useState<OcrSupportedLang>('eng');
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [revokedBanner, setRevokedBanner] = useState<string | null>(null);

  // Original document state
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileTypeLabel, setFileTypeLabel] = useState<'IMAGE' | 'PDF'>('IMAGE');
  const [rawOcrText, setRawOcrText] = useState<string>('');
  const [overallConfidence, setOverallConfidence] = useState<number>(0);
  const [hasExtracted, setHasExtracted] = useState(false);

  // Editable candidate fields
  const [reportType, setReportType] = useState<
    | 'Blood Test'
    | 'X-Ray / Imaging'
    | 'Prescription'
    | 'Discharge Summary'
    | 'Consultation Document'
    | 'Other'
  >(initialReportType || 'Blood Test');
  const [category, setCategory] = useState<string>(initialReportType === 'Prescription' ? 'Prescriptions' : 'Lab reports');
  const [medicalCategory, setMedicalCategory] = useState<string>(initialReportType === 'Prescription' ? 'Medications & Prescriptions' : 'Laboratory Reports');
  const [title, setTitle] = useState<string>('');
  const [reportDate, setReportDate] = useState<string>('');
  const [facilityName, setFacilityName] = useState<string>('');
  const [laboratoryName, setLaboratoryName] = useState<string>('');
  const [doctorName, setDoctorName] = useState<string>('');
  const [diagnosisSummary, setDiagnosisSummary] = useState<string>('');
  const [dischargeInstructions, setDischargeInstructions] = useState<string>('');
  const [plainExplanation, setPlainExplanation] = useState<string>('');

  const [fieldConfidence, setFieldConfidence] = useState<Record<string, 'HIGH' | 'LOW'>>({
    reportDate: 'HIGH',
    facilityName: 'HIGH',
    doctorName: 'HIGH',
    diagnosisSummary: 'HIGH',
  });

  const [labValues, setLabValues] = useState<ExtractedLabValue[]>([]);
  const [detectedMedicines, setDetectedMedicines] = useState<ExtractedMedicineItem[]>([]);

  const [confirmedByUser, setConfirmedByUser] = useState(false);
  const [saving, setSaving] = useState(false);

  const applyExtractionResult = (
    res: Omit<
      Awaited<ReturnType<typeof ocrService.extract>>,
      'success' | 'rawText' | 'overallConfidence' | 'strippedFileDataUrl' | 'mimeType' | 'fileName'
    > & {
      rawText?: string;
      overallConfidence?: number;
      strippedFileDataUrl?: string;
    },
    name: string
  ) => {
    if (res.rawText !== undefined) setRawOcrText(res.rawText);
    if (res.overallConfidence !== undefined) setOverallConfidence(res.overallConfidence);
    if (res.strippedFileDataUrl) setFilePreviewUrl(res.strippedFileDataUrl);
    setReportType(res.reportType);
    setCategory(res.consentCategory);
    setMedicalCategory(getMedicalRecordCategory({
      title: res.suggestedTitle,
      category: res.consentCategory,
      testName: res.labValues.map((value) => value.testName).join(' '),
      resultSummary: `${res.diagnosis || ''} ${res.extractedMedicines?.map((medicine) => medicine.name).join(' ') || ''}`,
      reportType: res.reportType,
    }));
    setReportDate(res.reportDate);
    setFacilityName(res.facilityName);
    setLaboratoryName(res.laboratoryName || res.facilityName);
    setDoctorName(res.doctorName);
    setDiagnosisSummary(res.diagnosis || '');
    setDischargeInstructions(res.dischargeSummaryNotes || '');
    setPlainExplanation(
      res.diagnosis ||
        res.dischargeSummaryNotes ||
        (res.labValues.length > 0
          ? `Extracted ${res.labValues.length} laboratory parameter(s) from document.`
          : 'Extracted structured candidate fields from document.')
    );
    setFieldConfidence(res.fieldConfidence);
    setLabValues(res.labValues);
    setDetectedMedicines(res.extractedMedicines || []);

    const autoTitle =
      res.suggestedTitle ||
      (res.reportType === 'Prescription'
        ? `Prescription (${res.facilityName || 'Verified Upload'}) — ${res.reportDate || 'Recent'}`
        : res.reportType === 'Discharge Summary'
        ? `Discharge Summary (${res.facilityName || 'Hospital'}) — ${res.reportDate || 'Recent'}`
        : res.reportType === 'Consultation Document'
        ? `Consultation Note (${res.doctorName || 'Clinic'}) — ${res.reportDate || 'Recent'}`
        : res.labValues.length > 0
        ? `Lab Report: ${res.labValues.map((l: ExtractedLabValue) => l.testName).slice(0, 2).join(', ')} — ${res.reportDate || 'Recent'}`
        : `${res.reportType} (${name}) — ${res.reportDate || 'Recent'}`);

    setTitle(autoTitle);
    setConfirmedByUser(false);
    setHasExtracted(true);
  };

  const processFile = async (file: File) => {
    setValidationError(null);
    const sigCheck = await verifyClientFileSignature(file);
    if (!sigCheck.valid) {
      setValidationError(sigCheck.reason || 'Unsupported file format.');
      return;
    }

    setFileName(file.name);
    setFileTypeLabel(file.type === 'application/pdf' ? 'PDF' : 'IMAGE');

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFilePreviewUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);

    setExtracting(true);
    setProgress(10);
    try {
      const res = await ocrService.extract(file, ocrLang, (pct: number) => setProgress(pct));
      applyExtractionResult(res, file.name);
    } catch {
      setValidationError(
        'This file could not be read automatically because image/PDF OCR is not configured. No findings were invented. You may review the original and enter fields manually.'
      );
      setHasExtracted(true);
    } finally {
      setExtracting(false);
      setProgress(100);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await processFile(f);
  };

  const handleLoadDemoSample = async (sample: (typeof DEMO_SAMPLE_FILES)[number]) => {
    setValidationError(null);
    setExtracting(true);
    setProgress(25);
    try {
      const resp = await fetch(sample.path);
      const blob = await resp.blob();
      const file = new File([blob], sample.filename, { type: 'image/svg+xml' });
      await processFile(file);
    } catch {
      setValidationError('Failed to load sample document.');
      setExtracting(false);
    }
  };

  const handleReparseRawText = () => {
    if (!rawOcrText.trim()) return;
    const parsed = parseOcrClinicalText(rawOcrText, overallConfidence || 85);
    applyExtractionResult(parsed, fileName || 'Edited OCR Text');
  };

  const addLabRow = () => {
    setLabValues((prev) => [
      ...prev,
      {
        id: `lv-manual-${Date.now()}`,
        testName: '',
        value: '',
        unit: 'mg/dL',
        referenceRange: '',
        status: 'NORMAL',
        confidence: 'HIGH',
      },
    ]);
  };

  const updateLabRow = (idx: number, patch: Partial<ExtractedLabValue>) => {
    setLabValues((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const removeLabRow = (idx: number) => {
    setLabValues((prev) => prev.filter((_, i) => i !== idx));
  };

  const addMedRow = () => {
    setDetectedMedicines((prev) => [
      ...prev,
      {
        id: `rx-manual-${Date.now()}`,
        name: '',
        strength: '500 mg',
        dosage: '1 Tablet',
        route: 'Oral',
        morning: 1,
        noon: 0,
        night: 1,
        durationDays: 5,
        foodInstruction: 'After food',
        instructions: 'After food',
        confidence: 'HIGH',
        confirmed: true,
      },
    ]);
  };

  const updateMedRow = (idx: number, patch: Partial<ExtractedMedicineItem>) => {
    setDetectedMedicines((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const removeMedRow = (idx: number) => {
    setDetectedMedicines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveVerifiedDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setRevokedBanner(null);

    if (!confirmedByUser) {
      setValidationError(
        'Please review the extracted fields and check the explicit confirmation box before saving.'
      );
      return;
    }

    const cleanLabs = labValues.filter((l) => l.testName.trim() && l.value.trim());
    const cleanMeds = detectedMedicines.filter((m) => m.name.trim());

    const computedSummary =
      cleanLabs.length > 0
        ? cleanLabs
            .map(
              (l) =>
                `${l.testName}: ${l.value} ${l.unit}${
                  l.referenceRange ? ` (Ref: ${l.referenceRange})` : ''
                }`
            )
            .join(' · ')
        : cleanMeds.length > 0
        ? `Rx: ${cleanMeds.map((m) => `${m.name} ${m.strength} (${m.morning}-${m.noon}-${m.night}, ${m.durationDays}d)`).join(' · ')}`
        : diagnosisSummary || dischargeInstructions || 'Verified medical document uploaded via OCR.';

    const payload = {
      doctorId: uploaderRole === 'doctor' ? doctorId : undefined,
      title: title.trim() || `${reportType} — ${reportDate || 'Today'}`,
      testName:
        cleanLabs.length > 0
          ? cleanLabs.map((l) => l.testName).join(', ')
          : reportType,
      category,
      medicalCategory,
      resultSummary: computedSummary,
      plainExplanation:
        plainExplanation.trim() ||
        'Verified by user after OCR extraction. Consult a qualified doctor for clinical interpretation.',
      statusColor: undefined,
      fileType: fileTypeLabel,
      fileDataUrl: filePreviewUrl || undefined,
      source: 'OCR_UPLOAD',
      rawOcrText,
      confirmedByUser: true,
      extractedFields: {
        reportType,
        reportDate,
        facilityName: facilityName || laboratoryName || 'Unverified Facility',
        laboratoryName: laboratoryName || facilityName || undefined,
        doctorName: doctorName || 'Unverified Prescriber',
        diagnosisSummary,
        dischargeInstructions,
        labValues: cleanLabs,
        detectedMedicines: cleanMeds,
      },
    };

    setSaving(true);
    try {
      if (uploaderRole === 'doctor') {
        const result = await apiRequest(`/api/provider/patient/${patientId}/reports`, {
          method: 'POST',
          doctorId,
          patientId,
          suppressGlobal403: true,
          body: JSON.stringify(payload),
        });

        if (result.status === 403) {
          const msg =
            result.data?.message ||
            'Cannot save OCR document: patient has revoked or not granted category permission.';
          setRevokedBanner(`HTTP 403 (${result.data?.code || 'ACCESS_REVOKED'}): ${msg}`);
          if (onRevoked403) {
            onRevoked403(result.data?.code || 'ACCESS_REVOKED', msg);
          }
          return;
        }
        if (!result.ok) {
          setValidationError(result.data?.error || 'Could not save document.');
          return;
        }
        onSaved(result.data.report);
      } else {
        const result = await apiRequest(`/api/patient/${patientId}/reports`, {
          method: 'POST', patientId, suppressGlobal403: true,
          body: JSON.stringify(payload),
        });
        if (!result.ok) {
          setValidationError(result.data?.error || 'Could not save document.');
          return;
        }
        onSaved(result.data.report);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="clay-card max-w-4xl w-full p-5 sm:p-7 my-8 max-h-[92vh] overflow-y-auto space-y-5">
        <div className="flex items-start justify-between gap-3 border-b border-[#DDE7EA] pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold tracking-wider text-[#0E7C86]">
                MEDICAL DOCUMENT OCR & HUMAN VERIFICATION WORKFLOW
              </span>
              <span className="px-2 py-0.5 rounded bg-[#0E7C86]/10 text-[#0E7C86] text-[10px] font-mono font-bold">
                Max 5 MB · PNG / JPG / WEBP / SVG / PDF
              </span>
            </div>
            <h3 className="text-xl font-bold text-[#1F2D3D] mt-0.5">
              Upload & Verify Medical Document for {patientName}
            </h3>
            <p className="text-xs text-[#5B6B7A]">
              Extracts candidate fields from Prescriptions, Lab Reports, Discharge Summaries, and
              Consultation Documents. Review and confirm all fields before saving.
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

        {revokedBanner && (
          <div className="rounded-2xl bg-[#FEF2F2] border-2 border-[#D32F2F] p-4 space-y-1">
            <div className="text-xs font-extrabold text-[#D32F2F]">
              🔒 SAVE BLOCKED BY BACKEND CONSENT ENFORCEMENT
            </div>
            <p className="text-xs font-semibold text-[#7F1D1D]">{revokedBanner}</p>
            <p className="text-[11px] text-[#991B1B]">
              Your reviewed OCR fields are preserved in this window so no work is lost.
            </p>
          </div>
        )}

        {validationError && (
          <div className="rounded-xl bg-[#FEF2F2] border border-[#D32F2F] p-3 text-xs font-bold text-[#D32F2F] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{ui(validationError)}</span>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-[#F5F9FA] border border-[#DDE7EA] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-[#1F2D3D]">{ui('Step 1: Select or Photograph a Medical Document (or Load a Realistic Sample)')}</div>
              <div className="text-[11px] text-[#5B6B7A]">
                {ui('Supports camera capture on mobile devices, image files, SVG reports, and PDFs.')}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-[#5B6B7A]">{ui('OCR Language')}:</label>
              <select
                value={ocrLang}
                onChange={(e) => setOcrLang(e.target.value as OcrSupportedLang)}
                className="min-h-[36px] px-2.5 py-1 rounded-xl border border-[#DDE7EA] bg-white text-xs font-bold text-[#1F2D3D]"
              >
                <option value="eng">English (eng)</option>
                <option value="eng+tel">English + Telugu (eng+tel)</option>
                <option value="eng+hin">English + Hindi (eng+hin)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="min-h-[44px] px-4 py-2.5 clay-btn-primary text-xs font-bold inline-flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>{ui('Select Image / PDF File')}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </label>

            <label className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white border border-[#0E7C86] text-[#0E7C86] hover:bg-[#F5F9FA] text-xs font-bold inline-flex items-center gap-2 cursor-pointer">
              <Camera className="w-4 h-4" />
              <span>{ui('Photograph Document')}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </label>
          </div>

          <div className="pt-2 border-t border-[#DDE7EA] space-y-1.5">
            <div className="text-[11px] font-bold text-[#5B6B7A] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#0E7C86]" />
              <span>{ui('Instant Test with Sample Documents:')}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {DEMO_SAMPLE_FILES.map((s) => (
                <button
                  key={s.path}
                  type="button"
                  onClick={() => handleLoadDemoSample(s)}
                  className="p-2.5 rounded-xl bg-white border border-[#DDE7EA] hover:border-[#0E7C86] text-left transition-all"
                >
                  <span className="text-[10px] font-mono font-bold text-[#0E7C86] block">
                    {s.badge}
                  </span>
                  <span className="text-xs font-bold text-[#1F2D3D]">{ui(s.label)}</span>
                </button>
              ))}
            </div>
          </div>

          {extracting && (
            <div className="p-3 rounded-xl bg-white border border-[#0E7C86] space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-[#0E7C86]">
                <span>{ui('Reading document and finding fields...')}</span>
                <span className="font-mono">{progress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#DDE7EA] overflow-hidden">
                <div
                  className="h-full bg-[#0E7C86] transition-all duration-200"
                  style={{ width: `${Math.max(10, progress)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {hasExtracted && (
          <form onSubmit={handleSaveVerifiedDocument} className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-5 space-y-3">
                <div className="p-3.5 rounded-2xl bg-[#F5F9FA] border border-[#DDE7EA] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#1F2D3D]">
                      {ui('Original Uploaded Document')}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-[#0E7C86]">
                      {ui('Confidence')}: {overallConfidence}%
                    </span>
                  </div>

                  {filePreviewUrl && fileTypeLabel === 'IMAGE' ? (
                    <div className="rounded-xl overflow-hidden border border-[#DDE7EA] bg-white max-h-64 flex items-center justify-center">
                      <img
                        src={filePreviewUrl}
                        alt="Uploaded Medical Document"
                        className="max-h-64 w-auto object-contain"
                      />
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-white border border-[#DDE7EA] text-center text-xs text-[#5B6B7A]">
                      <FileText className="w-8 h-8 text-[#0E7C86] mx-auto mb-1" />
                      <div className="font-bold text-[#1F2D3D]">{fileName || 'Document'}</div>
                      <div>{fileTypeLabel} Document Attached</div>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-[#5B6B7A]">
                        {ui('Extracted Raw Text (Editable)')}:
                      </label>
                      <button
                        type="button"
                        onClick={handleReparseRawText}
                        className="text-[11px] font-bold text-[#0E7C86] underline"
                      >
                        {ui('Re-Extract Fields from Text')}
                      </button>
                    </div>
                    <textarea
                      rows={6}
                      value={rawOcrText}
                      onChange={(e) => setRawOcrText(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[#DDE7EA] bg-white font-mono text-[11px] text-[#1F2D3D]"
                    />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 space-y-4">
                <div className="p-4 rounded-2xl bg-white border border-[#DDE7EA] space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-[#1F2D3D] flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-[#0E7C86]" />
                      <span>{ui('Step 2: Review & Correct Extracted Medical Fields')}</span>
                    </h4>
                    <span className="text-[11px] text-[#B7791F] font-semibold">
                      {ui('Unreadable fields are left blank — never invented')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#1F2D3D] mb-1">
                        {ui('Detected Document Type')}
                      </label>
                      <select
                        value={reportType}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setReportType(val);
                          if (val === 'Prescription') setCategory('Prescriptions');
                          else if (val === 'Blood Test') setCategory('Lab reports');
                          else if (val === 'Discharge Summary') setCategory('Medical history');
                          else if (val === 'Consultation Document') setCategory('Consultations');
                          else setCategory('Other documents');
                          setMedicalCategory(getMedicalRecordCategory({ reportType: val }));
                        }}
                        className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] bg-[#F5F9FA] text-xs font-bold text-[#1F2D3D]"
                      >
                        <option value="Blood Test">{ui('Laboratory Report')}</option>
                        <option value="Prescription">{ui('Prescription')}</option>
                        <option value="Discharge Summary">{ui('Discharge Summary')}</option>
                        <option value="Consultation Document">{ui('Consultation Document')}</option>
                        <option value="Other">{ui('Other Medical Record')}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#1F2D3D] mb-1">
                        Save to Consent Category
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] bg-[#F5F9FA] text-xs font-bold text-[#0E7C86]"
                      >
                        {CONSENT_CATEGORY_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-[#1F2D3D] mb-1">
                        Medical Record Category
                      </label>
                      <select
                        value={medicalCategory}
                        onChange={(e) => setMedicalCategory(e.target.value)}
                        className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] bg-[#F5F9FA] text-xs font-bold text-[#0E7C86]"
                      >
                        {MEDICAL_RECORD_CATEGORIES.map((recordCategory) => (
                          <option key={recordCategory} value={recordCategory}>{recordCategory}</option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-[#1F2D3D] mb-1">
                        Document Title
                      </label>
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#1F2D3D] mb-1">
                        {ui('Document / Report Date')}
                        {fieldConfidence.reportDate === 'LOW' && (
                          <span className="ml-1.5 text-[10px] text-[#B7791F] font-mono">
                            ({ui('Verify date')})
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={reportDate}
                        onChange={(e) => setReportDate(e.target.value)}
                        placeholder={ui('e.g. day month year')}
                        className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#1F2D3D] mb-1">
                        {ui('Facility / Laboratory Name')}
                        {!facilityName && (
                          <span className="ml-1.5 text-[10px] text-[#D32F2F] font-mono">
                            ({ui('Unreadable — Please enter')})
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={facilityName}
                        onChange={(e) => {
                          setFacilityName(e.target.value);
                          setLaboratoryName(e.target.value);
                        }}
                        placeholder={ui('Enter hospital, clinic, or lab name...')}
                        className={`w-full min-h-[40px] px-3 py-1.5 rounded-xl border text-xs ${
                          !facilityName ? 'border-[#E8A317] bg-[#FFFBEB]' : 'border-[#DDE7EA]'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#1F2D3D] mb-1">
                        {ui('Prescribing / Attending Doctor')}
                        {!doctorName && (
                          <span className="ml-1.5 text-[10px] text-[#B7791F] font-mono">
                            ({ui('Optional / Verify')})
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={doctorName}
                        onChange={(e) => setDoctorName(e.target.value)}
                        placeholder={ui('Doctor name')}
                        className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#1F2D3D] mb-1">
                        {ui('Diagnosis / Clinical Summary')}
                      </label>
                      <input
                        type="text"
                        value={diagnosisSummary}
                        onChange={(e) => setDiagnosisSummary(e.target.value)}
                        placeholder={ui('Diagnosis or summary notes...')}
                        className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] text-xs"
                      />
                    </div>

                    {(reportType === 'Discharge Summary' ||
                      reportType === 'Consultation Document' ||
                      dischargeInstructions) && (
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-[#1F2D3D] mb-1">
                          {ui('Follow-Up / Discharge Instructions')}
                        </label>
                        <input
                          type="text"
                          value={dischargeInstructions}
                          onChange={(e) => setDischargeInstructions(e.target.value)}
                          placeholder={ui('Follow-up instructions...')}
                          className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] text-xs"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {(reportType === 'Blood Test' || labValues.length > 0) && (
                  <div className="p-4 rounded-2xl bg-white border border-[#DDE7EA] space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-extrabold text-[#1F2D3D] flex items-center gap-1.5">
                        <FlaskConical className="w-4 h-4 text-purple-700" />
                        <span>Extracted Laboratory Parameters ({labValues.length})</span>
                      </h5>
                      <button
                        type="button"
                        onClick={addLabRow}
                        className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#F5F9FA] border border-[#DDE7EA] text-xs font-bold text-[#0E7C86] inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{ui('Add Parameter')}</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {labValues.map((lv, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 rounded-xl bg-[#F5F9FA] border border-[#DDE7EA] items-center"
                        >
                          <input
                            type="text"
                            placeholder="Test name (e.g. Haemoglobin)"
                            value={lv.testName}
                            onChange={(e) => updateLabRow(idx, { testName: e.target.value })}
                            className="sm:col-span-4 min-h-[36px] px-2.5 py-1 rounded-lg border border-[#DDE7EA] bg-white text-xs font-bold"
                          />
                          <input
                            type="text"
                            placeholder="Value"
                            value={lv.value}
                            onChange={(e) => updateLabRow(idx, { value: e.target.value })}
                            className="sm:col-span-2 min-h-[36px] px-2.5 py-1 rounded-lg border border-[#DDE7EA] bg-white text-xs font-mono font-bold"
                          />
                          <input
                            type="text"
                            placeholder="Unit"
                            value={lv.unit}
                            onChange={(e) => updateLabRow(idx, { unit: e.target.value })}
                            className="sm:col-span-2 min-h-[36px] px-2.5 py-1 rounded-lg border border-[#DDE7EA] bg-white text-xs font-mono"
                          />
                          <input
                            type="text"
                            placeholder="Printed Ref Range"
                            value={lv.referenceRange}
                            onChange={(e) => updateLabRow(idx, { referenceRange: e.target.value })}
                            className="sm:col-span-2 min-h-[36px] px-2.5 py-1 rounded-lg border border-[#DDE7EA] bg-white text-xs font-mono"
                          />
                          <div className="sm:col-span-2 flex items-center gap-1">
                            <select
                              value={lv.status}
                              onChange={(e) =>
                                updateLabRow(idx, {
                                  status: e.target.value as 'NORMAL' | 'HIGH' | 'LOW',
                                })
                              }
                              className="flex-1 min-h-[36px] px-1.5 py-1 rounded-lg border border-[#DDE7EA] bg-white text-[11px] font-bold"
                            >
                              <option value="NORMAL">NORMAL</option>
                              <option value="HIGH">HIGH</option>
                              <option value="LOW">LOW</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => removeLabRow(idx)}
                              className="p-1.5 text-[#5B6B7A] hover:text-[#D32F2F]"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(reportType === 'Prescription' ||
                  reportType === 'Discharge Summary' ||
                  detectedMedicines.length > 0) && (
                  <div className="p-4 rounded-2xl bg-white border border-[#DDE7EA] space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-extrabold text-[#1F2D3D] flex items-center gap-1.5">
                        <Pill className="w-4 h-4 text-[#0E7C86]" />
                        <span>Extracted Medicines ({detectedMedicines.length})</span>
                      </h5>
                      <button
                        type="button"
                        onClick={addMedRow}
                        className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#F5F9FA] border border-[#DDE7EA] text-xs font-bold text-[#0E7C86] inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{ui('Add Medicine')}</span>
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {detectedMedicines.map((m, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-[#F5F9FA] border border-[#DDE7EA] space-y-2"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                            <input
                              type="text"
                              placeholder="Medicine name"
                              value={m.name}
                              onChange={(e) => updateMedRow(idx, { name: e.target.value })}
                              className="sm:col-span-4 min-h-[36px] px-2.5 py-1 rounded-lg border border-[#DDE7EA] bg-white text-xs font-bold"
                            />
                            <input
                              type="text"
                              placeholder="Strength (500 mg)"
                              value={m.strength}
                              onChange={(e) => updateMedRow(idx, { strength: e.target.value })}
                              className="sm:col-span-2 min-h-[36px] px-2.5 py-1 rounded-lg border border-[#DDE7EA] bg-white text-xs font-mono"
                            />
                            <input
                              type="text"
                              placeholder="Dosage (1 Tablet)"
                              value={m.dosage || ''}
                              onChange={(e) => updateMedRow(idx, { dosage: e.target.value })}
                              className="sm:col-span-2 min-h-[36px] px-2.5 py-1 rounded-lg border border-[#DDE7EA] bg-white text-xs"
                            />
                            <input
                              type="text"
                              placeholder="Schedule (e.g. 1-0-1)"
                              value={`${m.morning}-${m.noon}-${m.night}`}
                              onChange={(e) => {
                                const parts = e.target.value.split('-').map((p) => Number(p) || 0);
                                updateMedRow(idx, {
                                  morning: parts[0] ?? 1,
                                  noon: parts[1] ?? 0,
                                  night: parts[2] ?? 1,
                                });
                              }}
                              className="sm:col-span-3 min-h-[36px] px-2.5 py-1 rounded-lg border border-[#DDE7EA] bg-white text-xs font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => removeMedRow(idx)}
                              className="sm:col-span-1 p-1.5 text-[#5B6B7A] hover:text-[#D32F2F] justify-self-end"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              placeholder="Route (Oral)"
                              value={m.route || 'Oral'}
                              onChange={(e) => updateMedRow(idx, { route: e.target.value })}
                              className="min-h-[34px] px-2.5 py-1 rounded-lg border border-[#DDE7EA] bg-white text-xs"
                            />
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-[#5B6B7A]">Days:</span>
                              <input
                                type="number"
                                min={1}
                                max={365}
                                value={m.durationDays}
                                onChange={(e) =>
                                  updateMedRow(idx, {
                                    durationDays: Math.max(1, Number(e.target.value) || 5),
                                  })
                                }
                                className="w-full min-h-[34px] px-2.5 py-1 rounded-lg border border-[#DDE7EA] bg-white text-xs font-mono"
                              />
                            </div>
                            <input
                              type="text"
                              placeholder="Instructions (After food)"
                              value={m.instructions || ''}
                              onChange={(e) => updateMedRow(idx, { instructions: e.target.value })}
                              className="min-h-[34px] px-2.5 py-1 rounded-lg border border-[#DDE7EA] bg-white text-xs"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {labValues.length > 0 && (
              <LabReportExplanationPanel
                report={{
                  id: 'ocr-preview',
                  title: title || 'Extracted Lab Report Preview',
                  resultSummary: labValues
                    .map((l) => `${l.testName}: ${l.value} ${l.unit}`)
                    .join(' · '),
                  plainExplanation,
                  extractedFields: { labValues },
                }}
                lang={lang}
              />
            )}

            <div className="p-4 rounded-2xl bg-[#ECFDF5] border-2 border-[#1E8E5A]/40 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmedByUser}
                  onChange={(e) => setConfirmedByUser(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#0E7C86]"
                />
                <span className="text-xs font-bold text-[#1F2D3D]">
                  I have reviewed the original document alongside the extracted candidate fields above
                  and confirm their accuracy before saving to the HealthPass record (Category:{' '}
                  <span className="font-mono text-[#0E7C86]">{category}</span>).
                </span>
              </label>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-[#A7F3D0]">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-white border border-[#DDE7EA] text-xs font-bold text-[#5B6B7A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !confirmedByUser}
                  className="min-h-[44px] px-6 py-2.5 clay-btn-primary text-xs font-bold inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {saving
                      ? 'Saving Verified Record...'
                      : `Confirm & Save Verified ${reportType}`}
                  </span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
