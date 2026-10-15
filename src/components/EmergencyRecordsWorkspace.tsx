import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FilePlus2,
  FileText,
  Link2,
  Link2Off,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Upload,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '../api.ts';
import {
  SupportedLang,
  tr,
  translateDataSource,
  translateEmergencyStatus,
  translateVerificationTag,
  normalizePrimaryLang,
} from '../i18n/translations.ts';

export type FieldVerificationTag =
  | 'VERIFIED'
  | 'PATIENT_REPORTED'
  | 'DOCUMENT_EXTRACTED'
  | 'UNKNOWN_UNVERIFIED';

export type EmergencyRecordStatus =
  | 'IDENTITY_UNKNOWN'
  | 'VERIFICATION_PENDING'
  | 'AWAITING_CONSENT'
  | 'READY_FOR_LINKING'
  | 'LINKED'
  | 'LINKING_REJECTED'
  | 'CLOSED';

export interface EmergencyFieldEntry {
  text: string;
  tag: FieldVerificationTag;
}

export interface EmergencyDocumentEntry {
  id: string;
  title: string;
  mimeType: string;
  dataUrl?: string;
  summaryText?: string;
  tag: FieldVerificationTag;
  uploadedAt: string;
  uploadedByDoctorId: string;
  uploadedByDoctorName: string;
  facilityName: string;
}

export interface EmergencyLinkingWorkflow {
  targetPatientId: string;
  targetHealthPassId: string;
  targetPatientName: string;
  initiatedByDoctorId: string;
  initiatedByDoctorName: string;
  initiatedFacilityName: string;
  initiatedAt: string;
  identityVerified: boolean;
  identityVerificationMethod:
    | 'GOVERNMENT_ID_AND_BIOMETRIC'
    | 'GUARDIAN_ATTESTATION'
    | 'IN_PERSON_OTP_VERIFIED'
    | 'MULTI_FACTOR_CLINICAL_CHECK';
  identityVerificationNotes: string;
  authorizationBasis:
    | 'PATIENT_APP_CONSENT'
    | 'AUTHORIZED_REPRESENTATIVE'
    | 'LAWFUL_EMERGENCY_PROCESS';
  authorizedRepresentativeName?: string;
  authorizedRepresentativeRelation?: string;
  consentOrAuthReference: string;
  detectedConflicts: string[];
  conflictResolutionMode: 'KEEP_SEPARATE_PROVENANCE' | 'FLAG_FOR_CLINICAL_REVIEW';
  decisionStatus: 'PENDING_PATIENT_APPROVAL' | 'APPROVED_AND_LINKED' | 'REJECTED' | 'UNLINKED';
  decidedAt?: string;
  decidedBy?: string;
  rejectionOrUnlinkReason?: string;
  linkedVisitId?: string;
  linkedReportId?: string;
}

export interface EmergencyRecord {
  id: string;
  status: EmergencyRecordStatus;
  createdAt: string;
  updatedAt: string;
  createdByDoctorId: string;
  createdByDoctorName: string;
  createdByLicense?: string;
  facilityName: string;
  facilityLevel: string;
  facilityType: string;
  dataSource:
    | 'CLINICIAN_OBSERVED'
    | 'PATIENT_VERBALLY_REPORTED'
    | 'BYSTANDER_OR_PARAMEDIC'
    | 'DOCUMENT_EXTRACTED'
    | 'MIXED';
  patientDetails: {
    apparentName: EmergencyFieldEntry;
    estimatedAge: EmergencyFieldEntry;
    gender: EmergencyFieldEntry;
    bloodGroup: EmergencyFieldEntry;
    distinguishingNotes?: string;
  };
  emergencyObservations: EmergencyFieldEntry;
  allergies: EmergencyFieldEntry;
  medicines: EmergencyFieldEntry;
  medicalHistory: EmergencyFieldEntry;
  treatmentProvided: EmergencyFieldEntry;
  documents: EmergencyDocumentEntry[];
  linkingWorkflow?: EmergencyLinkingWorkflow;
  corrections: {
    id: string;
    timestamp: string;
    actorId: string;
    actorName: string;
    actorRole: string;
    facilityName: string;
    note: string;
  }[];
  auditTrail: {
    id: string;
    timestamp: string;
    action: string;
    actorId: string;
    actorName: string;
    actorRole: string;
    facilityName: string;
    details: string;
  }[];
}

const ALL_STATUSES: EmergencyRecordStatus[] = [
  'IDENTITY_UNKNOWN',
  'VERIFICATION_PENDING',
  'AWAITING_CONSENT',
  'READY_FOR_LINKING',
  'LINKED',
  'LINKING_REJECTED',
  'CLOSED',
];

const ALL_TAGS: FieldVerificationTag[] = [
  'VERIFIED',
  'PATIENT_REPORTED',
  'DOCUMENT_EXTRACTED',
  'UNKNOWN_UNVERIFIED',
];

function getStatusBadgeStyle(status: EmergencyRecordStatus): string {
  switch (status) {
    case 'IDENTITY_UNKNOWN':
      return 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]';
    case 'VERIFICATION_PENDING':
      return 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]';
    case 'AWAITING_CONSENT':
      return 'bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]';
    case 'READY_FOR_LINKING':
      return 'bg-[#ECFEFF] text-[#0E7490] border-[#A5F3FC]';
    case 'LINKED':
      return 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]';
    case 'LINKING_REJECTED':
      return 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]';
    case 'CLOSED':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-300';
  }
}

function getTagBadgeStyle(tag: FieldVerificationTag): string {
  switch (tag) {
    case 'VERIFIED':
      return 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]';
    case 'PATIENT_REPORTED':
      return 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]';
    case 'DOCUMENT_EXTRACTED':
      return 'bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]';
    case 'UNKNOWN_UNVERIFIED':
    default:
      return 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]';
  }
}

export const VerificationTagSelect: React.FC<{
  value: FieldVerificationTag;
  onChange: (tag: FieldVerificationTag) => void;
  lang: SupportedLang;
}> = ({ value, onChange, lang }) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as FieldVerificationTag)}
      className={`text-[11px] font-bold px-2 py-1 rounded border ${getTagBadgeStyle(
        value
      )} focus:outline-none focus:ring-2 focus:ring-[#0B6E6E]`}
    >
      {ALL_TAGS.map((tag) => (
        <option key={tag} value={tag} className="bg-white text-slate-800">
          {translateVerificationTag(tag, lang)}
        </option>
      ))}
    </select>
  );
};

export const EmergencyRecordsWorkspace: React.FC<{
  doctorId: string;
  doctorName: string;
  facilityName: string;
  lang: SupportedLang;
  initialSubView?: 'LIST' | 'LINKING';
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}> = ({ doctorId, doctorName, facilityName, lang, initialSubView = 'LIST', onNotify }) => {
  const pLang = normalizePrimaryLang(lang);
  const [records, setRecords] = useState<EmergencyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const searchRequestId = useRef(0);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [formDataSource, setFormDataSource] =
    useState<EmergencyRecord['dataSource']>('CLINICIAN_OBSERVED');
  const [formStatus, setFormStatus] = useState<EmergencyRecordStatus>('IDENTITY_UNKNOWN');
  const [formApparentName, setFormApparentName] = useState<EmergencyFieldEntry>({
    text: '',
    tag: 'UNKNOWN_UNVERIFIED',
  });
  const [formEstimatedAge, setFormEstimatedAge] = useState<EmergencyFieldEntry>({
    text: '',
    tag: 'UNKNOWN_UNVERIFIED',
  });
  const [formGender, setFormGender] = useState<EmergencyFieldEntry>({
    text: '',
    tag: 'VERIFIED',
  });
  const [formBloodGroup, setFormBloodGroup] = useState<EmergencyFieldEntry>({
    text: '',
    tag: 'UNKNOWN_UNVERIFIED',
  });
  const [formDistinguishingNotes, setFormDistinguishingNotes] = useState('');
  const [formObservations, setFormObservations] = useState<EmergencyFieldEntry>({
    text: '',
    tag: 'VERIFIED',
  });
  const [formAllergies, setFormAllergies] = useState<EmergencyFieldEntry>({
    text: '',
    tag: 'UNKNOWN_UNVERIFIED',
  });
  const [formMedicines, setFormMedicines] = useState<EmergencyFieldEntry>({
    text: '',
    tag: 'UNKNOWN_UNVERIFIED',
  });
  const [formHistory, setFormHistory] = useState<EmergencyFieldEntry>({
    text: '',
    tag: 'UNKNOWN_UNVERIFIED',
  });
  const [formTreatment, setFormTreatment] = useState<EmergencyFieldEntry>({
    text: '',
    tag: 'VERIFIED',
  });

  const [docTitle, setDocTitle] = useState('');
  const [docSummary, setDocSummary] = useState('');
  const [docTag, setDocTag] = useState<FieldVerificationTag>('DOCUMENT_EXTRACTED');

  const [correctionNote, setCorrectionNote] = useState('');

  const [linkHealthPassId, setLinkHealthPassId] = useState('HP-DEMO-0417');
  const [linkIdentityVerified, setLinkIdentityVerified] = useState(false);
  const [linkVerifyMethod, setLinkVerifyMethod] =
    useState<EmergencyLinkingWorkflow['identityVerificationMethod']>(
      'GOVERNMENT_ID_AND_BIOMETRIC'
    );
  const [linkVerifyNotes, setLinkVerifyNotes] = useState('');
  const [linkAuthBasis, setLinkAuthBasis] =
    useState<EmergencyLinkingWorkflow['authorizationBasis']>('PATIENT_APP_CONSENT');
  const [linkRepName, setLinkRepName] = useState('');
  const [linkRepRelation, setLinkRepRelation] = useState('');
  const [linkAuthRef, setLinkAuthRef] = useState('');
  const [linkConflictMode, setLinkConflictMode] =
    useState<EmergencyLinkingWorkflow['conflictResolutionMode']>('KEEP_SEPARATE_PROVENANCE');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [unlinkReason, setUnlinkReason] = useState('');

  const fetchEmergencyRecords = useCallback(async () => {
    const requestId = ++searchRequestId.current;
    setLoading(true);
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('query', searchQuery.trim());
    if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter);
    try {
      const res = await apiRequest<{ records: EmergencyRecord[] }>(
        `/api/emergency-records?${params.toString()}`,
        {
          doctorId,
          suppressGlobal403: true,
        }
      );
      if (requestId !== searchRequestId.current) return;
      if (res.ok && Array.isArray(res.data.records)) {
        setRecords(res.data.records);
        setSelectedRecordId((currentId) => res.data.records.some((record) => record.id === currentId)
          ? currentId
          : res.data.records[0]?.id || null);
      } else {
        setRecords([]);
        setSelectedRecordId(null);
      }
    } catch {
      if (requestId === searchRequestId.current) {
        setRecords([]);
        setSelectedRecordId(null);
      }
    } finally {
      if (requestId === searchRequestId.current) setLoading(false);
    }
  }, [doctorId, searchQuery, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchEmergencyRecords(); }, searchQuery.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [fetchEmergencyRecords]);

  useEffect(() => {
    if (initialSubView === 'LINKING' && records.length > 0) {
      const candidate =
        records.find((r) => r.status !== 'LINKED' && r.status !== 'CLOSED') || records[0];
      if (candidate) {
        setSelectedRecordId(candidate.id);
      }
    }
  }, [initialSubView, records]);

  const selectedRecord = records.find((r) => r.id === selectedRecordId) || records[0] || null;

  const populateFormFromRecord = (rec: EmergencyRecord) => {
    setFormDataSource(rec.dataSource);
    setFormStatus(rec.status);
    setFormApparentName({ ...rec.patientDetails.apparentName });
    setFormEstimatedAge({ ...rec.patientDetails.estimatedAge });
    setFormGender({ ...rec.patientDetails.gender });
    setFormBloodGroup({ ...rec.patientDetails.bloodGroup });
    setFormDistinguishingNotes(rec.patientDetails.distinguishingNotes || '');
    setFormObservations({ ...rec.emergencyObservations });
    setFormAllergies({ ...rec.allergies });
    setFormMedicines({ ...rec.medicines });
    setFormHistory({ ...rec.medicalHistory });
    setFormTreatment({ ...rec.treatmentProvided });
  };

  const resetFormForCreate = () => {
    setFormDataSource('CLINICIAN_OBSERVED');
    setFormStatus('IDENTITY_UNKNOWN');
    setFormApparentName({ text: '', tag: 'UNKNOWN_UNVERIFIED' });
    setFormEstimatedAge({ text: '', tag: 'UNKNOWN_UNVERIFIED' });
    setFormGender({ text: '', tag: 'VERIFIED' });
    setFormBloodGroup({ text: '', tag: 'UNKNOWN_UNVERIFIED' });
    setFormDistinguishingNotes('');
    setFormObservations({ text: '', tag: 'VERIFIED' });
    setFormAllergies({ text: '', tag: 'UNKNOWN_UNVERIFIED' });
    setFormMedicines({ text: '', tag: 'UNKNOWN_UNVERIFIED' });
    setFormHistory({ text: '', tag: 'UNKNOWN_UNVERIFIED' });
    setFormTreatment({ text: '', tag: 'VERIFIED' });
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await apiRequest<{ record: EmergencyRecord }>('/api/emergency-records', {
      method: 'POST',
      doctorId,
      suppressGlobal403: true,
      body: JSON.stringify({
        doctorId,
        status: formStatus,
        dataSource: formDataSource,
        patientDetails: {
          apparentName: {
            text: formApparentName.text.trim() || 'Unidentified Emergency Patient',
            tag: formApparentName.tag,
          },
          estimatedAge: {
            text: formEstimatedAge.text.trim() || 'Unknown',
            tag: formEstimatedAge.tag,
          },
          gender: {
            text: formGender.text.trim() || 'Unknown',
            tag: formGender.tag,
          },
          bloodGroup: {
            text: formBloodGroup.text.trim() || 'Unknown',
            tag: formBloodGroup.tag,
          },
          distinguishingNotes: formDistinguishingNotes.trim(),
        },
        emergencyObservations: formObservations,
        allergies: formAllergies,
        medicines: formMedicines,
        medicalHistory: formHistory,
        treatmentProvided: formTreatment,
      }),
    });
    setSubmitting(false);
    if (res.ok && res.data.record) {
      setShowCreateModal(false);
      await fetchEmergencyRecords();
      setSelectedRecordId(res.data.record.id);
      onNotify?.(
        pLang === 'TE'
          ? `శాశ్వత అత్యవసర రికార్డు ${res.data.record.id} సృష్టించబడింది.`
          : pLang === 'HI'
          ? `स्थायी आपातकालीन रिकॉर्ड ${res.data.record.id} सफलतापूर्वक बनाया गया।`
          : `Created permanent Emergency Record ${res.data.record.id}.`,
        'success'
      );
    } else {
      onNotify?.((res.data as any)?.error || 'Failed to create Emergency Record', 'error');
    }
  };

  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setSubmitting(true);
    const res = await apiRequest<{ record: EmergencyRecord }>(
      `/api/emergency-records/${selectedRecord.id}`,
      {
        method: 'PUT',
        doctorId,
        suppressGlobal403: true,
        body: JSON.stringify({
          doctorId,
          status: formStatus,
          dataSource: formDataSource,
          patientDetails: {
            apparentName: formApparentName,
            estimatedAge: formEstimatedAge,
            gender: formGender,
            bloodGroup: formBloodGroup,
            distinguishingNotes: formDistinguishingNotes,
          },
          emergencyObservations: formObservations,
          allergies: formAllergies,
          medicines: formMedicines,
          medicalHistory: formHistory,
          treatmentProvided: formTreatment,
        }),
      }
    );
    setSubmitting(false);
    if (res.ok && res.data.record) {
      setEditMode(false);
      await fetchEmergencyRecords();
      onNotify?.(
        pLang === 'TE'
          ? `అత్యవసర రికార్డు ${selectedRecord.id} నవీకరించబడింది.`
          : pLang === 'HI'
          ? `आपातकालीन रिकॉर्ड ${selectedRecord.id} अपडेट किया गया।`
          : `Updated Emergency Record ${selectedRecord.id}.`,
        'success'
      );
    } else {
      onNotify?.((res.data as any)?.error || 'Failed to update record', 'error');
    }
  };

  const handleAttachDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || !docTitle.trim()) return;
    setSubmitting(true);
    const res = await apiRequest<{ record: EmergencyRecord }>(
      `/api/emergency-records/${selectedRecord.id}/documents`,
      {
        method: 'POST',
        doctorId,
        suppressGlobal403: true,
        body: JSON.stringify({
          doctorId,
          title: docTitle.trim(),
          summaryText: docSummary.trim(),
          tag: docTag,
          fileDataUrl: '/demo-reports/sample-discharge-note.svg',
        }),
      }
    );
    setSubmitting(false);
    if (res.ok) {
      setDocTitle('');
      setDocSummary('');
      setShowDocModal(false);
      await fetchEmergencyRecords();
      onNotify?.(
        pLang === 'TE'
          ? `అత్యవసర పత్రం ${selectedRecord.id} కు జోడించబడింది.`
          : pLang === 'HI'
          ? `आपातकालीन दस्तावेज़ ${selectedRecord.id} में जोड़ा गया।`
          : `Attached emergency document to ${selectedRecord.id}.`,
        'success'
      );
    } else {
      onNotify?.((res.data as any)?.error || 'Failed to attach document', 'error');
    }
  };

  const handleAddCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || !correctionNote.trim()) return;
    setSubmitting(true);
    const res = await apiRequest<{ record: EmergencyRecord }>(
      `/api/emergency-records/${selectedRecord.id}/corrections`,
      {
        method: 'POST',
        doctorId,
        suppressGlobal403: true,
        body: JSON.stringify({
          doctorId,
          note: correctionNote.trim(),
        }),
      }
    );
    setSubmitting(false);
    if (res.ok) {
      setCorrectionNote('');
      setShowCorrectionModal(false);
      await fetchEmergencyRecords();
      onNotify?.(
        pLang === 'TE'
          ? `సవరణ గమనిక ${selectedRecord.id} లో నమోదు చేయబడింది.`
          : pLang === 'HI'
          ? `${selectedRecord.id} में संशोधन टिप्पणी जोड़ी गई।`
          : `Appended traceable correction to ${selectedRecord.id}.`,
        'success'
      );
    } else {
      onNotify?.((res.data as any)?.error || 'Failed to append correction', 'error');
    }
  };

  const handleInitiateLinking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setLinkError(null);
    setSubmitting(true);
    const res = await apiRequest<{ record: EmergencyRecord; error?: string }>(
      `/api/emergency-records/${selectedRecord.id}/link-initiate`,
      {
        method: 'POST',
        doctorId,
        suppressGlobal403: true,
        body: JSON.stringify({
          doctorId,
          targetHealthPassId: linkHealthPassId.trim(),
          identityVerified: linkIdentityVerified,
          identityVerificationMethod: linkVerifyMethod,
          identityVerificationNotes: linkVerifyNotes.trim(),
          authorizationBasis: linkAuthBasis,
          authorizedRepresentativeName: linkRepName.trim(),
          authorizedRepresentativeRelation: linkRepRelation.trim(),
          consentOrAuthReference: linkAuthRef.trim(),
          conflictResolutionMode: linkConflictMode,
        }),
      }
    );
    setSubmitting(false);
    if (res.ok && res.data.record) {
      setShowLinkModal(false);
      await fetchEmergencyRecords();
      onNotify?.(
        linkAuthBasis === 'PATIENT_APP_CONSENT'
          ? pLang === 'TE'
            ? `గుర్తింపు ధృవీకరించబడింది. రోగి (${linkHealthPassId}) డ్యాష్‌బోర్డ్‌కు లింకింగ్ అనుమతి అభ్యర్థన పంపబడింది.`
            : pLang === 'HI'
            ? `पहचान सत्यापित। मरीज (${linkHealthPassId}) के डैशबोर्ड पर लिंकिंग सहमति अनुरोध भेजा गया।`
            : `Identity verified! Linking consent request sent to patient ${linkHealthPassId}.`
          : pLang === 'TE'
          ? `గుర్తింపు & అధికారిక ప్రతినిధి వివరాలు నమోదు చేయబడ్డాయి. ఇప్పుడు లింకింగ్ పూర్తి చేయవచ్చు.`
          : pLang === 'HI'
          ? `पहचान और प्राधिकरण सत्यापित। अब आप लिंकिंग पूर्ण कर सकते हैं।`
          : `Identity & authorization verified for ${linkHealthPassId}. Ready to finalize linking.`,
        'info'
      );
    } else {
      setLinkError((res.data as any)?.error || 'Could not initiate linking.');
    }
  };

  const handleCompleteAuthorizedLinking = async () => {
    if (!selectedRecord) return;
    setSubmitting(true);
    const res = await apiRequest<{ record: EmergencyRecord; securityNotice?: string }>(
      `/api/emergency-records/${selectedRecord.id}/link-complete`,
      {
        method: 'POST',
        doctorId,
        suppressGlobal403: true,
        body: JSON.stringify({
          actorRole: 'doctor',
          doctorId,
          approvalNotes: 'Finalized after verified identity and documented authorization.',
        }),
      }
    );
    setSubmitting(false);
    if (res.ok && res.data.record) {
      await fetchEmergencyRecords();
      onNotify?.(
        pLang === 'TE'
          ? `అత్యవసర రికార్డు ${selectedRecord.id} సురక్షితంగా లింక్ చేయబడింది. అసలు మూల వివరాలు భద్రపరచబడ్డాయి.`
          : pLang === 'HI'
          ? `आपातकालीन रिकॉर्ड ${selectedRecord.id} सुरक्षित रूप से लिंक किया गया। मूल स्रोत सुरक्षित रखा गया है।`
          : `Emergency Record ${selectedRecord.id} securely linked with full provenance preserved.`,
        'success'
      );
    } else {
      onNotify?.((res.data as any)?.error || 'Could not finalize linking', 'error');
    }
  };

  const handleRejectLinking = async () => {
    if (!selectedRecord) return;
    setSubmitting(true);
    const res = await apiRequest<{ record: EmergencyRecord }>(
      `/api/emergency-records/${selectedRecord.id}/link-reject`,
      {
        method: 'POST',
        doctorId,
        suppressGlobal403: true,
        body: JSON.stringify({
          actorRole: 'doctor',
          doctorId,
          reason: 'Rejected during clinical verification / discrepancy review',
        }),
      }
    );
    setSubmitting(false);
    if (res.ok) {
      await fetchEmergencyRecords();
      onNotify?.(
        pLang === 'TE'
          ? `లింకింగ్ తిరస్కరించబడింది. రోగి శాశ్వత రికార్డులో ఎలాంటి మార్పు చేయబడలేదు.`
          : pLang === 'HI'
          ? `लिंकिंग अस्वीकृत। मरीज के स्थायी रिकॉर्ड में कोई बदलाव नहीं किया गया।`
          : `Linking rejected. Permanent patient record left unchanged.`,
        'info'
      );
    }
  };

  const handleUnlinkRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || !unlinkReason.trim()) return;
    setSubmitting(true);
    const res = await apiRequest<{ record: EmergencyRecord }>(
      `/api/emergency-records/${selectedRecord.id}/unlink`,
      {
        method: 'POST',
        doctorId,
        suppressGlobal403: true,
        body: JSON.stringify({
          actorRole: 'doctor',
          doctorId,
          reason: unlinkReason.trim(),
        }),
      }
    );
    setSubmitting(false);
    if (res.ok) {
      setUnlinkReason('');
      setShowUnlinkModal(false);
      await fetchEmergencyRecords();
      onNotify?.(
        pLang === 'TE'
          ? `అత్యవసర రికార్డు ${selectedRecord.id} అన్‌లింక్ చేయబడింది.`
          : pLang === 'HI'
          ? `आपातकालीन रिकॉर्ड ${selectedRecord.id} को अनलिंक कर दिया गया।`
          : `Emergency Record ${selectedRecord.id} unlinked and audit logged.`,
        'info'
      );
    } else {
      onNotify?.((res.data as any)?.error || 'Failed to unlink record', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]">
                <Stethoscope className="w-3.5 h-3.5" />
                {tr('navEmergencyRecords', lang)}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {doctorName} · {facilityName}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#1F2D3D] mt-1.5">
              {tr('erTitle', lang)}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5 max-w-3xl">
              {tr('erSubtitle', lang)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                resetFormForCreate();
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold bg-[#0B6E6E] hover:bg-[#095858] text-white shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {tr('erCreateNewBtn', lang)}
            </button>
            <button
              type="button"
              onClick={fetchEmergencyRecords}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {pLang === 'TE' ? 'రిఫ్రెష్' : pLang === 'HI' ? 'रीफ़्रेश' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0">
            <label htmlFor="emergency-record-search" className="block mb-1.5 text-sm font-bold text-slate-800">{tr('erSearchLabel', lang)}</label>
            <div className="relative">
              <Search aria-hidden="true" className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="emergency-record-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr('erSearchPlaceholder', lang)}
                aria-describedby="emergency-search-help emergency-search-status"
                className="w-full min-h-11 pl-10 pr-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0B6E6E]"
              />
            </div>
            <p id="emergency-search-help" className="mt-1 text-xs text-slate-600">{tr('erSearchHelp', lang)}</p>
            <p id="emergency-search-status" role="status" aria-live="polite" className="mt-1 min-h-5 text-xs font-semibold text-[#0B6E6E]">
              {loading
                ? tr('erSearching', lang)
                : `${records.length} ${tr('erResultsCount', lang)}`}
            </p>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={tr('erFilterAllStatuses', lang)}
            className="w-full sm:w-auto min-h-11 px-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#0B6E6E]"
          >
            <option value="ALL">{tr('erFilterAllStatuses', lang)}</option>
            {ALL_STATUSES.map((st) => (
              <option key={st} value={st}>
                {translateEmergencyStatus(st, lang)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 space-y-2.5">
          {records.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-sm">
              {loading ? tr('erSearching', lang) : tr('erNoRecordsFound', lang)}
              {!loading && (searchQuery || statusFilter !== 'ALL') && <button type="button" onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); }} className="mt-3 mx-auto block min-h-10 px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold text-[#0B6E6E] hover:bg-slate-50">{pLang === 'TE' ? 'శోధనను తీసివేయండి' : pLang === 'HI' ? 'खोज हटाएं' : 'Clear search and filters'}</button>}
            </div>
          ) : (
            records.map((rec) => {
              const isSelected = selectedRecord?.id === rec.id;
              return (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => {
                    setSelectedRecordId(rec.id);
                    setEditMode(false);
                  }}
                  className={`w-full text-left rounded-xl border p-3.5 transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#F0FDF4] border-[#0B6E6E] ring-2 ring-[#0B6E6E]/20'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs sm:text-sm font-extrabold text-[#0B6E6E]">
                      {rec.id}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusBadgeStyle(
                        rec.status
                      )}`}
                    >
                      {translateEmergencyStatus(rec.status, lang)}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-[#1F2D3D] mt-1.5 truncate">
                    {rec.patientDetails.apparentName.text || 'Unidentified Patient'}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                    {rec.emergencyObservations.text || rec.treatmentProvided.text}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                    <span className="truncate">{rec.facilityName}</span>
                    {rec.linkingWorkflow?.targetHealthPassId && (
                      <span className="font-mono font-bold text-[#0B6E6E]">
                        → {rec.linkingWorkflow.targetHealthPassId}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="lg:col-span-8">
          {!selectedRecord ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
              {tr('erNoRecordsFound', lang)}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-base sm:text-lg font-extrabold text-[#0B6E6E] bg-[#F0FDF4] px-2.5 py-0.5 rounded border border-[#A7F3D0]">
                      {selectedRecord.id}
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded border ${getStatusBadgeStyle(
                        selectedRecord.status
                      )}`}
                    >
                      {translateEmergencyStatus(selectedRecord.status, lang)}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold text-[#1F2D3D] mt-2">
                    {selectedRecord.patientDetails.apparentName.text}
                  </h3>
                  <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                    <div>
                      <span className="font-semibold text-slate-700">
                        {tr('erCreatedByLabel', lang)}:
                      </span>{' '}
                      {selectedRecord.createdByDoctorName} ({selectedRecord.facilityName} ·{' '}
                      {selectedRecord.facilityLevel})
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">
                        {tr('erDataSourceLabel', lang)}:
                      </span>{' '}
                      {translateDataSource(selectedRecord.dataSource, lang)} ·{' '}
                      <span className="font-semibold text-slate-700">
                        {tr('erCreatedAtLabel', lang)}:
                      </span>{' '}
                      {new Date(selectedRecord.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!editMode && selectedRecord.status !== 'CLOSED' && (
                    <button
                      type="button"
                      onClick={() => {
                        populateFormFromRecord(selectedRecord);
                        setEditMode(true);
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
                    >
                      {pLang === 'TE'
                        ? 'రికార్డు సవరించు (Edit)'
                        : pLang === 'HI'
                        ? 'रिकॉर्ड संपादित करें (Edit)'
                        : 'Edit Fields & Tags'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowDocModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {tr('erAddDocumentBtn', lang)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCorrectionModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
                  >
                    <FilePlus2 className="w-3.5 h-3.5" />
                    {tr('erAddCorrectionBtn', lang)}
                  </button>
                  {selectedRecord.status !== 'LINKED' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setLinkError(null);
                        if (selectedRecord.linkingWorkflow?.targetHealthPassId) {
                          setLinkHealthPassId(selectedRecord.linkingWorkflow.targetHealthPassId);
                        }
                        setShowLinkModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-[#0B6E6E] hover:bg-[#095858] text-white shadow-xs cursor-pointer"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      {tr('erLinkToPatientBtn', lang)}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowUnlinkModal(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-[#FEF2F2] hover:bg-red-100 text-[#B91C1C] border border-[#FECACA] cursor-pointer"
                    >
                      <Link2Off className="w-3.5 h-3.5" />
                      {tr('erUnlinkRecordBtn', lang)}
                    </button>
                  )}
                </div>
              </div>

              {selectedRecord.linkingWorkflow && (
                <div className="rounded-xl border border-[#A5F3FC] bg-[#ECFEFF]/60 p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-[#0E7490]" />
                      <span className="text-xs sm:text-sm font-extrabold text-[#1F2D3D]">
                        {pLang === 'TE'
                          ? 'రోగి రికార్డు లింకింగ్ స్థితి'
                          : pLang === 'HI'
                          ? 'मरीज रिकॉर्ड लिंकिंग स्थिति'
                          : 'Patient Record Linking Workflow'}
                        : {selectedRecord.linkingWorkflow.targetPatientName} (
                        <span className="font-mono text-[#0B6E6E]">
                          {selectedRecord.linkingWorkflow.targetHealthPassId}
                        </span>
                        )
                      </span>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                      {selectedRecord.linkingWorkflow.decisionStatus}
                    </span>
                  </div>
                  <div className="text-xs text-slate-700 space-y-1">
                    <div>
                      <strong>
                        {pLang === 'TE'
                          ? 'గుర్తింపు ధృవీకరణ'
                          : pLang === 'HI'
                          ? 'पहचान सत्यापन'
                          : 'Identity Verification'}
                        :
                      </strong>{' '}
                      {selectedRecord.linkingWorkflow.identityVerificationMethod} — &ldquo;
                      {selectedRecord.linkingWorkflow.identityVerificationNotes}&rdquo;
                    </div>
                    <div>
                      <strong>{tr('linkAuthBasisLabel', lang)}:</strong>{' '}
                      {selectedRecord.linkingWorkflow.authorizationBasis}
                      {selectedRecord.linkingWorkflow.authorizedRepresentativeName
                        ? ` (${selectedRecord.linkingWorkflow.authorizedRepresentativeName} - ${selectedRecord.linkingWorkflow.authorizedRepresentativeRelation})`
                        : ''}
                    </div>
                    {selectedRecord.linkingWorkflow.detectedConflicts.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[#B45309] text-xs">
                        <strong>
                          {pLang === 'TE'
                            ? 'సమాచార తేడాల సమీక్ష:'
                            : pLang === 'HI'
                            ? 'डेटा अंतर समीक्षा:'
                            : 'Conflict / Provenance Review:'}
                        </strong>{' '}
                        {selectedRecord.linkingWorkflow.detectedConflicts.join(' | ')}
                      </div>
                    )}
                  </div>

                  {selectedRecord.status !== 'LINKED' &&
                    selectedRecord.linkingWorkflow.decisionStatus === 'PENDING_PATIENT_APPROVAL' && (
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        {selectedRecord.linkingWorkflow.authorizationBasis !==
                          'PATIENT_APP_CONSENT' && (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={handleCompleteAuthorizedLinking}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1F8A5B] hover:bg-emerald-700 text-white cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {tr('linkCompleteNowBtn', lang)}
                          </button>
                        )}
                        {selectedRecord.linkingWorkflow.authorizationBasis ===
                          'PATIENT_APP_CONSENT' && (
                          <span className="text-xs font-semibold text-[#6D28D9] bg-[#F5F3FF] px-2.5 py-1 rounded border border-[#DDD6FE]">
                            {pLang === 'TE'
                              ? 'రోగి డ్యాష్‌బోర్డ్‌లో ఆమోదం కోసం వేచి ఉంది'
                              : pLang === 'HI'
                              ? 'मरीज کے ڈیش بورڈ پر منظوری کا انتظار ہے'
                              : 'Waiting for patient to approve link in Patient Dashboard'}
                          </span>
                        )}
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={handleRejectLinking}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-red-50 text-[#B91C1C] border border-[#FECACA] cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          {tr('linkRejectBtn', lang)}
                        </button>
                      </div>
                    )}
                </div>
              )}

              {editMode ? (
                <form onSubmit={handleUpdateRecord} className="space-y-4">
                  <div className="p-3 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#B45309] font-medium">
                    {tr('erIncompleteAllowedNotice', lang)}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {tr('erStatusLabel', lang)}
                      </label>
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as EmergencyRecordStatus)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                      >
                        {ALL_STATUSES.filter((s) => s !== 'LINKED').map((st) => (
                          <option key={st} value={st}>
                            {translateEmergencyStatus(st, lang)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {tr('erDataSourceLabel', lang)}
                      </label>
                      <select
                        value={formDataSource}
                        onChange={(e) =>
                          setFormDataSource(e.target.value as EmergencyRecord['dataSource'])
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                      >
                        <option value="CLINICIAN_OBSERVED">
                          {tr('sourceClinicianObserved', lang)}
                        </option>
                        <option value="PATIENT_VERBALLY_REPORTED">
                          {tr('sourcePatientReported', lang)}
                        </option>
                        <option value="BYSTANDER_OR_PARAMEDIC">
                          {tr('sourceBystanderParamedic', lang)}
                        </option>
                        <option value="DOCUMENT_EXTRACTED">
                          {tr('sourceDocumentExtracted', lang)}
                        </option>
                        <option value="MIXED">{tr('sourceMixed', lang)}</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <label className="text-xs font-bold text-slate-700">
                          {tr('erApparentName', lang)}
                        </label>
                        <VerificationTagSelect
                          value={formApparentName.tag}
                          onChange={(tag) => setFormApparentName((p) => ({ ...p, tag }))}
                          lang={lang}
                        />
                      </div>
                      <input
                        type="text"
                        value={formApparentName.text}
                        onChange={(e) =>
                          setFormApparentName((p) => ({ ...p, text: e.target.value }))
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <label className="text-xs font-bold text-slate-700">
                          {tr('erEstimatedAge', lang)}
                        </label>
                        <VerificationTagSelect
                          value={formEstimatedAge.tag}
                          onChange={(tag) => setFormEstimatedAge((p) => ({ ...p, tag }))}
                          lang={lang}
                        />
                      </div>
                      <input
                        type="text"
                        value={formEstimatedAge.text}
                        onChange={(e) =>
                          setFormEstimatedAge((p) => ({ ...p, text: e.target.value }))
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <label className="text-xs font-bold text-slate-700">
                          {tr('erGender', lang)}
                        </label>
                        <VerificationTagSelect
                          value={formGender.tag}
                          onChange={(tag) => setFormGender((p) => ({ ...p, tag }))}
                          lang={lang}
                        />
                      </div>
                      <input
                        type="text"
                        value={formGender.text}
                        onChange={(e) => setFormGender((p) => ({ ...p, text: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <label className="text-xs font-bold text-slate-700">
                          {tr('erBloodGroup', lang)}
                        </label>
                        <VerificationTagSelect
                          value={formBloodGroup.tag}
                          onChange={(tag) => setFormBloodGroup((p) => ({ ...p, tag }))}
                          lang={lang}
                        />
                      </div>
                      <input
                        type="text"
                        value={formBloodGroup.text}
                        onChange={(e) =>
                          setFormBloodGroup((p) => ({ ...p, text: e.target.value }))
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {tr('erDistinguishingNotes', lang)}
                      </label>
                      <input
                        type="text"
                        value={formDistinguishingNotes}
                        onChange={(e) => setFormDistinguishingNotes(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                    </div>
                  </div>

                  {[
                    {
                      label: tr('erObservationsSection', lang),
                      entry: formObservations,
                      setEntry: setFormObservations,
                    },
                    {
                      label: tr('erTreatmentSection', lang),
                      entry: formTreatment,
                      setEntry: setFormTreatment,
                    },
                    {
                      label: tr('erAllergiesSection', lang),
                      entry: formAllergies,
                      setEntry: setFormAllergies,
                    },
                    {
                      label: tr('erMedicinesSection', lang),
                      entry: formMedicines,
                      setEntry: setFormMedicines,
                    },
                    {
                      label: tr('erHistorySection', lang),
                      entry: formHistory,
                      setEntry: setFormHistory,
                    },
                  ].map((sec, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-bold text-slate-700">{sec.label}</label>
                        <VerificationTagSelect
                          value={sec.entry.tag}
                          onChange={(tag) => sec.setEntry((p) => ({ ...p, tag }))}
                          lang={lang}
                        />
                      </div>
                      <textarea
                        rows={2}
                        value={sec.entry.text}
                        onChange={(e) => sec.setEntry((p) => ({ ...p, text: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                      />
                    </div>
                  ))}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditMode(false)}
                      className="px-4 py-2 rounded-lg text-xs font-bold border border-slate-300 text-slate-700 cursor-pointer"
                    >
                      {tr('closeBtn', lang)}
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 rounded-lg text-xs font-bold bg-[#0B6E6E] text-white cursor-pointer"
                    >
                      {tr('erUpdateRecordBtn', lang)}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2.5">
                      {tr('erPatientDetailsSection', lang)}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {[
                        {
                          label: tr('erApparentName', lang),
                          val: selectedRecord.patientDetails.apparentName,
                        },
                        {
                          label: tr('erEstimatedAge', lang),
                          val: selectedRecord.patientDetails.estimatedAge,
                        },
                        {
                          label: tr('erGender', lang),
                          val: selectedRecord.patientDetails.gender,
                        },
                        {
                          label: tr('erBloodGroup', lang),
                          val: selectedRecord.patientDetails.bloodGroup,
                        },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between gap-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-slate-500">
                              {item.label}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getTagBadgeStyle(
                                item.val.tag
                              )}`}
                            >
                              {translateVerificationTag(item.val.tag, lang)}
                            </span>
                          </div>
                          <div className="text-xs sm:text-sm font-bold text-[#1F2D3D]">
                            {item.val.text || '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedRecord.patientDetails.distinguishingNotes && (
                      <div className="mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                        <span className="font-bold">
                          {tr('erDistinguishingNotes', lang)}:
                        </span>{' '}
                        {selectedRecord.patientDetails.distinguishingNotes}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {[
                      {
                        label: tr('erObservationsSection', lang),
                        entry: selectedRecord.emergencyObservations,
                      },
                      {
                        label: tr('erTreatmentSection', lang),
                        entry: selectedRecord.treatmentProvided,
                      },
                      {
                        label: tr('erAllergiesSection', lang),
                        entry: selectedRecord.allergies,
                      },
                      {
                        label: tr('erMedicinesSection', lang),
                        entry: selectedRecord.medicines,
                      },
                      {
                        label: tr('erHistorySection', lang),
                        entry: selectedRecord.medicalHistory,
                      },
                    ].map((sec, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-extrabold text-[#1F2D3D]">
                            {sec.label}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getTagBadgeStyle(
                              sec.entry.tag
                            )}`}
                          >
                            {translateVerificationTag(sec.entry.tag, lang)}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-line">
                          {sec.entry.text || '—'}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      {tr('erDocumentsSection', lang)} ({selectedRecord.documents.length})
                    </h4>
                    {selectedRecord.documents.length === 0 ? (
                      <div className="text-xs text-slate-500 italic">
                        {pLang === 'TE'
                          ? 'పత్రాలు జోడించబడలేదు.'
                          : pLang === 'HI'
                          ? 'कोई दस्तावेज़ संलग्न नहीं है।'
                          : 'No emergency triage documents attached yet.'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {selectedRecord.documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[#1F2D3D] flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-[#0B6E6E]" />
                                {doc.title}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getTagBadgeStyle(
                                  doc.tag
                                )}`}
                              >
                                {translateVerificationTag(doc.tag, lang)}
                              </span>
                            </div>
                            {doc.summaryText && (
                              <p className="text-xs text-slate-600">{doc.summaryText}</p>
                            )}
                            <div className="text-[10px] text-slate-400">
                              {doc.uploadedByDoctorName} · {doc.facilityName}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedRecord.corrections.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                        {pLang === 'TE'
                          ? 'సవరణ చరిత్ర (Traceable Corrections)'
                          : pLang === 'HI'
                          ? 'संशोधन इतिहास (Traceable Corrections)'
                          : 'Traceable Clinical Corrections'}
                      </h4>
                      {selectedRecord.corrections.map((c) => (
                        <div
                          key={c.id}
                          className="p-3 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-xs text-slate-800"
                        >
                          <div className="font-bold text-[#B45309]">
                            {c.actorName} ({c.facilityName}) ·{' '}
                            {new Date(c.timestamp).toLocaleString()}
                          </div>
                          <div className="mt-0.5">{c.note}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      {tr('erAuditSection', lang)} ({selectedRecord.auditTrail.length})
                    </h4>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {selectedRecord.auditTrail.map((a) => (
                        <div
                          key={a.id}
                          className="text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                        >
                          <div>
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 mr-2">
                              {a.action}
                            </span>
                            <span className="text-slate-700 font-medium">{a.details}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            {new Date(a.timestamp).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-[#1F2D3D]">
                  {tr('erCreateNewBtn', lang)}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  {tr('erIncompleteAllowedNotice', lang)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {tr('erStatusLabel', lang)}
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as EmergencyRecordStatus)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                  >
                    <option value="IDENTITY_UNKNOWN">
                      {translateEmergencyStatus('IDENTITY_UNKNOWN', lang)}
                    </option>
                    <option value="VERIFICATION_PENDING">
                      {translateEmergencyStatus('VERIFICATION_PENDING', lang)}
                    </option>
                    <option value="READY_FOR_LINKING">
                      {translateEmergencyStatus('READY_FOR_LINKING', lang)}
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {tr('erDataSourceLabel', lang)}
                  </label>
                  <select
                    value={formDataSource}
                    onChange={(e) =>
                      setFormDataSource(e.target.value as EmergencyRecord['dataSource'])
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                  >
                    <option value="CLINICIAN_OBSERVED">
                      {tr('sourceClinicianObserved', lang)}
                    </option>
                    <option value="PATIENT_VERBALLY_REPORTED">
                      {tr('sourcePatientReported', lang)}
                    </option>
                    <option value="BYSTANDER_OR_PARAMEDIC">
                      {tr('sourceBystanderParamedic', lang)}
                    </option>
                    <option value="DOCUMENT_EXTRACTED">
                      {tr('sourceDocumentExtracted', lang)}
                    </option>
                    <option value="MIXED">{tr('sourceMixed', lang)}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      {tr('erApparentName', lang)}
                    </label>
                    <VerificationTagSelect
                      value={formApparentName.tag}
                      onChange={(tag) => setFormApparentName((p) => ({ ...p, tag }))}
                      lang={lang}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g., Unidentified Female / Triage Bed 3"
                    value={formApparentName.text}
                    onChange={(e) =>
                      setFormApparentName((p) => ({ ...p, text: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      {tr('erEstimatedAge', lang)}
                    </label>
                    <VerificationTagSelect
                      value={formEstimatedAge.tag}
                      onChange={(tag) => setFormEstimatedAge((p) => ({ ...p, tag }))}
                      lang={lang}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g., Approx 45 yrs"
                    value={formEstimatedAge.text}
                    onChange={(e) =>
                      setFormEstimatedAge((p) => ({ ...p, text: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      {tr('erGender', lang)}
                    </label>
                    <VerificationTagSelect
                      value={formGender.tag}
                      onChange={(tag) => setFormGender((p) => ({ ...p, tag }))}
                      lang={lang}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Female / Male / Unknown"
                    value={formGender.text}
                    onChange={(e) => setFormGender((p) => ({ ...p, text: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      {tr('erBloodGroup', lang)}
                    </label>
                    <VerificationTagSelect
                      value={formBloodGroup.tag}
                      onChange={(tag) => setFormBloodGroup((p) => ({ ...p, tag }))}
                      lang={lang}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="O+ / Unknown"
                    value={formBloodGroup.text}
                    onChange={(e) =>
                      setFormBloodGroup((p) => ({ ...p, text: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {tr('erDistinguishingNotes', lang)}
                  </label>
                  <input
                    type="text"
                    placeholder="Brought by ambulance without HealthPass card..."
                    value={formDistinguishingNotes}
                    onChange={(e) => setFormDistinguishingNotes(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  />
                </div>
              </div>

              {[
                {
                  label: tr('erObservationsSection', lang),
                  entry: formObservations,
                  setEntry: setFormObservations,
                  placeholder: 'Vitals, consciousness, presenting acute symptoms...',
                },
                {
                  label: tr('erTreatmentSection', lang),
                  entry: formTreatment,
                  setEntry: setFormTreatment,
                  placeholder: 'IV fluids, stabilization, medications administered...',
                },
                {
                  label: tr('erAllergiesSection', lang),
                  entry: formAllergies,
                  setEntry: setFormAllergies,
                  placeholder: 'Reported allergies or Unknown...',
                },
                {
                  label: tr('erMedicinesSection', lang),
                  entry: formMedicines,
                  setEntry: setFormMedicines,
                  placeholder: 'Medicines found or reported...',
                },
                {
                  label: tr('erHistorySection', lang),
                  entry: formHistory,
                  setEntry: setFormHistory,
                  placeholder: 'Relevant medical history if known...',
                },
              ].map((sec, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-700">{sec.label}</label>
                    <VerificationTagSelect
                      value={sec.entry.tag}
                      onChange={(tag) => sec.setEntry((p) => ({ ...p, tag }))}
                      lang={lang}
                    />
                  </div>
                  <textarea
                    rows={2}
                    placeholder={sec.placeholder}
                    value={sec.entry.text}
                    onChange={(e) => sec.setEntry((p) => ({ ...p, text: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              ))}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold border border-slate-300 text-slate-700 cursor-pointer"
                >
                  {tr('closeBtn', lang)}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-[#0B6E6E] hover:bg-[#095858] text-white cursor-pointer"
                >
                  {tr('erSaveRecordBtn', lang)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLinkModal && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-mono font-bold text-[#0B6E6E]">
                  {selectedRecord.id}
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-[#1F2D3D]">
                  {tr('linkModalTitle', lang)}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">{tr('linkModalSubtitle', lang)}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {linkError && (
              <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs font-bold text-[#B91C1C] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{linkError}</span>
              </div>
            )}

            <form onSubmit={handleInitiateLinking} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="block text-xs font-extrabold text-[#1F2D3D]">
                  {tr('linkStep1Title', lang)}
                </label>
                <input
                  type="text"
                  required
                  value={linkHealthPassId}
                  onChange={(e) => setLinkHealthPassId(e.target.value)}
                  placeholder={tr('linkHealthPassIdPlaceholder', lang)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm font-mono font-bold bg-white"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    { id: 'HP-DEMO-0417', name: 'Ananya Rao' },
                    { id: 'HP-CHILD-0892', name: 'Aarav Rao' },
                    { id: 'HP-ELDER-0931', name: 'Venkateswara Rao' },
                  ].map((demo) => (
                    <button
                      key={demo.id}
                      type="button"
                      onClick={() => setLinkHealthPassId(demo.id)}
                      className="text-[11px] font-bold px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"
                    >
                      {demo.id} ({demo.name})
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-xs font-extrabold text-[#1F2D3D]">
                  {tr('linkStep2Title', lang)}
                </div>
                <div>
                  <select
                    value={linkVerifyMethod}
                    onChange={(e) =>
                      setLinkVerifyMethod(
                        e.target.value as EmergencyLinkingWorkflow['identityVerificationMethod']
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                  >
                    <option value="GOVERNMENT_ID_AND_BIOMETRIC">
                      {tr('linkMethodGovId', lang)}
                    </option>
                    <option value="IN_PERSON_OTP_VERIFIED">{tr('linkMethodOtp', lang)}</option>
                    <option value="GUARDIAN_ATTESTATION">
                      {tr('linkMethodGuardian', lang)}
                    </option>
                    <option value="MULTI_FACTOR_CLINICAL_CHECK">
                      {tr('linkMethodClinical', lang)}
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {tr('linkVerificationNotesLabel', lang)}
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={linkVerifyNotes}
                    onChange={(e) => setLinkVerifyNotes(e.target.value)}
                    placeholder={tr('linkVerificationNotesPlaceholder', lang)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                  />
                </div>
                <label className="flex items-start gap-2 text-xs text-slate-800 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={linkIdentityVerified}
                    onChange={(e) => setLinkIdentityVerified(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-[#0B6E6E]"
                  />
                  <span>{tr('linkVerifyCheckbox', lang)}</span>
                </label>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-xs font-extrabold text-[#1F2D3D]">
                  {tr('linkStep3Title', lang)}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {tr('linkAuthBasisLabel', lang)}
                  </label>
                  <select
                    value={linkAuthBasis}
                    onChange={(e) =>
                      setLinkAuthBasis(
                        e.target.value as EmergencyLinkingWorkflow['authorizationBasis']
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                  >
                    <option value="PATIENT_APP_CONSENT">
                      {tr('linkAuthPatientConsent', lang)}
                    </option>
                    <option value="AUTHORIZED_REPRESENTATIVE">
                      {tr('linkAuthRepresentative', lang)}
                    </option>
                    <option value="LAWFUL_EMERGENCY_PROCESS">
                      {tr('linkAuthLawfulEmergency', lang)}
                    </option>
                  </select>
                </div>

                {linkAuthBasis === 'AUTHORIZED_REPRESENTATIVE' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {tr('linkRepNameLabel', lang)}
                      </label>
                      <input
                        type="text"
                        required
                        value={linkRepName}
                        onChange={(e) => setLinkRepName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {tr('linkRepRelationLabel', lang)}
                      </label>
                      <input
                        type="text"
                        required
                        value={linkRepRelation}
                        onChange={(e) => setLinkRepRelation(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                    </div>
                  </div>
                )}

                {linkAuthBasis === 'LAWFUL_EMERGENCY_PROCESS' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {tr('linkAuthRefLabel', lang)}
                    </label>
                    <input
                      type="text"
                      required
                      value={linkAuthRef}
                      onChange={(e) => setLinkAuthRef(e.target.value)}
                      placeholder="e.g., District Hospital Emergency Triage Protocol Ref #ER-8821"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {pLang === 'TE'
                      ? 'సమాచార తేడాల నిర్వహణ'
                      : pLang === 'HI'
                      ? 'विरोधाभास / अंतर प्रबंधन'
                      : 'Conflict & Duplicate Handling Mode'}
                  </label>
                  <select
                    value={linkConflictMode}
                    onChange={(e) =>
                      setLinkConflictMode(
                        e.target.value as EmergencyLinkingWorkflow['conflictResolutionMode']
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                  >
                    <option value="KEEP_SEPARATE_PROVENANCE">
                      {tr('linkConflictModeKeepSeparate', lang)}
                    </option>
                    <option value="FLAG_FOR_CLINICAL_REVIEW">
                      {tr('linkConflictModeFlagReview', lang)}
                    </option>
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-[11px] text-[#1D4ED8] font-medium">
                {tr('linkSecurityNotice', lang)}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold border border-slate-300 text-slate-700 cursor-pointer"
                >
                  {tr('closeBtn', lang)}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-[#0B6E6E] hover:bg-[#095858] text-white cursor-pointer"
                >
                  {tr('linkInitiateBtn', lang)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDocModal && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-base font-extrabold text-[#1F2D3D]">
              {tr('erAddDocumentBtn', lang)} ({selectedRecord.id})
            </h3>
            <form onSubmit={handleAttachDocument} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {pLang === 'TE'
                    ? 'పత్రం శీర్షిక'
                    : pLang === 'HI'
                    ? 'दस्तावेज़ का शीर्षक'
                    : 'Document Title'}
                </label>
                <input
                  type="text"
                  required
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g., Emergency Triage ECG / Point-of-Care Glucose Strip"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {pLang === 'TE'
                    ? 'సారాంశం / ఫలితాలు'
                    : pLang === 'HI'
                    ? 'सारांश / निष्कर्ष'
                    : 'Clinical Summary / Findings'}
                </label>
                <textarea
                  rows={2}
                  value={docSummary}
                  onChange={(e) => setDocSummary(e.target.value)}
                  placeholder="Key findings recorded from document..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {pLang === 'TE'
                    ? 'ధృవీకరణ ట్యాగ్'
                    : pLang === 'HI'
                    ? 'सत्यापन टैग'
                    : 'Verification Tag'}
                </label>
                <VerificationTagSelect value={docTag} onChange={setDocTag} lang={lang} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300"
                >
                  {tr('closeBtn', lang)}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#0B6E6E] text-white"
                >
                  {tr('confirmBtn', lang)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCorrectionModal && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-base font-extrabold text-[#1F2D3D]">
              {tr('erAddCorrectionBtn', lang)} ({selectedRecord.id})
            </h3>
            <form onSubmit={handleAddCorrection} className="space-y-3">
              <textarea
                rows={3}
                required
                value={correctionNote}
                onChange={(e) => setCorrectionNote(e.target.value)}
                placeholder="Document non-destructive clinical correction or addendum..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300"
                >
                  {tr('closeBtn', lang)}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#0B6E6E] text-white"
                >
                  {tr('confirmBtn', lang)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUnlinkModal && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-base font-extrabold text-[#B91C1C]">
              {tr('erUnlinkRecordBtn', lang)} ({selectedRecord.id})
            </h3>
            <form onSubmit={handleUnlinkRecord} className="space-y-3">
              <textarea
                rows={3}
                required
                value={unlinkReason}
                onChange={(e) => setUnlinkReason(e.target.value)}
                placeholder="Enter mandatory clinical/administrative reason for unlinking..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUnlinkModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300"
                >
                  {tr('closeBtn', lang)}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#B91C1C] text-white"
                >
                  {tr('erUnlinkRecordBtn', lang)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const PatientEmergencyLinksPanel: React.FC<{
  patientId: string;
  healthPassId: string;
  emergencyLinks: EmergencyRecord[];
  lang: SupportedLang;
  onUpdated: () => void;
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}> = ({ patientId, healthPassId, emergencyLinks, lang, onUpdated, onNotify }) => {
  const pLang = normalizePrimaryLang(lang);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!emergencyLinks || emergencyLinks.length === 0) {
    return null;
  }

  const handlePatientApprove = async (recId: string) => {
    setBusyId(recId);
    const res = await apiRequest(`/api/emergency-records/${recId}/link-complete`, {
      method: 'POST',
      suppressGlobal403: true,
      body: JSON.stringify({
        actorRole: 'patient',
        patientId,
        approvalNotes: `Approved by patient (${healthPassId}) in HealthPass dashboard.`,
      }),
    });
    setBusyId(null);
    if (res.ok) {
      onUpdated();
      onNotify?.(
        pLang === 'TE'
          ? `అత్యవసర రికార్డు ${recId} మీ HealthPass ప్రొఫైల్‌కు సురక్షితంగా లింక్ చేయబడింది.`
          : pLang === 'HI'
          ? `आपातकालीन रिकॉर्ड ${recId} आपके HealthPass प्रोफ़ाइल से सुरक्षित रूप से लिंक हो गया है।`
          : `Emergency Record ${recId} linked to your HealthPass profile with full provenance.`,
        'success'
      );
    } else {
      onNotify?.((res.data as any)?.error || 'Failed to approve link', 'error');
    }
  };

  const handlePatientReject = async (recId: string) => {
    setBusyId(recId);
    const res = await apiRequest(`/api/emergency-records/${recId}/link-reject`, {
      method: 'POST',
      suppressGlobal403: true,
      body: JSON.stringify({
        actorRole: 'patient',
        patientId,
        reason: 'Rejected by patient in HealthPass dashboard',
      }),
    });
    setBusyId(null);
    if (res.ok) {
      onUpdated();
      onNotify?.(
        pLang === 'TE'
          ? `అత్యవసర రికార్డు ${recId} లింకింగ్ తిరస్కరించబడింది. మీ రికార్డు మారలేదు.`
          : pLang === 'HI'
          ? `आपातकालीन रिकॉर्ड ${recId} लिंकिंग अस्वीकार कर दी गई। आपका रिकॉर्ड अपरिवर्तित रहा।`
          : `Rejected Emergency Record ${recId} link. Your permanent record was not changed.`,
        'info'
      );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#A5F3FC] p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-[#0B6E6E]" />
          <h3 className="text-sm font-extrabold text-[#1F2D3D]">
            {tr('navEmergencyLinks', lang)} ({emergencyLinks.length})
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-slate-500">
          {tr('linkSecurityNotice', lang).slice(0, 72)}...
        </span>
      </div>

      <div className="space-y-2.5">
        {emergencyLinks.map((rec) => {
          const isPending =
            rec.status === 'AWAITING_CONSENT' ||
            rec.status === 'READY_FOR_LINKING' ||
            rec.linkingWorkflow?.decisionStatus === 'PENDING_PATIENT_APPROVAL';
          return (
            <div
              key={rec.id}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-extrabold text-[#0B6E6E] bg-white px-2 py-0.5 rounded border border-slate-200">
                    {rec.id}
                  </span>
                  <span className="text-xs font-bold text-[#1F2D3D]">
                    {rec.facilityName} ({rec.createdByDoctorName})
                  </span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusBadgeStyle(
                    rec.status
                  )}`}
                >
                  {translateEmergencyStatus(rec.status, lang)}
                </span>
              </div>

              <div className="text-xs text-slate-700 space-y-1">
                <div>
                  <strong>{tr('erObservationsSection', lang)}:</strong>{' '}
                  {rec.emergencyObservations.text} (
                  {translateVerificationTag(rec.emergencyObservations.tag, lang)})
                </div>
                <div>
                  <strong>{tr('erTreatmentSection', lang)}:</strong> {rec.treatmentProvided.text} (
                  {translateVerificationTag(rec.treatmentProvided.tag, lang)})
                </div>
              </div>

              {isPending && rec.status !== 'LINKED' && rec.status !== 'LINKING_REJECTED' && (
                <div className="flex flex-wrap items-center gap-2 pt-1.5">
                  <button
                    type="button"
                    disabled={busyId === rec.id}
                    onClick={() => handlePatientApprove(rec.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#1F8A5B] hover:bg-emerald-700 text-white cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {tr('linkApprovePatientBtn', lang)}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === rec.id}
                    onClick={() => handlePatientReject(rec.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-red-50 text-[#B91C1C] border border-[#FECACA] cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    {tr('linkRejectPatientBtn', lang)}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
