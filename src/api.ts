import { getMedicalRecordCategory, isMedicalCategoryAuthorized, isMedicalRecordAuthorized, MEDICAL_RECORD_CATEGORIES } from './medicalRecordCategories.ts';
import { createMedicalReportSummary } from './services/medicalReportSummary.ts';
import { canExplainDoctorReport } from './services/reportExplanation.js';
import { findActivePrescriptionDuplicate, normalizePrescriptionText } from './services/prescriptionDuplicates.js';
import { findMedicalRecordDuplicate } from './services/medicalRecordDuplicates.js';
import { decidePharmacistPrescriptionRequest, getPharmacistPrescriptionAccess, getPrescriptionDisplayStatus, PHARMACIST_PRESCRIPTION_CATEGORY, revokePharmacistPrescriptionAccess } from './services/pharmacistPrescriptionAccess.js';
import { clearDemoState, loadDemoState, saveDemoState } from './services/demoLocalStore.js';
import { routeApiRequest } from './services/apiBackendRouting.js';
import { getPersistedAuthSession, getRegisteredUsers, saveRegisteredUser, findRegisteredUser, clearPersistedAuthSession } from './services/authStorage.ts';

const isPrescriptionDocument = (record: any) => record?.extractedFields?.reportType === 'Prescription' || /prescription/i.test(record?.category || '');
const isActiveDemoGrant = (grant: any) => Boolean(
  grant?.status === 'GRANTED' && grant.expiresAt && Number.isFinite(Date.parse(grant.expiresAt)) && Date.parse(grant.expiresAt) > Date.now()
);
const MOCK_CHRONIC_CONDITIONS = [
  { simpleLabel: 'Sugar (Diabetes)', name: 'Type 2 Diabetes Mellitus', since: '2023' },
  { simpleLabel: 'Mild BP (Blood Pressure)', name: 'Stage 1 Hypertension', since: '2025' },
];

function createHealthReportEntries(patientId: string, categories: string[], fromDate: string, toDate: string) {
  const withinRange = (dateValue: any) => {
    if (!fromDate && !toDate) return true;
    if (!dateValue) return false;
    const time = new Date(dateValue).getTime();
    if (!Number.isFinite(time)) return false;
    const day = new Date(time).toISOString().slice(0, 10);
    return (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
  };
  const entries: any[] = [];
  if (categories.includes('Allergies')) {
    for (const item of MOCK_STATE.allergies.filter((row) => row.patientId === patientId)) entries.push({
      id: item.id, title: `Allergy: ${item.allergen || 'Unknown'}`, category: 'Allergies', date: item.updatedAt || item.createdAt || '',
      provider: item.provider || '', source: item.source || '', verificationStatus: item.verificationStatus || 'Unverified',
    });
  }
  if (categories.includes('Medications & Prescriptions')) {
    for (const item of MOCK_STATE.medicines.filter((row) => row.patientId === patientId)) entries.push({
      id: item.id, title: `${item.name || 'Medication'}${item.strength ? ` ${item.strength}` : ''}`, category: 'Medications & Prescriptions',
      date: item.updatedAt || item.startDate || item.createdAt || '', provider: item.prescriberName || '',
      source: item.source || 'HealthPass medication record', verificationStatus: item.source === 'SELF_REPORTED' ? 'Patient reported; unverified' : item.verificationStatus || 'Unverified',
      detail: item.computedStatus ? `Record status: ${item.computedStatus}` : '',
    });
    for (const item of MOCK_STATE.prescriptions.filter((row) => row.patientId === patientId)) entries.push({
      id: item.id, title: `Prescription: ${item.diagnosis || 'Clinical prescription'}`, category: 'Medications & Prescriptions',
      date: item.date || item.createdAt || '', provider: item.doctorName || '', source: 'HealthPass prescription record',
      verificationStatus: item.confirmedByClinician ? 'Clinician confirmed' : 'Unverified',
      detail: (item.medicines || []).map((medicine: any) => `${medicine.name || 'Medicine'} ${medicine.strength || ''} ${medicine.dosage || ''}`.trim()).join('; '),
    });
  }
  for (const report of MOCK_STATE.reports.filter((row) => row.patientId === patientId)) {
    const category = getMedicalRecordCategory(report);
    if (!categories.includes(category)) continue;
    entries.push({
      id: report.id, title: report.title || 'Untitled report', category,
      date: report.prescriptionMetadataCorrections?.reportDate || report.extractedFields?.reportDate || report.reportDate || report.date || '',
      provider: report.prescriptionMetadataCorrections?.prescribingProvider || report.extractedFields?.doctorName || report.facilityName || '',
      source: report.source || report.uploadSource || '',
      verificationStatus: report.verificationStatus || (report.confirmedByUser ? 'Patient reviewed; not clinically verified' : 'Unverified'),
      detail: report.resultSummary || '',
      requiresMedicationConsent: isPrescriptionDocument(report),
    });
  }
  if (categories.includes('Consultation History')) {
    for (const visit of MOCK_STATE.visits.filter((row) => row.patientId === patientId)) entries.push({
      id: visit.id, title: visit.diagnosis || 'Consultation', category: 'Consultation History', date: visit.date || '',
      provider: visit.doctorName || '', source: visit.source || 'HealthPass consultation record',
      verificationStatus: visit.confirmedByClinician ? 'Clinician confirmed' : 'Unverified', detail: visit.clinicalNotes || '',
    });
  }
  if (categories.includes('General Medical History') && patientId === 'pat-1') {
    for (const item of MOCK_CHRONIC_CONDITIONS) entries.push({
      id: `condition-${item.simpleLabel}`, title: item.simpleLabel, category: 'General Medical History', date: '', provider: '',
      source: '', verificationStatus: 'Unverified', detail: `${item.name}; recorded since ${item.since}`,
    });
  }
  return entries.filter((entry) => withinRange(entry.date)).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

export interface ConsentErrorState {
  code:
    | 'NO_CONSENT'
    | 'ACCESS_REVOKED'
    | 'ACCESS_EXPIRED'
    | 'CATEGORY_NOT_SHARED'
    | 'WRITE_PERMISSION_DENIED'
    | 'PRESCRIPTION_PERMISSION_DENIED';
  message: string;
  screenTitle: string;
  screenSubtitle: string;
  primaryActionLabel: string;
  grant?: any;
}

export type Global403Handler = (
  consentError: ConsentErrorState,
  context: { doctorId?: string; patientId?: string; endpoint?: string }
) => void;

let global403Handler: Global403Handler | null = null;

export function registerGlobal403Handler(handler: Global403Handler | null) {
  global403Handler = handler;
}

export function map403ToConsentScreen(
  code: string,
  message?: string,
  grant?: any
): ConsentErrorState {
  switch (code) {
    case 'ACCESS_REVOKED':
      return {
        code: 'ACCESS_REVOKED',
        message: message || 'The patient has withdrawn permission.',
        screenTitle: 'ACCESS REVOKED BY PATIENT - You can no longer view this medical record.',
        screenSubtitle:
          'The patient has withdrawn permission. All clinical data has been cleared from the screen.',
        primaryActionLabel: 'Request access again',
        grant,
      };
    case 'ACCESS_EXPIRED':
      return {
        code: 'ACCESS_EXPIRED',
        message: message || 'Access time ended. Please request access again.',
        screenTitle: 'Access time ended',
        screenSubtitle:
          'Your time-bound consent grant has expired on the server. Request access again to continue.',
        primaryActionLabel: 'Request access again',
        grant,
      };
    case 'CATEGORY_NOT_SHARED':
      return {
        code: 'CATEGORY_NOT_SHARED',
        message: message || 'This specific category was not shared by the patient.',
        screenTitle: 'Category Not Shared',
        screenSubtitle:
          'The patient withheld access to this category. Server enforces zero data leakage.',
        primaryActionLabel: 'Request category access',
        grant,
      };
    case 'NO_CONSENT':
    default:
      return {
        code: 'NO_CONSENT',
        message:
          message || 'No active consent grant found for this provider and patient.',
        screenTitle: 'Clinical Record Locked',
        screenSubtitle:
          'Before consent, only patient name and verified ID are visible. Request access to unlock medical records.',
        primaryActionLabel: 'Request access',
        grant,
      };
  }
}

export interface ApiRequestOptions extends RequestInit {
  doctorId?: string;
  pharmacistId?: string;
  labId?: string;
  patientId?: string;
  suppressGlobal403?: boolean;
}

export interface ApiResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
  consentError?: ConsentErrorState;
}

// ----------------------------------------------------------------------------
// IN-MEMORY MOCK STORE FOR STANDALONE DEV & BROWSER INTERACTIVITY
// ----------------------------------------------------------------------------
const MOCK_STATE = {
  patientHealthProfiles: {} as Record<string, any>,
  qrTokens: {} as Record<string, string>,
  grants: [
    {
      id: 'grant-village-demo',
      patientId: 'pat-1',
      doctorId: 'doc-village',
      doctorName: 'Dr. Anil Kumar',
      facilityName: 'Village Health Centre, Kothapalli',
      facilityLevel: 'VILLAGE',
      facilityType: 'Village Health Centre',
      purpose: 'Outpatient point-of-care consultation & medication safety review',
      grantedCategories: ['Medical history', 'Prescriptions', 'Medicines'],
      durationHours: 24,
      expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
      status: 'GRANTED',
      createdAt: new Date().toISOString(),
    },
  ] as any[],
  medicines: [
    {
      id: 'med-1',
      patientId: 'pat-1',
      name: 'Paracetamol',
      genericName: 'Paracetamol',
      strength: '650 mg',
      dosage: '1 tablet',
      route: 'Oral',
      startDate: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      frequency: { morning: 1, noon: 0, night: 1 },
      durationDays: 5,
      daysRemaining: 3,
      computedStatus: 'ACTIVE',
      foodInstruction: 'After food',
      notes: 'Take after meals for fever or headache',
      prescriberName: 'Dr. Anil Kumar',
      facilityName: 'Village Health Centre, Kothapalli',
      facilityLevel: 'VILLAGE',
      facilityType: 'Village Health Centre',
    },
    {
      id: 'med-2',
      patientId: 'pat-1',
      name: 'Metformin',
      genericName: 'Metformin Hydrochloride',
      strength: '500 mg',
      dosage: '1 tablet',
      route: 'Oral',
      startDate: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
      frequency: { morning: 1, noon: 0, night: 1 },
      durationDays: 90,
      daysRemaining: 60,
      computedStatus: 'ACTIVE',
      foodInstruction: 'With food',
      notes: 'Blood sugar maintenance',
      prescriberName: 'Dr. Rahul Sharma',
      facilityName: 'Mandal Health Centre, Nandigama',
      facilityLevel: 'MANDAL',
      facilityType: 'Mandal Health Centre',
    },
    {
      id: 'med-3',
      patientId: 'pat-1',
      name: 'Pantoprazole',
      genericName: 'Pantoprazole Sodium',
      strength: '40 mg',
      dosage: '1 tablet',
      route: 'Oral',
      startDate: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10),
      endDate: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
      frequency: { morning: 1, noon: 0, night: 0 },
      durationDays: 15,
      daysRemaining: 0,
      computedStatus: 'COMPLETED',
      foodInstruction: 'Before food',
      notes: 'Completed 15-day course',
      prescriberName: 'Dr. Anil Kumar',
      facilityName: 'Village Health Centre, Kothapalli',
      facilityLevel: 'VILLAGE',
      facilityType: 'Village Health Centre',
    },
  ] as any[],
  allergies: [
    {
      id: 'alg-1',
      patientId: 'pat-1',
      allergen: 'Sulfa Drugs (Sulfonamides)',
      severity: 'SEVERE / BLOCKING',
      reaction: 'Anaphylaxis & generalized urticaria',
      drugClassMatches: [
        'Co-trimoxazole',
        'Bactrim',
        'Sulfamethoxazole',
        'Sulfadiazine',
        'Septra',
      ],
    },
  ] as any[],
  visits: [
    {
      id: 'vis-1',
      patientId: 'pat-1',
      date: '10 Oct 2026',
      diagnosis: 'Acute Viral Febrile Illness',
      chiefComplaint: 'Fever with body ache for 2 days',
      clinicalNotes:
        'Vitals stable. BP 122/80. Prescribed Paracetamol 650mg and hydration ORS packets.',
      doctorName: 'Dr. Anil Kumar',
      facilityName: 'Village Health Centre, Kothapalli',
      facilityLevel: 'VILLAGE',
      facilityType: 'Village Health Centre',
      prescribedMedicines: ['Paracetamol 650 mg', 'Oral Rehydration Salts (ORS)'],
    },
    {
      id: 'vis-2',
      patientId: 'pat-1',
      date: '28 Sep 2026',
      diagnosis: 'Type 2 Diabetes Routine Review',
      chiefComplaint: 'Quarterly fasting blood sugar check',
      clinicalNotes:
        'HbA1c 6.8%. Diet adherence advised. Continue Metformin 500mg twice daily with meals.',
      doctorName: 'Dr. Rahul Sharma',
      facilityName: 'Mandal Health Centre, Nandigama',
      facilityLevel: 'MANDAL',
      facilityType: 'Mandal Health Centre',
      prescribedMedicines: ['Metformin 500 mg'],
    },
    {
      id: 'vis-3',
      patientId: 'pat-1',
      date: '15 Aug 2026',
      diagnosis: 'Seasonal Bronchitis',
      chiefComplaint: 'Dry persistent cough',
      clinicalNotes:
        'Chest clear. Mild rhonchi. Advised steam inhalation and symptomatic medication.',
      doctorName: 'Dr. Meera Reddy',
      facilityName: 'District Hospital, Vijayawada',
      facilityLevel: 'DISTRICT',
      facilityType: 'District Hospital',
      prescribedMedicines: ['Cetirizine 10 mg'],
    },
  ] as any[],
  reports: [
    {
      id: 'rep-1',
      patientId: 'pat-1',
      title: 'Complete Blood Count (CBC) with Platelets',
      category: 'Lab reports',
      resultSummary: 'Haemoglobin: 13.8 g/dL · Total WBC: 6,800 /cumm · Platelets: 2.4 lakhs/cumm',
      plainExplanation: 'All cellular blood parameters are within normal physiological ranges.',
      statusColor: 'NORMAL',
      facilityName: 'District Hospital Diagnostic Lab, Vijayawada',
      facilityLevel: 'DISTRICT',
      facilityType: 'District Hospital',
      source: 'OCR_UPLOAD',
      extractedFields: {
        labValues: [
          { testName: 'Haemoglobin', value: '13.8', unit: 'g/dL', referenceRange: '12.0 - 15.5', status: 'NORMAL' },
          { testName: 'Total WBC Count', value: '6,800', unit: '/cumm', referenceRange: '4,000 - 11,000', status: 'NORMAL' },
          { testName: 'Platelet Count', value: '2.4', unit: 'lakhs/cumm', referenceRange: '1.5 - 4.5', status: 'NORMAL' },
        ],
      },
    },
    {
      id: 'rep-2',
      patientId: 'pat-1',
      title: 'Fasting Blood Sugar & HbA1c Glycated Hemoglobin',
      category: 'Lab reports',
      resultSummary: 'Fasting Glucose: 98 mg/dL (Normal) · HbA1c: 6.8% (Target controlled)',
      plainExplanation: 'Fasting blood glucose is well controlled. Diabetic monitoring is on track.',
      statusColor: 'NORMAL',
      facilityName: 'Mandal Health Centre Lab, Nandigama',
      facilityLevel: 'MANDAL',
      facilityType: 'Mandal Health Centre',
    },
    {
      id: 'rep-demo-doctor-cbc',
      patientId: 'pat-1',
      title: 'Sample CBC report · Doctor uploaded',
      category: 'Lab reports',
      medicalCategory: 'Laboratory Reports',
      reportType: 'Blood Test',
      resultSummary: 'Fictional sample report. Haemoglobin 13.8 g/dL; WBC 6,800 /cumm; platelets 2.4 lakhs/cumm.',
      rawOcrText: 'Fictional sample CBC report. Haemoglobin: 13.8 g/dL (reference range 12.0 - 15.5). Total WBC Count: 6,800 /cumm (reference range 4,000 - 11,000). Platelet Count: 2.4 lakhs/cumm (reference range 1.5 - 4.5).',
      fileDataUrl: '/demo-reports/sample-blood-test.svg',
      extractedFields: { reportType: 'Blood Test', reportDate: '2026-10-14', laboratoryName: 'HealthPass Fictional Demo Lab', labValues: [
        { testName: 'Haemoglobin', value: '13.8', unit: 'g/dL', referenceRange: '12.0 - 15.5' },
        { testName: 'Total WBC Count', value: '6,800', unit: '/cumm', referenceRange: '4,000 - 11,000' },
        { testName: 'Platelet Count', value: '2.4', unit: 'lakhs/cumm', referenceRange: '1.5 - 4.5' },
      ] },
      source: 'DOCTOR_UPLOAD', uploaderRole: 'doctor', uploadedBy: 'doc-village', uploadedAt: '2026-10-14T10:00:00.000Z',
      processingStatus: 'OCR_COMPLETE', verificationStatus: 'CLINICIAN_VERIFIED',
      facilityName: 'HealthPass Fictional Demo Lab', facilityLevel: 'VILLAGE', facilityType: 'Village Health Centre',
    },
  ] as any[],
  prescriptions: [
    {
      id: 'RX-2026-9041',
      consultationId: 'CONS-2026-1042',
      patientId: 'pat-1',
      healthPassId: 'HP-DEMO-0417',
      doctorId: 'doc-village',
      doctorName: 'Dr. Anil Kumar',
      doctorLicense: 'APMC-2018-4412',
      facilityName: 'Village Health Centre, Kothapalli',
      facilityLevel: 'VILLAGE',
      facilityType: 'Village Health Centre',
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      date: '10 Oct 2026',
      chiefComplaint: 'Fever with body ache for 2 days',
      diagnosis: 'Acute Viral Febrile Illness',
      confirmedByClinician: true,
      medicines: [
        {
          id: 'rx-m1',
          name: 'Paracetamol',
          strength: '650 mg',
          dosage: '1 tablet',
          route: 'Oral',
          frequency: { morning: 1, noon: 0, night: 1 },
          durationDays: 5,
          foodInstruction: 'After food',
        },
      ],
    },
  ] as any[],
  emergencyRecords: [
    {
      id: 'ER-2026-0812',
      status: 'READY_FOR_LINKING',
      createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      createdByDoctorId: 'doc-district',
      createdByDoctorName: 'Dr. Meera Reddy',
      createdByLicense: 'APMC-2014-7721',
      facilityName: 'District Hospital, Vijayawada',
      facilityLevel: 'DISTRICT',
      facilityType: 'District Hospital',
      dataSource: 'CLINICIAN_OBSERVED',
      patientDetails: {
        apparentName: { text: 'Female Emergency Admission (Ananya Rao)', tag: 'VERIFIED' },
        estimatedAge: { text: '42 yrs', tag: 'VERIFIED' },
        gender: { text: 'Female', tag: 'VERIFIED' },
        bloodGroup: { text: 'O+', tag: 'VERIFIED' },
        distinguishingNotes: 'Ambulance transfer with acute dehydration; vitals stabilized.',
      },
      emergencyObservations: {
        text: 'BP 118/76 mmHg. Pulse 78 bpm. Mild dehydration; alert and cooperative.',
        tag: 'VERIFIED',
      },
      allergies: {
        text: 'Reported severe allergy to Sulfa drugs (Sulfonamides).',
        tag: 'VERIFIED',
      },
      medicines: {
        text: 'Taking Metformin 500mg and Paracetamol 650mg.',
        tag: 'PATIENT_REPORTED',
      },
      medicalHistory: {
        text: 'Known Type 2 Diabetes for 3 years.',
        tag: 'PATIENT_REPORTED',
      },
      treatmentProvided: {
        text: 'Administered 500ml IV Normal Saline and oral electrolyte replenishment.',
        tag: 'VERIFIED',
      },
      documents: [],
      corrections: [],
      auditTrail: [
        {
          id: 'aud-er-1',
          timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
          action: 'RECORD_CREATED',
          actorId: 'doc-district',
          actorName: 'Dr. Meera Reddy',
          actorRole: 'doctor',
          facilityName: 'District Hospital, Vijayawada',
          details: 'Emergency record initialized upon paramedic transfer.',
        },
      ],
      linkingWorkflow: {
        targetPatientId: 'pat-1',
        targetHealthPassId: 'HP-DEMO-0417',
        targetPatientName: 'Demo Patient (Ananya Rao)',
        initiatedByDoctorId: 'doc-district',
        initiatedByDoctorName: 'Dr. Meera Reddy',
        initiatedFacilityName: 'District Hospital, Vijayawada',
        initiatedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
        identityVerified: true,
        identityVerificationMethod: 'GOVERNMENT_ID_AND_BIOMETRIC',
        identityVerificationNotes: 'Aadhaar / ABHA match verified at emergency triage desk.',
        authorizationBasis: 'PATIENT_APP_CONSENT',
        consentOrAuthReference: 'AUTH-ER-2026-9921',
        detectedConflicts: [],
        conflictResolutionMode: 'KEEP_SEPARATE_PROVENANCE',
        decisionStatus: 'PENDING_PATIENT_APPROVAL',
      },
    },
  ] as any[],
  auditLogs: [
    {
      id: 'aud-1',
      timestamp: new Date().toISOString(),
      action: 'CONSENT_GRANTED',
      reasonCode: 'OUTPATIENT_VISIT',
      actorName: 'Demo Patient (Ananya Rao)',
      facilityName: 'Village Health Centre, Kothapalli',
      facilityLevel: 'VILLAGE',
      plainSummary: 'Patient granted 24-hour consent for Medical History, Prescriptions and Medicines to Dr. Anil Kumar.',
      plainSummaryTe: 'రోగి డాక్టర్ అనిల్ కుమార్‌కు 24 గంటల సమ్మతిని మంజూరు చేశారు.',
      plainSummaryHi: 'मरीज ने डॉ. अनिल कुमार को 24 घंटे की सहमति प्रदान की।',
      locallyStored: true,
    },
  ] as any[],
  emergencyLinks: [] as any[],
  providers: [
    { id: 'doc-village', name: 'Dr. Anil Kumar', email: 'village.doctor@demo.com', facilityName: 'Village Health Centre, Kothapalli', facilityLevel: 'VILLAGE', verified: true },
    { id: 'doc-mandal', name: 'Dr. Rahul Sharma', email: 'doctor@demo.com', facilityName: 'Mandal Health Centre, Nandigama', facilityLevel: 'MANDAL', verified: true },
    { id: 'doc-district', name: 'Dr. Meera Reddy', email: 'district.doctor@demo.com', facilityName: 'District Hospital, Vijayawada', facilityLevel: 'DISTRICT', verified: true },
  ] as any[],
};

// Fictional state only. The app intentionally has no remote API/database mode.
const DEFAULT_DEMO_STATE = JSON.parse(JSON.stringify(MOCK_STATE));
let demoStorageWritable = true;
let demoStorageStatus = 'empty';
function getDemoStorage() {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; } catch { return undefined; }
}
function loadDemoStore() {
  const loaded = loadDemoState(DEFAULT_DEMO_STATE, getDemoStorage());
  demoStorageWritable = loaded.writable;
  demoStorageStatus = loaded.status;
  if (loaded.status === 'loaded') Object.assign(MOCK_STATE, loaded.state);
  if (loaded.status === 'empty') {
    try {
      const previousGrants = getDemoStorage()?.getItem('healthpass-demo-consent-grants-v1');
      if (previousGrants) {
        const parsedGrants = JSON.parse(previousGrants);
        if (Array.isArray(parsedGrants)) MOCK_STATE.grants = parsedGrants;
      }
    } catch {
      // The previous grants-only demo data is optional; defaults remain usable.
    }
  }
  let expiredGrant = false;
  for (const grant of MOCK_STATE.grants) {
    const expiresAt = Date.parse(grant.expiresAt || '');
    if (grant.status === 'GRANTED' && Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      grant.status = 'EXPIRED';
      recordDemoAudit('ACCESS_EXPIRED', grant.patientId, `Temporary access for ${grant.doctorName || 'a demo provider'} expired.`);
      expiredGrant = true;
    }
  }
  if (expiredGrant && demoStorageWritable) {
    if (!persistDemoStore()) demoStorageStatus = 'unavailable';
    else demoStorageStatus = 'loaded';
  }
  return loaded;
}
function persistDemoStore() {
  if (!demoStorageWritable) return false;
  const saved = saveDemoState(MOCK_STATE, getDemoStorage());
  if (!saved) { demoStorageWritable = false; demoStorageStatus = 'unavailable'; }
  return saved;
}
const DEMO_PATIENT_NAMES: Record<string, string> = {
  'pat-1': 'Ananya Rao', 'pat-2': 'Aarav Kumar', 'pat-3': 'Lakshmi Narayana',
};
function recordDemoAudit(action: string, patientId: string, plainSummary: string) {
  MOCK_STATE.auditLogs.unshift({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    patientId, timestamp: new Date().toISOString(), action, actorName: 'HealthPass demo',
    plainSummary, locallyStored: true,
  });
}
loadDemoStore();

// ----------------------------------------------------------------------------
// CLIENT-SIDE MOCK HANDLER INTERCEPTOR
// ----------------------------------------------------------------------------
function handleMockApiRequestInternal(endpoint: string, options: ApiRequestOptions): ApiResult {
  const url = new URL(endpoint, 'http://localhost:3000');
  const pathname = url.pathname;
  const method = (options.method || 'GET').toUpperCase();
  const searchParams = url.searchParams;

  if (pathname === '/api/demo/status' && method === 'GET') {
    return { ok: true, status: 200, data: { localOnly: true, storageStatus: demoStorageStatus, persistent: demoStorageWritable } };
  }
  if (pathname === '/api/demo/reset' && method === 'POST') {
    Object.assign(MOCK_STATE, JSON.parse(JSON.stringify(DEFAULT_DEMO_STATE)));
    demoStorageWritable = true;
    const saved = clearDemoState(DEFAULT_DEMO_STATE, getDemoStorage());
    try { getDemoStorage()?.removeItem?.('healthpass-demo-consent-grants-v1'); } catch { /* Older demo cache is optional. */ }
    demoStorageWritable = saved;
    demoStorageStatus = saved ? 'loaded' : 'unavailable';
    return saved
      ? { ok: true, status: 200, data: { success: true, localOnly: true } }
      : { ok: false, status: 507, data: { error: 'Demo data was reset for this tab but could not be saved in browser storage.' } };
  }

  const patientExportMatch = pathname.match(/^\/api\/patient\/([^/]+)\/personal-health-report$/);
  const providerExportMatch = pathname.match(/^\/api\/provider\/patient\/([^/]+)\/personal-health-report$/);
  if ((patientExportMatch || providerExportMatch) && method === 'POST') {
    const patientId = patientExportMatch?.[1] || providerExportMatch?.[1] || '';
    if (patientExportMatch && options.patientId !== patientId) return { ok: false, status: 403, data: { error: 'The signed-in patient does not own this record.' } };
    let body: any = {};
    try { body = JSON.parse(options.body as string); } catch {}
    const categories = Array.isArray(body.categories) ? body.categories : [];
    if (!categories.length || categories.some((category: string) => !MEDICAL_RECORD_CATEGORIES.includes(category as any))) {
      return { ok: false, status: 400, data: { error: 'Select at least one valid medical category.' } };
    }
    const fromDate = String(body.fromDate || '');
    const toDate = String(body.toDate || '');
    const validDate = (value: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T00:00:00Z`).getTime());
    if (!validDate(fromDate) || !validDate(toDate) || fromDate && toDate && fromDate > toDate) {
      return { ok: false, status: 400, data: { error: 'Choose a valid date range.' } };
    }
    let providerGrant: any;
    if (providerExportMatch) {
      const doctorId = options.doctorId || '';
      providerGrant = MOCK_STATE.grants.find((item) => item.patientId === patientId && item.doctorId === doctorId && item.status === 'GRANTED');
      if (!providerGrant) {
        const error = map403ToConsentScreen('NO_CONSENT', 'An active patient consent grant is required to export records.');
        return { ok: false, status: 403, data: { code: error.code, message: error.message }, consentError: error };
      }
      const denied = categories.filter((category: any) => !isMedicalCategoryAuthorized(providerGrant, category));
      if (denied.length) {
        const error = map403ToConsentScreen('CATEGORY_NOT_SHARED', 'The patient has not shared every selected category.');
        return { ok: false, status: 403, data: { code: error.code, message: error.message, deniedCategories: denied }, consentError: error };
      }
    }
    const entries = createHealthReportEntries(patientId, categories, fromDate, toDate).filter((entry) =>
      !providerGrant || isMedicalCategoryAuthorized(providerGrant, entry.category) &&
        (!entry.requiresMedicationConsent || isMedicalCategoryAuthorized(providerGrant, 'Medications & Prescriptions'))
    );
    return { ok: true, status: 200, data: { entries: entries.map(({ requiresMedicationConsent, ...entry }) => entry), categories, fromDate, toDate } };
  }

  // Role portals and record actions share this in-memory store so the demo
  // remains interactive even when no API server is running.
  if (pathname === '/api/auth/register' && method === 'POST') {
    let body: any = {};
    try { body = JSON.parse(options.body as string); } catch {}
    const name = String(body.name || '').trim();
    const email = String(body.email || '').toLowerCase().trim();
    const password = String(body.password || '');
    const role = (['patient', 'doctor', 'pharmacy', 'lab', 'admin'].includes(body.role) ? body.role : 'patient') as any;

    if (!name) return { ok: false, status: 400, data: { error: 'Full name is required.' } };
    if (!email) return { ok: false, status: 400, data: { error: 'Email address is required.' } };
    if (!password || password.length < 6) return { ok: false, status: 400, data: { error: 'Password must be at least 6 characters long.' } };

    // Check duplicate
    const existingUser = findRegisteredUser(email);
    if (existingUser) {
      return { ok: false, status: 409, data: { code: 'DUPLICATE_EMAIL', error: 'An account with this email address already exists. Please sign in instead.' } };
    }

    const simId = `${role}-${Date.now().toString(36)}`;
    const randomPass = `HP-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newUser = {
      id: simId,
      name,
      email,
      role,
      facilityName: body.facilityName?.trim() || (role === 'doctor' ? 'HealthPass Clinical Centre' : role === 'pharmacy' ? 'Jan Aushadhi Medical Store' : role === 'lab' ? 'Diagnostic Pathology Lab' : undefined),
      facilityLevel: body.facilityLevel || (role === 'pharmacy' ? 'PHARMACY' : role === 'lab' ? 'LAB' : role === 'doctor' ? 'VILLAGE' : undefined),
      facilityType: body.facilityType?.trim() || (role === 'pharmacy' ? 'Community Pharmacy' : role === 'lab' ? 'Diagnostic Lab' : undefined),
      licenseNumber: body.licenseNumber?.trim() || (role === 'doctor' ? 'MCI-LIC-VERIFIED' : role === 'pharmacy' ? 'PHA-LIC-VERIFIED' : role === 'lab' ? 'NABL-LAB-VERIFIED' : undefined),
      healthPassId: role === 'patient' ? randomPass : undefined,
      bloodGroup: body.bloodGroup || 'O+',
      age: body.age ? Number(body.age) : 32,
      gender: body.gender || 'Female',
      isVerified: true,
      backend: 'demo' as const,
      createdAt: new Date().toISOString(),
    };

    saveRegisteredUser(newUser as any, password);

    if (role === 'patient') {
      DEMO_PATIENT_NAMES[newUser.id] = newUser.name;
      MOCK_STATE.patientHealthProfiles[newUser.id] = {
        patientId: newUser.id,
        knownAllergies: '',
        currentMedications: '',
        healthConditions: '',
        pastSurgeries: '',
        emergencyContactName: 'Emergency Contact',
        emergencyContactPhone: '+91 98480 99112',
        bloodGroup: newUser.bloodGroup,
        source: 'Patient-provided',
        verificationStatus: 'Unverified',
        updatedAt: new Date().toISOString(),
      };
      MOCK_STATE.medicines.unshift({
        id: `med-${Date.now()}`,
        patientId: newUser.id,
        name: 'Multivitamin & Zinc',
        genericName: 'Vitamin B-Complex with Zinc',
        strength: '1 Tablet Daily',
        dosage: '1 tablet',
        route: 'Oral',
        startDate: new Date().toISOString().slice(0, 10),
        computedStatus: 'ACTIVE',
        prescriberName: 'Self reported',
        facilityName: 'HealthPass Wellness',
        source: 'SELF_REPORTED',
      });
      MOCK_STATE.allergies.unshift({
        id: `alg-${Date.now()}`,
        patientId: newUser.id,
        allergen: 'No Known Drug Allergies (NKDA)',
        severity: 'MILD',
        reaction: 'None reported',
        drugClassMatches: [],
      });
    } else if (role === 'doctor') {
      MOCK_STATE.providers.unshift({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        facilityName: newUser.facilityName || 'HealthPass Clinical Centre',
        facilityLevel: newUser.facilityLevel || 'VILLAGE',
        verified: true,
      });
    }

    recordDemoAudit('USER_REGISTERED', newUser.id, `${newUser.name} registered as a ${newUser.role}.`);
    persistDemoStore();

    return {
      ok: true,
      status: 201,
      data: {
        success: true,
        user: newUser,
        token: `token-${newUser.id}`,
      },
    };
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    const session = getPersistedAuthSession();
    if (session?.user) {
      return { ok: true, status: 200, data: { user: session.user } };
    }
    return { ok: false, status: 401, data: { error: 'Not authenticated.' } };
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    clearPersistedAuthSession();
    return { ok: true, status: 200, data: { success: true, message: 'Signed out successfully.' } };
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    let body: any = {};
    try { body = JSON.parse(options.body as string); } catch {}
    const email = String(body.email || '').toLowerCase().trim();
    const password = String(body.password || '');

    // 1. First check user-registered accounts
    const registeredMatch = findRegisteredUser(email, password);
    if (registeredMatch) {
      recordDemoAudit('USER_LOGIN', registeredMatch.id, `${registeredMatch.name} signed in successfully.`);
      return {
        ok: true,
        status: 200,
        data: {
          success: true,
          user: { ...registeredMatch, backend: 'demo' },
          token: `token-${registeredMatch.id}`,
        },
      };
    }

    // 2. Check built-in demo and sample accounts
    const samplePasswords = ['Demo@123', 'Patient@2026', 'Doctor@2026', 'Pharma@2026', 'LabPath@2026'];
    const validPassword = samplePasswords.includes(password);

    const patients = [
      { email: 'patient@demo.com', role: 'patient', id: 'pat-1', name: 'Demo Patient (Ananya Rao)', healthPassId: 'HP-DEMO-0417' },
      { email: 'ananya.rao@healthpass.org', role: 'patient', id: 'pat-1', name: 'Ananya Rao', healthPassId: 'HP-DEMO-0417' },
      { email: 'child@demo.com', role: 'patient', id: 'pat-2', name: 'Aarav Kumar (Child Profile)', healthPassId: 'HP-CHILD-0892' },
      { email: 'elder@demo.com', role: 'patient', id: 'pat-3', name: 'Lakshmi Narayana (Elderly Care)', healthPassId: 'HP-ELDER-0931' },
    ];
    const accounts = [
      ...patients,
      { email: 'village.doctor@demo.com', role: 'doctor', id: 'doc-village', name: 'Dr. Anil Kumar', facilityName: 'Village Health Centre, Kothapalli' },
      { email: 'dr.priya@apollohealth.org', role: 'doctor', id: 'doc-village', name: 'Dr. Priya Sharma', facilityName: 'Apollo Clinical Centre' },
      { email: 'doctor@demo.com', role: 'doctor', id: 'doc-mandal', name: 'Dr. Rahul Sharma', facilityName: 'Mandal Health Centre, Nandigama' },
      { email: 'district.doctor@demo.com', role: 'doctor', id: 'doc-district', name: 'Dr. Meera Reddy', facilityName: 'District Hospital, Vijayawada' },
      { email: 'pharmacy@demo.com', role: 'pharmacy', id: 'pharmacy-demo', name: 'Jan Aushadhi Pharmacist', facilityName: 'Jan Aushadhi Medical Store' },
      { email: 'rajesh.pharmacy@janaushadhi.gov', role: 'pharmacy', id: 'pharmacy-demo', name: 'Rajesh Pharmacist', facilityName: 'Jan Aushadhi Store' },
      { email: 'lab@demo.com', role: 'lab', id: 'lab-demo', name: 'Diagnostic Lab Staff', facilityName: 'Apex Diagnostic Lab' },
      { email: 'sunita.path@apexdiagnostics.org', role: 'lab', id: 'lab-demo', name: 'Dr. Sunita Pathologist', facilityName: 'Apex Diagnostic Lab' },
      { email: 'admin@demo.com', role: 'admin', id: 'admin-demo', name: 'Registry Administrator', facilityName: 'HealthPass National Registry' },
    ];
    const user = accounts.find((item) => item.email.toLowerCase() === email);
    if (!user) {
      return { ok: false, status: 404, data: { error: 'Account not found. Please check your email or click "Create Account".' } };
    }
    if (!validPassword && password.length < 4) {
      return { ok: false, status: 401, data: { error: 'Invalid password. Please enter your password or demo password.' } };
    }
    recordDemoAudit('USER_LOGIN', user.id, `${user.name} signed in successfully.`);
    return { ok: true, status: 200, data: { user: { ...user, email, healthPassId: (user as any).healthPassId || 'HP-DEMO-0417', backend: 'demo' }, token: `token-${user.id}` } };
  }

  if (pathname === '/api/pharmacy/request-access' && method === 'POST') {
    let body: any = {};
    try { body = JSON.parse(options.body as string); } catch {}
    if (options.pharmacistId !== 'pharmacy-demo') return { ok: false, status: 403, data: { error: 'A pharmacist account is required.' } };
    const patientByHealthPassId: Record<string, string> = {
      'HP-DEMO-0417': 'pat-1', 'HP-CHILD-0892': 'pat-2', 'HP-ELDER-0931': 'pat-3',
    };
    const normalizedHealthPassId = normalizePrescriptionText(body.healthPassId);
    const patientId = patientByHealthPassId[normalizedHealthPassId.toUpperCase()];
    if (!patientId) return { ok: false, status: 404, data: { error: 'No patient matches that HealthPass ID.' } };
    const existing = MOCK_STATE.grants
      .filter((grant: any) => grant.patientId === patientId && grant.providerId === options.pharmacistId && grant.providerType === 'pharmacist')
      .sort((a: any, b: any) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))[0];
    const existingAccess = getPharmacistPrescriptionAccess(existing, { patientId, pharmacistId: options.pharmacistId } as any);
    if (existingAccess.status === 'PENDING' || existingAccess.canRead) return { ok: true, status: 200, data: { grant: existing } };
    const grant = {
      id: `grant-pharmacy-${Date.now()}`, patientId, providerId: options.pharmacistId,
      providerType: 'pharmacist', doctorId: options.pharmacistId,
      doctorName: 'Jan Aushadhi Pharmacist (Demo)', facilityName: 'Demo pharmacy', facilityLevel: 'PHARMACY', facilityType: 'Pharmacy',
      purpose: 'Prescription review for dispensing', requestedCategories: [PHARMACIST_PRESCRIPTION_CATEGORY],
      durationHours: Math.min(168, Math.max(1, Number(body.durationHours) || 24)), status: 'PENDING', createdAt: new Date().toISOString(),
    };
    MOCK_STATE.grants.push(grant);
    recordDemoAudit('ACCESS_REQUESTED', patientId, `Jan Aushadhi Pharmacist requested prescription-only access for ${DEMO_PATIENT_NAMES[patientId]}.`);
    return { ok: true, status: 201, data: { grant } };
  }

  if (pathname.startsWith('/api/pharmacy/patient/')) {
    const query = decodeURIComponent(pathname.split('/').pop() || '');
    if (options.pharmacistId !== 'pharmacy-demo') return { ok: false, status: 403, data: { error: 'A pharmacist account is required.' } };
    const patientByHealthPassId: Record<string, string> = {
      'HP-DEMO-0417': 'pat-1', 'HP-CHILD-0892': 'pat-2', 'HP-ELDER-0931': 'pat-3',
    };
    const patientId = query.startsWith('HP-') ? patientByHealthPassId[normalizePrescriptionText(query).toUpperCase()] : query;
    const patient = [
      { id: 'pat-1', healthPassId: 'HP-DEMO-0417', name: 'Demo Patient (Ananya Rao)' },
      { id: 'pat-2', healthPassId: 'HP-CHILD-0892', name: 'Aarav Kumar (Child Profile)' },
      { id: 'pat-3', healthPassId: 'HP-ELDER-0931', name: 'Lakshmi Narayana (Elderly Care)' },
    ].find((item) => item.id === patientId);
    if (!patient) return { ok: false, status: 404, data: { error: 'No patient matches that HealthPass ID.' } };
    const grant = MOCK_STATE.grants
      .filter((item: any) => item.patientId === patient.id && item.providerId === options.pharmacistId && item.providerType === 'pharmacist')
      .sort((a: any, b: any) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))[0];
    const access = getPharmacistPrescriptionAccess(grant, { patientId: patient.id, pharmacistId: options.pharmacistId } as any);
    if (access.canRead) recordDemoAudit('PRESCRIPTIONS_VIEWED', patient.id, 'The demo pharmacist opened prescriptions while prescription-only consent was active.');
    const prescriptions = access.canRead ? MOCK_STATE.prescriptions
      .filter((rx: any) => rx.patientId === patient.id)
      .flatMap((rx: any) => (rx.medicines || []).map((medicine: any) => {
        const prescriptionDate = rx.createdAt || rx.date || '';
        const prescriptionTimestamp = Date.parse(prescriptionDate || '');
        const durationDays = Number(medicine.durationDays);
        const endDate = medicine.endDate || (Number.isFinite(prescriptionTimestamp) && Number.isFinite(durationDays) && durationDays > 0
          ? new Date(prescriptionTimestamp + durationDays * 86400000).toISOString()
          : '');
        const computedStatus = getPrescriptionDisplayStatus({ ...medicine, validUntil: endDate });
        return {
          id: `${rx.id}-${medicine.id}`, prescriptionId: rx.id, medicationName: medicine.name || '', strength: medicine.strength || '',
          dosage: medicine.dosage || '', route: medicine.route || '', frequency: medicine.frequency || '', duration: medicine.durationDays ? `${medicine.durationDays} days` : '',
          instructions: medicine.instructions || medicine.foodInstruction || '', prescribingClinician: rx.doctorName || '', prescriptionDate,
          validUntil: endDate, status: computedStatus, confirmedByClinician: Boolean(rx.confirmedByClinician),
        };
      })) : [];
    return { ok: true, status: 200, data: { patient, accessStatus: access.status, grant: access.grant || null, prescriptions } };
  }

  if (pathname === '/api/admin/overview') {
    return { ok: true, status: 200, data: {
      providers: MOCK_STATE.providers || [],
      auditLogs: MOCK_STATE.auditLogs,
      patientCount: new Set(MOCK_STATE.medicines.map((m) => m.patientId)).size,
      providerCount: MOCK_STATE.providers?.length || 0,
    } };
  }

  if (pathname === '/api/admin/providers' && method === 'POST') {
    let body: any = {};
    try { body = JSON.parse(options.body as string); } catch {}
    const name = String(body.name || '').trim();
    const facilityName = String(body.facilityName || '').trim();
    if (!name || !facilityName || name.length > 120 || facilityName.length > 160) return { ok: false, status: 400, data: { error: 'Enter a clinician name and facility (maximum 120 and 160 characters).' } };
    const provider = {
      id: `doc-${Date.now()}`, name, email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}@clinic.demo`,
      facilityName, facilityLevel: body.facilityLevel || 'VILLAGE', facilityType: body.facilityType || 'Village Health Centre', verified: false,
    };
    MOCK_STATE.providers.push(provider);
    return { ok: true, status: 201, data: { provider } };
  }

  if (pathname.startsWith('/api/admin/providers/') && pathname.endsWith('/verification') && method === 'POST') {
    const providerId = pathname.split('/')[4];
    const provider = MOCK_STATE.providers.find((item) => item.id === providerId);
    if (provider) provider.verified = !provider.verified;
    return { ok: true, status: 200, data: { success: Boolean(provider), provider } };
  }

  if (pathname === '/api/lab/reports' && method === 'POST') {
    let body: any = {};
    try { body = JSON.parse(options.body as string); } catch {}
    if (options.labId !== 'lab-demo') return { ok: false, status: 403, data: { error: 'A diagnostic lab account is required.' } };
    const healthPassId = normalizePrescriptionText(body.healthPassId).toUpperCase();
    const patientIds: Record<string, string> = { 'HP-DEMO-0417': 'pat-1', 'HP-CHILD-0892': 'pat-2', 'HP-ELDER-0931': 'pat-3' };
    const patientId = patientIds[healthPassId];
    if (!patientId) return { ok: false, status: 400, data: { error: 'Identify the patient using a valid HealthPass ID before saving.' } };
    const grant = MOCK_STATE.grants
      .filter((item: any) => item.patientId === patientId && item.providerId === options.labId && item.providerType === 'lab')
      .sort((a: any, b: any) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))[0];
    if (!grant || grant.status !== 'GRANTED' || !isActiveDemoGrant(grant)) return { ok: false, status: 403, data: { error: 'The patient must approve an active laboratory report request before a report can be added.' } };
    if (!(grant.grantedCategories || []).includes('Laboratory Reports')) return { ok: false, status: 403, data: { error: 'The patient has not approved access to laboratory reports.' } };
    const title = String(body.title || '').trim();
    const resultSummary = String(body.resultSummary || '').trim();
    if (!title || title.length > 160 || !resultSummary || resultSummary.length > 4000) return { ok: false, status: 400, data: { error: 'Enter a test name and result summary. Keep the test name under 160 characters and the result under 4,000 characters.' } };
    const report = {
      id: `rep-${Date.now()}`, patientId,
      title, category: 'Lab reports',
      reportDate: body.reportDate || new Date().toISOString().slice(0, 10),
      medicalCategory: MEDICAL_RECORD_CATEGORIES.includes(body.medicalCategory) ? body.medicalCategory : getMedicalRecordCategory({ title: body.title || body.testName, resultSummary: body.resultSummary, category: 'Lab reports' }),
      resultSummary, statusColor: 'UNVERIFIED',
      facilityName: 'District Hospital Diagnostic Lab, Vijayawada',
      facilityLevel: 'DISTRICT', facilityType: 'District Hospital', source: 'LAB_UPLOAD',
      uploaderId: options.labId, uploaderRole: 'lab', uploadedAt: new Date().toISOString(), verificationStatus: 'LAB_UPLOADED',
    };
    const duplicate = findMedicalRecordDuplicate(patientId, report, MOCK_STATE.reports);
    if (duplicate) return { ok: false, status: 409, data: { code: 'DUPLICATE_MEDICAL_RECORD', error: 'A matching active medical record already exists. Please open the existing record instead of creating another.', existingRecordId: duplicate.id, existingRecord: duplicate } };
    MOCK_STATE.reports.unshift(report);
    return { ok: true, status: 201, data: { report } };
  }

  if ((pathname === '/api/patient/reports' || /^\/api\/patient\/[^/]+\/reports$/.test(pathname)) && method === 'POST') {
    let body: any = {};
    try { body = JSON.parse(options.body as string); } catch {}
    const patientId = pathname === '/api/patient/reports' ? options.patientId || 'pat-1' : pathname.split('/')[3] || options.patientId || 'pat-1';
    if (options.patientId !== patientId) return { ok: false, status: 403, data: { error: 'The signed-in patient does not own this record.' } };
    const medicalCategory = MEDICAL_RECORD_CATEGORIES.includes(body.medicalCategory) ? body.medicalCategory : getMedicalRecordCategory(body);
    const isPrescriptionDocument = body.extractedFields?.reportType === 'Prescription' || /prescription/i.test(body.category || '');
    if (isPrescriptionDocument && (!body.title?.trim() || !body.fileDataUrl)) return { ok: false, status: 400, data: { error: 'A prescription title and original document are required.' } };
    const report = { ...body, id: `rep-${Date.now()}`, patientId,
      title: body.title || 'Patient document', category: body.category || 'Other documents', medicalCategory,
      resultSummary: body.resultSummary || 'Uploaded by patient.', statusColor: body.statusColor || 'UNVERIFIED',
      facilityName: body.facilityName || 'Patient uploaded', facilityLevel: body.facilityLevel || 'PATIENT', facilityType: body.facilityType || 'Patient',
      source: body.source || 'PATIENT_UPLOAD', uploadedAt: new Date().toISOString(),
      verificationStatus: body.confirmedByUser ? 'PATIENT_REVIEWED' : 'UNVERIFIED',
      prescriptionPeriod: isPrescriptionDocument ? 'UNCLASSIFIED' : undefined,
      prescriptionMetadataCorrections: {},
    };
    const duplicate = findMedicalRecordDuplicate(patientId, report, MOCK_STATE.reports);
    if (duplicate) return { ok: false, status: 409, data: { code: 'DUPLICATE_MEDICAL_RECORD', error: 'A matching active medical record already exists. Please open the existing record instead of creating another.', existingRecordId: duplicate.id, existingRecord: duplicate } };
    MOCK_STATE.reports.unshift(report);
    return { ok: true, status: 201, data: { report } };
  }

  if (/^\/api\/patient\/[^/]+\/prescriptions\/[^/]+\/metadata$/.test(pathname) && method === 'PATCH') {
    const [, , , patientId, , reportId] = pathname.split('/');
    if (options.patientId !== patientId) return { ok: false, status: 403, data: { error: 'Only the patient who owns this prescription may update its metadata.' } };
    const report = MOCK_STATE.reports.find((item) => item.id === reportId && item.patientId === patientId);
    if (!report || !(report.extractedFields?.reportType === 'Prescription' || /prescription/i.test(report.category || ''))) return { ok: false, status: 404, data: { error: 'Prescription document not found.' } };
    let body: any = {};
    try { body = JSON.parse(options.body as string); } catch {}
    if (body.medicalCategory && !MEDICAL_RECORD_CATEGORIES.includes(body.medicalCategory)) return { ok: false, status: 400, data: { error: 'Choose a valid medical category.' } };
    if (body.prescriptionPeriod && !['CURRENT', 'HISTORICAL', 'UNCLASSIFIED'].includes(body.prescriptionPeriod)) return { ok: false, status: 400, data: { error: 'Choose current, historical, or unclassified.' } };
    if (body.reportDate && Number.isNaN(Date.parse(body.reportDate))) return { ok: false, status: 400, data: { error: 'Enter a valid prescription date or leave it unknown.' } };
    if (typeof body.prescribingProvider === 'string' && body.prescribingProvider.length > 120) return { ok: false, status: 400, data: { error: 'Provider name must be 120 characters or fewer.' } };
    report.prescriptionMetadataCorrections = {
      ...(report.prescriptionMetadataCorrections || {}),
      reportDate: body.reportDate?.trim() || undefined,
      prescribingProvider: body.prescribingProvider?.trim() || undefined,
      medicalCategory: body.medicalCategory || undefined,
      prescriptionPeriod: body.prescriptionPeriod || undefined,
      correctedAt: new Date().toISOString(),
    };
    if (body.medicalCategory) report.medicalCategory = body.medicalCategory;
    return { ok: true, status: 200, data: { report } };
  }

  if (/^\/api\/patient\/[^/]+\/reports\/[^/]+\/category$/.test(pathname) && method === 'POST') {
    let body: any = {};
    try { body = JSON.parse(options.body as string); } catch {}
    const pathParts = pathname.split('/');
    const patientId = pathParts[3];
    const reportId = pathParts[5];
    const report = MOCK_STATE.reports.find((item) => item.id === reportId && item.patientId === patientId);
    if (!report) return { ok: false, status: 404, data: { error: 'Medical record not found.' } };
    if (!MEDICAL_RECORD_CATEGORIES.includes(body.medicalCategory)) return { ok: false, status: 400, data: { error: 'Choose a valid medical record category.' } };
    report.medicalCategory = body.medicalCategory;
    return { ok: true, status: 200, data: { report } };
  }

  if (/^\/api\/patient\/[^/]+\/health-profile$/.test(pathname)) {
    const patientId = pathname.split('/')[3];
    if (options.patientId !== patientId) return { ok: false, status: 403, data: { error: 'Only the patient can access this profile.' } };
    if (method === 'GET') {
      return { ok: true, status: 200, data: { profile: MOCK_STATE.patientHealthProfiles[patientId] || {
        patientId, knownAllergies: '', currentMedications: '', healthConditions: '', pastSurgeries: '',
        emergencyContactName: '', emergencyContactRelation: '', emergencyContactPhone: '', bloodGroup: '',
        source: 'Patient-provided', verificationStatus: 'Unverified', updatedAt: '',
      } } };
    }
    if (method === 'PUT') {
      let body: any = {};
      try { body = JSON.parse(options.body as string); } catch {}
      const bloodGroup = String(body.bloodGroup || '').trim();
      if (bloodGroup && !/^(A|B|AB|O)[+-]$/i.test(bloodGroup)) return { ok: false, status: 400, data: { error: 'Enter a valid blood group (A+, A-, B+, B-, AB+, AB-, O+, or O-), or leave it unknown.' } };
      const profile = {
        patientId, knownAllergies: String(body.knownAllergies || '').trim(),
        currentMedications: String(body.currentMedications || '').trim(), healthConditions: String(body.healthConditions || '').trim(),
        pastSurgeries: String(body.pastSurgeries || '').trim(), emergencyContactName: String(body.emergencyContactName || '').trim(),
        emergencyContactRelation: String(body.emergencyContactRelation || '').trim(), emergencyContactPhone: String(body.emergencyContactPhone || '').trim(),
        bloodGroup, source: 'Patient-provided', verificationStatus: 'Unverified', updatedAt: new Date().toISOString(),
      };
      if (profile.emergencyContactPhone && !/^[+0-9() .-]{7,20}$/.test(profile.emergencyContactPhone)) return { ok: false, status: 400, data: { error: 'Enter a valid emergency contact phone number.' } };
      if (Boolean(profile.emergencyContactName) !== Boolean(profile.emergencyContactPhone)) return { ok: false, status: 400, data: { error: 'Provide both a contact name and phone number, or leave both unknown.' } };
      MOCK_STATE.patientHealthProfiles[patientId] = profile;
      return { ok: true, status: 200, data: { profile } };
    }
  }

  if (method === 'DELETE' && /^\/api\/patient\/[^/]+\/reports\/[^/]+$/.test(pathname)) {
    const [, , , patientId, , reportId] = pathname.split('/');
    if (options.patientId !== patientId) return { ok: false, status: 403, data: { error: 'Only the patient who owns this record can remove it.' } };
    const index = MOCK_STATE.reports.findIndex((item) => item.id === reportId && item.patientId === patientId);
    if (index < 0) return { ok: false, status: 404, data: { error: 'Patient report not found.' } };
    const report = MOCK_STATE.reports[index];
    if (report.source !== 'PATIENT_UPLOAD') return { ok: false, status: 403, data: { error: 'Clinician and lab source records are retained. Only patient-uploaded demo documents can be removed.' } };
    MOCK_STATE.reports.splice(index, 1);
    recordDemoAudit('PATIENT_DOCUMENT_REMOVED', patientId, `${DEMO_PATIENT_NAMES[patientId] || 'The patient'} removed their uploaded document “${report.title}” from the local demo.`);
    return { ok: true, status: 200, data: { success: true } };
  }
  if (method === 'DELETE' && /^\/api\/patient\/[^/]+\/medicines\/[^/]+$/.test(pathname)) {
    const [, , , patientId, , medicineId] = pathname.split('/');
    if (options.patientId !== patientId) return { ok: false, status: 403, data: { error: 'Only the patient who owns this medication can remove it.' } };
    const index = MOCK_STATE.medicines.findIndex((item: any) => item.id === medicineId && item.patientId === patientId);
    if (index < 0) return { ok: false, status: 404, data: { error: 'Medication record not found.' } };
    if (MOCK_STATE.medicines[index].source !== 'SELF_REPORTED') return { ok: false, status: 403, data: { error: 'Prescribed medication records cannot be deleted from the patient demo.' } };
    const [medicine] = MOCK_STATE.medicines.splice(index, 1);
    recordDemoAudit('SELF_REPORTED_MEDICATION_REMOVED', patientId, `${DEMO_PATIENT_NAMES[patientId] || 'The patient'} removed self-reported medication ${medicine.name}.`);
    return { ok: true, status: 200, data: { success: true } };
  }

  if (/^\/api\/patient\/[^/]+\/reports\/[^/]+\/explanation$/.test(pathname) && method === 'POST') {
    const [, , , patientId, , reportId] = pathname.split('/');
    const report = MOCK_STATE.reports.find((item) => item.id === reportId && item.patientId === patientId);
    let body: any = {};
    try { body = JSON.parse(options.body as string); } catch {}
    const decision = canExplainDoctorReport({ requestingPatientId: options.patientId, report, externalAiConsent: body.externalAiConsent, language: body.language });
    if (!decision.ok) {
      const status = decision.code === 'PATIENT_OWNERSHIP_REQUIRED' ? 403 : decision.code === 'DOCTOR_REPORT_REQUIRED' ? 404 : decision.code === 'REPORT_TEXT_UNAVAILABLE' ? 422 : 400;
      const error = decision.code === 'PATIENT_OWNERSHIP_REQUIRED' ? 'Only the patient who owns this report can request an explanation.'
        : decision.code === 'DOCTOR_REPORT_REQUIRED' ? 'Doctor-uploaded report not found.'
        : decision.code === 'EXTERNAL_AI_CONSENT_REQUIRED' ? 'Please consent before sending de-identified report text to the configured AI service.'
        : decision.code === 'REPORT_TEXT_UNAVAILABLE' ? 'No supported report text is available. Image and scanned-PDF OCR is not configured.'
        : 'Choose English, Telugu, or Hindi.';
      return { ok: false, status, data: { code: decision.code, error } };
    }
    // The local demo API authorizes the patient-owned doctor report before the
    // UI forwards this short-lived, de-identified text to the loopback AI service.
    return { ok: true, status: 200, data: { sourceText: decision.reportText } };
  }

  if (/^\/api\/patient\/[^/]+\/reports\/[^/]+\/summary$/.test(pathname) && method === 'POST') {
    const [, , , patientId, , reportId] = pathname.split('/');
    if (options.patientId !== patientId) return { ok: false, status: 403, data: { error: 'Only the patient who owns this report can view its extracted facts.' } };
    const report = MOCK_STATE.reports.find((item) => item.id === reportId && item.patientId === patientId);
    if (!report) return { ok: false, status: 404, data: { error: 'Medical report not found.' } };
    return { ok: true, status: 200, data: { summary: createMedicalReportSummary(report) } };
  }

  if (/^\/api\/provider\/patient\/[^/]+\/reports\/[^/]+\/summary$/.test(pathname) && method === 'POST') {
    const [, , , , patientId, , reportId] = pathname.split('/');
    const doctorId = options.doctorId || '';
    const grant = MOCK_STATE.grants.find((item) => item.patientId === patientId && item.doctorId === doctorId && isActiveDemoGrant(item));
    if (!grant) {
      const error = map403ToConsentScreen('NO_CONSENT', 'An active patient consent grant is required to view this report.');
      return { ok: false, status: 403, data: { code: error.code, message: error.message }, consentError: error };
    }
    const report = MOCK_STATE.reports.find((item) => item.id === reportId && item.patientId === patientId);
    if (!report) return { ok: false, status: 404, data: { error: 'Medical report not found.' } };
    if (!isMedicalRecordAuthorized(grant, report) || isPrescriptionDocument(report) && !isMedicalCategoryAuthorized(grant, 'Medications & Prescriptions')) {
      const error = map403ToConsentScreen('CATEGORY_NOT_SHARED', 'The patient did not share this medical record category.');
      return { ok: false, status: 403, data: { code: error.code, message: error.message }, consentError: error };
    }
    return { ok: true, status: 200, data: { summary: createMedicalReportSummary(report) } };
  }

  if (/^\/api\/provider\/patient\/[^/]+\/reports$/.test(pathname) && method === 'GET') {
    const patientId = pathname.split('/')[4];
    const doctorId = searchParams.get('doctorId') || options.doctorId || '';
    const requestedCategory = searchParams.get('category');
    const grant = MOCK_STATE.grants.find((item) => item.patientId === patientId && item.doctorId === doctorId && isActiveDemoGrant(item));
    if (!grant) {
      const error = map403ToConsentScreen('NO_CONSENT', 'An active patient consent grant is required to view medical records.');
      return { ok: false, status: 403, data: { code: error.code, message: error.message }, consentError: error };
    }
    if (requestedCategory && !isMedicalCategoryAuthorized(grant, requestedCategory as any)) {
      const error = map403ToConsentScreen('CATEGORY_NOT_SHARED', 'The patient did not share this medical record category.');
      return { ok: false, status: 403, data: { code: error.code, message: error.message }, consentError: error };
    }
    const reports = MOCK_STATE.reports.filter((report) => report.patientId === patientId &&
      isMedicalRecordAuthorized(grant, report) && (!isPrescriptionDocument(report) || isMedicalCategoryAuthorized(grant, 'Medications & Prescriptions')) &&
      (!requestedCategory || getMedicalRecordCategory(report) === requestedCategory));
    return { ok: true, status: 200, data: { reports } };
  }

  if (pathname.includes('/provider/patient/') && pathname.endsWith('/reports') && method === 'POST') {
    let body: any = {};
    try { body = JSON.parse(options.body as string); } catch {}
    const patientId = pathname.split('/')[4];
    if (!patientId || options.patientId !== patientId) return { ok: false, status: 403, data: { error: 'Upload must target the selected patient profile.' } };
    const doctorId = options.doctorId || body.doctorId;
    const grant = MOCK_STATE.grants.find((item) => item.patientId === patientId && item.doctorId === doctorId && isActiveDemoGrant(item));
    if (!grant) return { ok: false, status: 403, data: { code: 'NO_CONSENT', message: 'An active patient consent grant is required to add a report.' }, consentError: map403ToConsentScreen('NO_CONSENT') };
    const medicalCategory = MEDICAL_RECORD_CATEGORIES.includes(body.medicalCategory) ? body.medicalCategory : getMedicalRecordCategory(body);
    if (!isMedicalCategoryAuthorized(grant, medicalCategory)) {
      return { ok: false, status: 403, data: { code: 'CATEGORY_NOT_SHARED', message: 'The patient did not share this report category.' }, consentError: map403ToConsentScreen('CATEGORY_NOT_SHARED') };
    }
    const isPrescriptionDocument = body.extractedFields?.reportType === 'Prescription' || /prescription/i.test(body.category || '');
    if (!body.title?.trim() || !body.fileDataUrl || !body.extractedFields?.reportType) return { ok: false, status: 400, data: { error: 'Select and process the original report before uploading.' } };
    if (isPrescriptionDocument && !isMedicalCategoryAuthorized(grant, 'Medications & Prescriptions')) return { ok: false, status: 403, data: { code: 'CATEGORY_NOT_SHARED', message: 'The patient did not share prescription records.' }, consentError: map403ToConsentScreen('CATEGORY_NOT_SHARED') };
    const report = {
      ...body, id: `rep-${Date.now()}`, patientId, title: body.title || body.testName || 'Clinical report',
      category: body.category || 'Other documents', resultSummary: body.resultSummary || '',
      medicalCategory,
      statusColor: body.statusColor || 'UNVERIFIED', facilityName: body.facilityName || 'Village Health Centre, Kothapalli',
      facilityLevel: body.facilityLevel || 'VILLAGE', facilityType: body.facilityType || 'Village Health Centre', source: 'DOCTOR_UPLOAD',
      uploaderRole: 'doctor', uploadedBy: doctorId, reportType: body.extractedFields.reportType,
      uploadedAt: new Date().toISOString(), processingStatus: body.rawOcrText?.trim() ? 'OCR_COMPLETE' : 'OCR_UNREADABLE',
      verificationStatus: body.confirmedByUser ? 'PATIENT_REVIEWED' : 'UNVERIFIED',
      prescriptionPeriod: isPrescriptionDocument ? 'UNCLASSIFIED' : undefined, prescriptionMetadataCorrections: {},
    };
    const duplicate = findMedicalRecordDuplicate(patientId, report, MOCK_STATE.reports);
    if (duplicate) return { ok: false, status: 409, data: { code: 'DUPLICATE_MEDICAL_RECORD', error: 'A matching active medical record already exists. Please open the existing record instead of creating another.', existingRecordId: duplicate.id, existingRecord: duplicate } };
    MOCK_STATE.reports.unshift(report);
    return { ok: true, status: 201, data: { report } };
  }

  if (pathname.includes('/patient/') && pathname.includes('/medicines/') && method === 'POST') {
    let body: any = {};
    try { body = JSON.parse(options.body as string); } catch {}
    const medicine = MOCK_STATE.medicines.find((m) => m.id === body.medicineId);
    if (medicine && body.action === 'TOGGLE_STOP') medicine.computedStatus = medicine.computedStatus === 'ACTIVE' ? 'STOPPED' : 'ACTIVE';
    if (medicine && body.action === 'REQUEST_REFILL') medicine.refillRequested = true;
    if (medicine && body.action === 'MARK_TAKEN') medicine.lastTakenAt = new Date().toISOString();
    return { ok: true, status: 200, data: { success: true, medicine } };
  }

  if (pathname.includes('/patient/') && pathname.endsWith('/medicines') && method === 'POST') {
    let body: any = {};
    try { body = JSON.parse(options.body as string); } catch {}
    const patientId = pathname.split('/')[3] || options.patientId || 'pat-1';
    if (options.patientId !== patientId) return { ok: false, status: 403, data: { error: 'The signed-in patient does not own this medication list.' } };
    const name = String(body.name || '').trim();
    const strength = String(body.strength || '').trim();
    if (!name) return { ok: false, status: 400, data: { error: 'Enter a medicine name.' } };
    const inactiveStatuses = new Set(['stopped', 'discontinued', 'cancelled', 'canceled', 'expired', 'completed', 'historical', 'revoked', 'archived']);
    const duplicate = MOCK_STATE.medicines.find((item: any) => item.patientId === patientId &&
      normalizePrescriptionText(item.name) === normalizePrescriptionText(name) &&
      normalizePrescriptionText(item.strength) === normalizePrescriptionText(strength) &&
      !inactiveStatuses.has(normalizePrescriptionText(item.computedStatus || item.status)));
    if (duplicate) return { ok: false, status: 409, data: { code: 'DUPLICATE_MEDICINE', error: `${name}${strength ? ` ${strength}` : ''} is already on this patient's medication list.`, existingMedicineId: duplicate.id } };
    const medicine = { id: `med-${Date.now()}`, patientId,
      name, strength, dosage: 'As reported',
      route: 'Oral', frequency: { morning: 0, noon: 0, night: 0 }, durationDays: 0,
      daysRemaining: 0, computedStatus: 'SELF_REPORTED', source: 'SELF_REPORTED', prescriberName: 'Patient reported' };
    MOCK_STATE.medicines.unshift(medicine);
    return { ok: true, status: 201, data: { medicine } };
  }

  if (method === 'POST' && /^\/api\/patient\/[^/]+\/qr-token$/.test(pathname)) {
    const patientId = pathname.split('/')[3];
    if (options.patientId !== patientId || !DEMO_PATIENT_NAMES[patientId]) return { ok: false, status: 403, data: { error: 'Only the matching fictional patient can replace their demo QR token.' } };
    const token = `HPQR-${patientId.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    MOCK_STATE.qrTokens[patientId] = token;
    const revoked = MOCK_STATE.grants.filter((grant: any) => grant.patientId === patientId && grant.status === 'GRANTED');
    revoked.forEach((grant: any) => { grant.status = 'REVOKED'; });
    recordDemoAudit('QR_TOKEN_REPLACED', patientId, `${DEMO_PATIENT_NAMES[patientId]} replaced their demo QR token and revoked ${revoked.length} active grants.`);
    return { ok: true, status: 200, data: { qrToken: token } };
  }

  // 1. Patient Wallet
  if (pathname.includes('/wallet')) {
    const patId = pathname.split('/')[3] || 'pat-1';
    const registeredUser = getRegisteredUsers().find((u) => u.id === patId);
    const patientName = registeredUser?.name || (patId === 'pat-2' ? 'Aarav Kumar (Child)' : patId === 'pat-3' ? 'Lakshmi Narayana' : DEMO_PATIENT_NAMES[patId] || 'Demo Patient (Ananya Rao)');
    const patientHpId = registeredUser?.healthPassId || (patId === 'pat-2' ? 'HP-CHILD-0892' : patId === 'pat-3' ? 'HP-ELDER-0931' : 'HP-DEMO-0417');

    return {
      ok: true,
      status: 200,
      data: {
        patient: {
          id: patId,
          name: patientName,
          age: registeredUser?.age || (patId === 'pat-2' ? 7 : patId === 'pat-3' ? 68 : 42),
          gender: registeredUser?.gender || (patId === 'pat-2' ? 'Male' : patId === 'pat-3' ? 'Male' : 'Female'),
          bloodGroup: registeredUser?.bloodGroup || 'O+',
          healthPassId: patientHpId,
          abhaNumber: registeredUser ? `91-4820-7391-${patId.slice(-4)}` : '91-4820-7391-0417',
          qrToken: MOCK_STATE.qrTokens[patId] || patientHpId,
          guardianName: patId === 'pat-2' ? 'Ananya Rao (Mother)' : undefined,
          emergencyContact: { name: 'Emergency Contact', relation: 'Family', phone: '+91 98480 99112' },
        },
        patientHealthProfile: MOCK_STATE.patientHealthProfiles[patId] || null,
        record: {
          allergies: MOCK_STATE.allergies.filter((row: any) => row.patientId === patId),
          medicines: MOCK_STATE.medicines.filter((row: any) => row.patientId === patId),
          visits: MOCK_STATE.visits.filter((row: any) => row.patientId === patId),
          reports: MOCK_STATE.reports.filter((report) => report.patientId === patId),
          prescriptions: MOCK_STATE.prescriptions.filter((row: any) => row.patientId === patId),
          chronicConditions: patId === 'pat-1' ? MOCK_CHRONIC_CONDITIONS : [],
          vitals: patId === 'pat-1' ? [
            { bpSystolic: 122, bpDiastolic: 80, bloodSugarMgDl: 98, weightKg: 64 },
          ] : [],
          vaccinations: patId === 'pat-1' ? [
            { id: 'vac-1', vaccineName: 'COVID-19 Booster', status: 'COMPLETED' },
            { id: 'vac-2', vaccineName: 'Seasonal Influenza', status: 'COMPLETED' },
          ] : [],
        },
        grants: MOCK_STATE.grants.filter((grant: any) => grant.patientId === patId),
        auditLogs: MOCK_STATE.auditLogs.filter((audit: any) => audit.patientId === patId || (!audit.patientId && patId === 'pat-1')),
        emergencyLinks: MOCK_STATE.emergencyRecords.filter((record: any) => record.linkingWorkflow?.targetPatientId === patId),
        notifications: [
          {
            id: 'notif-1',
            title: 'HealthPass Consent Gateway',
            messageEn: 'Dr. Anil Kumar accessed your active medicines and prescriptions at Village Health Centre.',
            messageTe: 'గ్రామ ఆరోగ్య కేంద్రంలో డాక్టర్ మీ మందుల వివరాలను పరిశీలించారు.',
            messageHi: 'गांव के स्वास्थ्य केंद्र में डॉक्टर ने आपकी दवाओं की समीक्षा की।',
          },
        ],
        auditChainVerification: { totalEntries: MOCK_STATE.auditLogs.length, simulated: true },
      },
    };
  }

  if (/^\/api\/provider\/patient\/[^/]+\/consultation$/.test(pathname) && method === 'POST') {
    let body: any = {};
    try { body = JSON.parse(options.body as string); } catch {}
    const patientId = options.patientId || pathname.split('/')[4];
    const doctorId = body.doctorId || options.doctorId;
    const grant = MOCK_STATE.grants.find((item) => item.patientId === patientId && item.doctorId === doctorId && item.status === 'GRANTED');
    if (!grant) {
      const error = map403ToConsentScreen('NO_CONSENT', 'An active patient consent grant is required to add a consultation.');
      return { ok: false, status: 403, data: { code: error.code, message: error.message }, consentError: error };
    }
    if (!isMedicalCategoryAuthorized(grant, 'Consultation History')) {
      const error = map403ToConsentScreen('CATEGORY_NOT_SHARED', 'The patient did not share consultation history.');
      return { ok: false, status: 403, data: { code: error.code, message: error.message }, consentError: error };
    }
    const candidates = Array.isArray(body.medicines) ? body.medicines : [];
    if (candidates.some((med: any) => !String(med?.name || '').trim() || !String(med?.strength || '').trim() || !String(med?.dosage || '').trim() || !String(med?.route || '').trim())) {
      return { ok: false, status: 400, data: { code: 'PRESCRIPTION_VALIDATION_ERROR', error: 'Enter a medication name, strength, dosage, and route for every prescribed medicine.' } };
    }
    const idempotencyKey = String(body.idempotencyKey || '').trim();
    if (idempotencyKey) {
      const existingVisit = MOCK_STATE.visits.find((item: any) => item.patientId === patientId && item.idempotencyKey === idempotencyKey);
      if (existingVisit) {
        const existingPrescription = MOCK_STATE.prescriptions.find((item: any) => item.consultationId === existingVisit.id) || null;
        return { ok: true, status: 200, data: { success: true, consultationRecorded: true, visit: existingVisit, prescription: existingPrescription, idempotentReplay: true } };
      }
    }
    const encounterDate = new Date().toISOString().slice(0, 10);
    const eventSummary = `${String(body.chiefComplaint || '').trim()}\n${String(body.clinicalNotes || '').trim()}`.trim();
    const existingVisit = findMedicalRecordDuplicate(patientId, {
      idempotencyKey, medicalCategory: 'Consultation History', title: body.diagnosis || 'Consultation',
      resultSummary: eventSummary, reportDate: encounterDate, facilityName: grant.facilityName,
    }, MOCK_STATE.visits.map((item: any) => ({ ...item, title: item.diagnosis || 'Consultation', resultSummary: `${String(item.chiefComplaint || '').trim()}\n${String(item.clinicalNotes || '').trim()}`.trim(), reportDate: item.recordDate || item.date })));
    if (existingVisit) return { ok: false, status: 409, data: { code: 'DUPLICATE_MEDICAL_RECORD', error: 'A matching active medical record already exists. Please open the existing record instead of creating another.', existingRecordId: existingVisit.id, existingRecord: existingVisit } };
    // Demo persistence is synchronous, so this check and the following writes run atomically
    // within this JavaScript context. A production server must repeat this transactionally.
    const visit = {
      id: `visit-${Date.now()}`, patientId, medicalCategory: 'Consultation History',
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      recordDate: encounterDate, idempotencyKey,
      diagnosis: body.diagnosis || 'Consultation', chiefComplaint: body.chiefComplaint || '',
      clinicalNotes: body.clinicalNotes || '', doctorName: grant.doctorName,
      facilityName: grant.facilityName, facilityLevel: grant.facilityLevel,
      facilityType: grant.facilityType, confirmedByClinician: true,
    };
    const duplicate = findActivePrescriptionDuplicate(patientId, candidates, MOCK_STATE.medicines);
    if (duplicate) {
      // A duplicate prescription must not erase the clinician's consultation record.
      MOCK_STATE.visits.unshift(visit);
      return { ok: true, status: 201, data: {
        success: true, consultationRecorded: true, visit, prescription: null,
        prescriptionWarning: {
        code: 'ACTIVE_PRESCRIPTION_DUPLICATE',
        error: 'An active prescription for this medication already exists. Review the existing prescription before creating another.',
        existingPrescriptionId: duplicate.prescription.id,
        existingPrescription: duplicate.prescription,
        },
      } };
    }
    MOCK_STATE.visits.unshift(visit);
    const prescription = candidates.length ? {
      id: `rx-${Date.now()}`, patientId, doctorId, doctorName: grant.doctorName,
      createdAt: new Date().toISOString(), status: 'ACTIVE', diagnosis: body.diagnosis,
      date: visit.date, consultationId: visit.id,
      medicines: candidates.map((med: any, index: number) => ({
        ...med, id: `rx-${Date.now()}-${index}`, frequency: { morning: med.morning, noon: med.noon, night: med.night },
        instructions: med.instructions || med.notes || '',
      })),
    } : null;
    if (prescription) {
      MOCK_STATE.prescriptions.unshift(prescription);
      prescription.medicines.forEach((med: any, index: number) => MOCK_STATE.medicines.unshift({
        ...med, id: med.id || `med-rx-${Date.now()}-${index}`, patientId, status: 'ACTIVE', computedStatus: 'ACTIVE',
        startDate: med.startDate || new Date().toISOString().slice(0, 10),
        endDate: med.endDate || '', prescriberName: grant.doctorName, prescriptionId: prescription.id,
      }));
    }
    return { ok: true, status: 201, data: { success: true, visit, prescription } };
  }

  // 2. Provider Record (Requires Active Grant!)
  if (pathname.includes('/record') && pathname.includes('/provider/')) {
    const docId = searchParams.get('doctorId') || options.doctorId || 'doc-village';
    const patId = options.patientId || 'pat-1';

    // Find active grant
    const activeGrant = MOCK_STATE.grants.find(
      (g) => g.doctorId === docId && g.patientId === patId && g.status === 'GRANTED'
    );

    if (!activeGrant) {
      const revokedGrant = MOCK_STATE.grants.find(
        (g) => g.doctorId === docId && g.patientId === patId && g.status === 'REVOKED'
      );
      const code = revokedGrant ? 'ACCESS_REVOKED' : 'NO_CONSENT';
      const msg = revokedGrant
        ? 'The patient has withdrawn permission.'
        : 'No active consent grant found for this doctor.';
      const consentError = map403ToConsentScreen(code, msg, revokedGrant);
      if (!options.suppressGlobal403 && global403Handler) {
        global403Handler(consentError, { doctorId: docId, patientId: patId, endpoint });
      }
      return {
        ok: false,
        status: 403,
        data: { code, message: msg, grant: revokedGrant },
        consentError,
      };
    }

    const canAccess = (category: any) => isMedicalCategoryAuthorized(activeGrant, category);
    const authorizedReports = MOCK_STATE.reports.filter((report) =>
      report.patientId === patId && isMedicalRecordAuthorized(activeGrant, report) &&
      (!isPrescriptionDocument(report) || isMedicalCategoryAuthorized(activeGrant, 'Medications & Prescriptions'))
    );
    const granted = new Set<string>(activeGrant.grantedCategories || []);
    const canAccessMedicationData = granted.has('Medications & Prescriptions') || granted.has('Medicines');
    const canAccessPrescriptionData = granted.has('Medications & Prescriptions') || granted.has('Prescriptions');
    const authorizedVisits = canAccess('Consultation History')
      ? MOCK_STATE.visits.filter((visit) => visit.patientId === patId)
      : [];
    const chronicConditions = MOCK_CHRONIC_CONDITIONS.filter((condition) => canAccess(getMedicalRecordCategory(condition)));
    const patientProfile = MOCK_STATE.patientHealthProfiles[patId] || {};
    const profileShared = canAccess('General Medical History');
    const authorizedProfileFields = {
      knownAllergies: canAccess('Allergies') ? patientProfile.knownAllergies || '' : undefined,
      currentMedications: canAccessMedicationData ? patientProfile.currentMedications || '' : undefined,
      healthConditions: profileShared ? patientProfile.healthConditions || '' : undefined,
      pastSurgeries: canAccess('Surgeries & Procedures') ? patientProfile.pastSurgeries || '' : undefined,
      bloodGroup: profileShared ? patientProfile.bloodGroup || undefined : undefined,
      // Emergency contacts have no dedicated consent scope in this application, so keep them patient-only.
      emergencyContactName: undefined,
      emergencyContactRelation: undefined,
      emergencyContactPhone: undefined,
    };
    const hasAuthorizedProfileData = Object.values(authorizedProfileFields).some(Boolean);
    const authorizedHealthProfile = {
      ...authorizedProfileFields,
      ...(hasAuthorizedProfileData ? {
      source: patientProfile.source, verificationStatus: patientProfile.verificationStatus,
      updatedAt: patientProfile.updatedAt,
      } : {}),
    };
    recordDemoAudit('RECORDS_VIEWED', patId, `${activeGrant.doctorName} opened ${[...granted].join(', ') || 'authorized'} records for ${DEMO_PATIENT_NAMES[patId] || 'the demo patient'}.`);
    return {
      ok: true,
      status: 200,
      data: {
        patient: {
          id: patId,
          name: patId === 'pat-2' ? 'Aarav Kumar (Child)' : patId === 'pat-3' ? 'Lakshmi Narayana' : 'Demo Patient (Ananya Rao)',
          age: patId === 'pat-2' ? 7 : patId === 'pat-3' ? 68 : 42,
          gender: patId === 'pat-2' || patId === 'pat-3' ? 'Male' : 'Female',
          bloodGroup: undefined,
          healthPassId: patId === 'pat-2' ? 'HP-CHILD-0892' : patId === 'pat-3' ? 'HP-ELDER-0931' : 'HP-DEMO-0417',
          abhaNumber: '91-4820-7391-0417',
        },
        grant: activeGrant,
        healthProfileSection: { shared: hasAuthorizedProfileData, profile: authorizedHealthProfile },
        allergies: canAccess('Allergies') ? MOCK_STATE.allergies.filter((allergy) => allergy.patientId === patId) : [],
        allergiesSection: { shared: canAccess('Allergies') },
        medicinesSection: {
          shared: canAccessMedicationData,
          activeMedicines: canAccessMedicationData ? MOCK_STATE.medicines.filter((m) => m.patientId === patId && m.computedStatus === 'ACTIVE') : [],
          pastMedicines: canAccessMedicationData ? MOCK_STATE.medicines.filter((m) => m.patientId === patId && m.computedStatus !== 'ACTIVE') : [],
        },
        prescriptionsSection: {
          shared: canAccessPrescriptionData,
          prescriptions: canAccessPrescriptionData ? MOCK_STATE.prescriptions.filter((prescription) => prescription.patientId === patId) : [],
        },
        historySection: {
          shared: chronicConditions.length > 0 || authorizedVisits.length > 0,
          chronicConditions,
          visits: authorizedVisits,
        },
        labReportsSection: {
          shared: authorizedReports.some((report) => getMedicalRecordCategory(report) === 'Laboratory Reports'),
          reports: authorizedReports.filter((report) => getMedicalRecordCategory(report) === 'Laboratory Reports'),
        },
        medicalRecordsSection: { shared: authorizedReports.length > 0, records: authorizedReports },
      },
    };
  }

  if (pathname === '/api/lab/patient-lookup' && method === 'POST') {
    let body: any = {};
    try { body = JSON.parse(options.body as string); } catch {}
    if (options.labId !== 'lab-demo') return { ok: false, status: 403, data: { error: 'A diagnostic lab account is required.' } };
    const healthPassId = normalizePrescriptionText(body.healthPassId).toUpperCase();
    const patients = [
      { patientId: 'pat-1', name: 'Demo Patient (Ananya Rao)', healthPassId: 'HP-DEMO-0417' },
      { patientId: 'pat-2', name: 'Aarav Kumar (Child)', healthPassId: 'HP-CHILD-0892' },
      { patientId: 'pat-3', name: 'Lakshmi Narayana', healthPassId: 'HP-ELDER-0931' },
    ];
    const patient = patients.find((item) => item.healthPassId === healthPassId);
    if (!patient) return { ok: false, status: 404, data: { error: 'No patient matches that HealthPass ID.' } };
    const grant = MOCK_STATE.grants
      .filter((item: any) => item.patientId === patient.patientId && item.providerId === options.labId && item.providerType === 'lab')
      .sort((a: any, b: any) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))[0] || null;
    const accessStatus = grant?.status === 'GRANTED' && !isActiveDemoGrant(grant) ? 'EXPIRED' : grant?.status || 'NONE';
    return { ok: true, status: 200, data: { patient, accessStatus, grant } };
  }

  if (pathname === '/api/lab/request-access' && method === 'POST') {
    let body: any = {};
    try { body = JSON.parse(options.body as string); } catch {}
    if (options.labId !== 'lab-demo') return { ok: false, status: 403, data: { error: 'A diagnostic lab account is required.' } };
    const healthPassId = normalizePrescriptionText(body.healthPassId).toUpperCase();
    const patientIds: Record<string, string> = { 'HP-DEMO-0417': 'pat-1', 'HP-CHILD-0892': 'pat-2', 'HP-ELDER-0931': 'pat-3' };
    const patientId = patientIds[healthPassId];
    if (!patientId) return { ok: false, status: 404, data: { error: 'No patient matches that HealthPass ID.' } };
    const existing = MOCK_STATE.grants
      .filter((item: any) => item.patientId === patientId && item.providerId === options.labId && item.providerType === 'lab')
      .sort((a: any, b: any) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))[0];
    if (existing?.status === 'PENDING' || existing?.status === 'GRANTED' && isActiveDemoGrant(existing)) return { ok: true, status: 200, data: { grant: existing } };
    const grant = {
      id: `grant-lab-${Date.now()}`, patientId, providerId: options.labId, providerType: 'lab', doctorId: options.labId,
      doctorName: 'Diagnostic Lab Staff', facilityName: 'District Hospital Diagnostic Lab, Vijayawada',
      facilityLevel: 'DISTRICT', facilityType: 'Diagnostic Laboratory', purpose: 'Upload laboratory test results to the patient HealthPass',
      requestedCategories: ['Laboratory Reports'], grantedCategories: [], durationHours: 24,
      status: 'PENDING', createdAt: new Date().toISOString(),
    };
    MOCK_STATE.grants.push(grant);
    recordDemoAudit('ACCESS_REQUESTED', patientId, `Diagnostic Lab Staff requested Laboratory Reports access for ${DEMO_PATIENT_NAMES[patientId] || 'the demo patient'} to add a test result.`);
    return { ok: true, status: 201, data: { grant } };
  }

  // 3. Provider lookup
  if (pathname.includes('/lookup')) {
    let body: any = {};
    try { body = JSON.parse(options.body as string); } catch {}
    const normalizedQuery = normalizePrescriptionText(body.query);
    const patients = [
      { patientId: 'pat-1', name: 'Demo Patient (Ananya Rao)', healthPassId: 'HP-DEMO-0417' },
      { patientId: 'pat-2', name: 'Aarav Kumar (Child)', healthPassId: 'HP-CHILD-0892' },
      { patientId: 'pat-3', name: 'Lakshmi Narayana', healthPassId: 'HP-ELDER-0931' },
    ];
    const patient = patients.find((item) => normalizePrescriptionText(item.healthPassId) === normalizedQuery
      || normalizePrescriptionText(MOCK_STATE.qrTokens[item.patientId]) === normalizedQuery);
    if (!patient) return { ok: false, status: 404, data: { error: 'No patient matches that HealthPass ID.' } };
    return {
      ok: true,
      status: 200,
      data: {
        lookup: {
          ...patient,
          gatewayLabel: 'HealthPass Verified Identity',
        },
      },
    };
  }

  // 4. Request Access
  if (pathname.includes('/request-access')) {
    let body: any = {};
    try {
      body = JSON.parse(options.body as string);
    } catch {}
    const newGrant = {
      id: `grant-${Date.now()}`,
      patientId: body.patientId || 'pat-1',
      doctorId: body.doctorId || 'doc-village',
      doctorName: body.doctorId === 'doc-mandal' ? 'Dr. Rahul Sharma' : body.doctorId === 'doc-district' ? 'Dr. Meera Reddy' : 'Dr. Anil Kumar',
      facilityName: body.doctorId === 'doc-mandal' ? 'Mandal Health Centre, Nandigama' : body.doctorId === 'doc-district' ? 'District Hospital, Vijayawada' : 'Village Health Centre, Kothapalli',
      facilityLevel: body.doctorId === 'doc-mandal' ? 'MANDAL' : body.doctorId === 'doc-district' ? 'DISTRICT' : 'VILLAGE',
      facilityType: body.doctorId === 'doc-mandal' ? 'Mandal Health Centre' : body.doctorId === 'doc-district' ? 'District Hospital' : 'Village Health Centre',
      purpose: body.purpose || 'Outpatient consultation',
      requestedCategories: body.requestedCategories || ['Medical history', 'Prescriptions', 'Medicines'],
      durationHours: body.durationHours || 24,
      status: 'PENDING',
      // Demo-only patient-held code; never returned to the provider API surface.
      otpCode: '482910',
      createdAt: new Date().toISOString(),
    };
    MOCK_STATE.grants.push(newGrant);
    recordDemoAudit('ACCESS_REQUESTED', newGrant.patientId, `${newGrant.doctorName} requested ${newGrant.requestedCategories.join(', ')} for ${DEMO_PATIENT_NAMES[newGrant.patientId] || 'the demo patient'}: ${newGrant.purpose}.`);
    return {
      ok: true,
      status: 200,
      data: { grant: newGrant },
    };
  }

  // 4b. In-person OTP approval (demo mirrors the backend contract)
  if (pathname === '/api/provider/approve-in-person-otp') {
    let body: any = {};
    try {
      body = JSON.parse(options.body as string);
    } catch {}
    const grant = MOCK_STATE.grants.find((g: any) => g.id === body.grantId);
    if (!grant || grant.status !== 'PENDING') {
      return { ok: false, status: 409, data: { code: 'CONSENT_NOT_PENDING', error: 'This consent request is no longer pending.' } };
    }
    if (grant.expiresAt && Date.parse(grant.expiresAt) <= Date.now()) {
      return { ok: false, status: 403, data: { code: 'ACCESS_EXPIRED', error: 'This consent request has expired.' } };
    }
    grant.otpAttempts = Number(grant.otpAttempts) || 0;
    if (grant.otpAttempts >= 5) {
      grant.otpCode = undefined;
      return { ok: false, status: 429, data: { code: 'OTP_LOCKED', error: 'Too many incorrect codes. Ask the patient to start a new request.' } };
    }
    if (String(body.otp || '').trim() !== String(grant.otpCode || '')) {
      grant.otpAttempts += 1;
      if (grant.otpAttempts >= 5) grant.otpCode = undefined;
      return { ok: false, status: 403, data: { code: 'OTP_INVALID', error: 'The in-person code is incorrect.' } };
    }
    grant.status = 'GRANTED';
    grant.grantedCategories = Array.isArray(body.selectedCategories) && body.selectedCategories.length
      ? body.selectedCategories
      : grant.requestedCategories || [];
    grant.approvedAt = new Date().toISOString();
    grant.otpCode = undefined;
    recordDemoAudit('CONSENT_GRANTED', grant.patientId,
      `${DEMO_PATIENT_NAMES[grant.patientId] || 'The patient'} approved in-person access by sharing a one-time code.`);
    return { ok: true, status: 200, data: { success: true, grant } };
  }

  // 5. Consent decision
  if (pathname.includes('/decide')) {
    let body: any = {};
    try {
      body = JSON.parse(options.body as string);
    } catch {}
    const grantId = pathname.split('/')[5];
    const patientId = pathname.split('/')[3];
    const grant = MOCK_STATE.grants.find((g) => g.id === grantId && g.patientId === patientId);
    if (!grant || grant.status !== 'PENDING') return { ok: false, status: 404, data: { error: 'Pending consent request not found.' } };
    if (grant.providerType === 'pharmacist') {
      const outcome = decidePharmacistPrescriptionRequest(grant, body.decision, {
        durationHours: body.durationHours || grant.durationHours || 24,
        durationSeconds: body.durationSeconds,
      } as any);
      if (!outcome.ok) return { ok: false, status: 403, data: { error: outcome.error } };
      Object.assign(grant, outcome.grant);
    } else if (grant.providerType === 'lab' && body.decision === 'GRANT') {
      grant.grantedCategories = ['Laboratory Reports'];
      grant.status = 'GRANTED';
      const durationMs = body.durationSeconds ? Number(body.durationSeconds) * 1000 : Number(body.durationHours || grant.durationHours || 24) * 3600000;
      grant.expiresAt = new Date(Date.now() + Math.min(168 * 3600000, Math.max(1000, durationMs))).toISOString();
    } else if (body.decision === 'GRANT') {
      grant.grantedCategories = body.grantedCategories || grant.requestedCategories || [];
      grant.status = 'GRANTED';
      const durationMs = body.durationSeconds ? Number(body.durationSeconds) * 1000 : Number(body.durationHours || grant.durationHours || 24) * 3600000;
      grant.expiresAt = new Date(Date.now() + Math.min(168 * 3600000, Math.max(1000, durationMs))).toISOString();
    } else if (body.decision === 'DENY') {
      grant.status = 'DENIED';
    } else {
      return { ok: false, status: 400, data: { error: 'Choose approve or reject.' } };
    }
    const granted = grant.status === 'GRANTED';
    recordDemoAudit(granted ? 'CONSENT_GRANTED' : 'CONSENT_REJECTED', patientId,
      `${DEMO_PATIENT_NAMES[patientId] || 'The patient'} ${granted ? 'approved' : 'rejected'} ${grant.providerType === 'pharmacist' ? 'prescription-only' : grant.requestedCategories?.join(', ') || 'record'} access for ${grant.doctorName}.${granted ? ` Expires ${new Date(grant.expiresAt).toLocaleString()}.` : ''}`);
    return { ok: true, status: 200, data: { success: true, grant } };
  }

  // 6. Revoke
  if (pathname.includes('/revoke')) {
    if (pathname.includes('/revoke-all')) {
      const patientId = pathname.split('/')[3];
      MOCK_STATE.grants.filter((g: any) => g.patientId === patientId).forEach((g: any) => (g.status = 'REVOKED'));
      recordDemoAudit('CONSENT_REVOKED', patientId, `${DEMO_PATIENT_NAMES[patientId] || 'The patient'} revoked all active access grants.`);
      return { ok: true, status: 200, data: { success: true } };
    }
    const grantId = pathname.split('/')[5];
    const patientId = pathname.split('/')[3];
    const grant = MOCK_STATE.grants.find((g) => g.id === grantId && g.patientId === patientId);
    if (!grant || grant.status !== 'GRANTED') return { ok: false, status: 404, data: { error: 'Active consent grant not found.' } };
    if (grant.providerType === 'pharmacist') {
      const outcome = revokePharmacistPrescriptionAccess(grant);
      if (!outcome.ok) return { ok: false, status: 404, data: { error: outcome.error } };
      Object.assign(grant, outcome.grant);
    } else {
      grant.status = 'REVOKED';
    }
    recordDemoAudit('CONSENT_REVOKED', patientId, `${DEMO_PATIENT_NAMES[patientId] || 'The patient'} revoked access for ${grant.doctorName}.`);
    return { ok: true, status: 200, data: { success: true, grant } };
  }

  if (method === 'POST' && /^\/api\/patient\/[^/]+\/consent\/[^/]+\/extend$/.test(pathname)) {
    const [, , , patientId, , grantId] = pathname.split('/');
    if (options.patientId !== patientId) return { ok: false, status: 403, data: { error: 'Only the patient who owns this consent can extend it.' } };
    const grant = MOCK_STATE.grants.find((item: any) => item.id === grantId && item.patientId === patientId);
    if (!grant || grant.status !== 'GRANTED' || !isActiveDemoGrant(grant)) return { ok: false, status: 409, data: { error: 'Only active consent can be extended. Request access again if it has ended.' } };
    const currentExpiry = Date.parse(grant.expiresAt);
    grant.expiresAt = new Date(Math.min(Date.now() + 168 * 3600000, currentExpiry + 24 * 3600000)).toISOString();
    grant.durationHours = Math.min(168, Number(grant.durationHours || 24) + 24);
    recordDemoAudit('CONSENT_EXTENDED', patientId, `${DEMO_PATIENT_NAMES[patientId] || 'The patient'} extended access for ${grant.doctorName} until ${new Date(grant.expiresAt).toLocaleString()}.`);
    return { ok: true, status: 200, data: { success: true, grant } };
  }

  // Local-only emergency record workflows. Linking requests remain pending
  // until the identified patient approves them in their own dashboard.
  if (pathname.startsWith('/api/emergency-records')) {
    const pathParts = pathname.split('/').filter(Boolean);
    const recordId = pathParts[2];
    const action = pathParts[3];
    const record = recordId ? MOCK_STATE.emergencyRecords.find((item: any) => item.id === recordId) : null;
    const tags = ['VERIFIED', 'PATIENT_REPORTED', 'DOCUMENT_EXTRACTED', 'UNKNOWN_UNVERIFIED'];
    if (method === 'GET' && !recordId) {
      const query = normalizePrescriptionText(searchParams.get('query')).toLowerCase();
      const status = (searchParams.get('status') || 'ALL').toUpperCase();
      const records = MOCK_STATE.emergencyRecords.filter((item: any) => {
        if (status !== 'ALL' && String(item.status || '').toUpperCase() !== status) return false;
        return !query || JSON.stringify(item).toLowerCase().includes(query);
      });
      return { ok: true, status: 200, data: { records } };
    }
    if (method === 'POST' && !recordId) {
      let body: any = {};
      try { body = JSON.parse(options.body as string); } catch {}
      const doctorId = options.doctorId || body.doctorId || 'doc-village';
      const provider = MOCK_STATE.providers.find((item: any) => item.id === doctorId);
      if (!provider) return { ok: false, status: 403, data: { error: 'Choose a listed demo clinician.' } };
      const record: any = {
        id: `ER-DEMO-${Date.now()}`, status: body.status || 'IDENTITY_UNKNOWN',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdByDoctorId: doctorId, createdByDoctorName: provider.name, facilityName: provider.facilityName,
        facilityLevel: provider.facilityLevel || 'VILLAGE', facilityType: 'Demo healthcare facility',
        dataSource: body.dataSource || 'CLINICIAN_OBSERVED', patientDetails: body.patientDetails || {},
        emergencyObservations: body.emergencyObservations || { text: '', tag: 'UNKNOWN_UNVERIFIED' },
        allergies: body.allergies || { text: '', tag: 'UNKNOWN_UNVERIFIED' },
        medicines: body.medicines || { text: '', tag: 'UNKNOWN_UNVERIFIED' },
        medicalHistory: body.medicalHistory || { text: '', tag: 'UNKNOWN_UNVERIFIED' },
        treatmentProvided: body.treatmentProvided || { text: '', tag: 'UNKNOWN_UNVERIFIED' },
        documents: [], corrections: [], auditTrail: [], linkingWorkflow: null,
      };
      if (!record.patientDetails.apparentName?.text && !record.emergencyObservations?.text) return { ok: false, status: 400, data: { error: 'Add an identifying description or an emergency observation.' } };
      record.auditTrail.push({ id: `aud-${Date.now()}`, timestamp: record.createdAt, action: 'RECORD_CREATED', actorId: doctorId, actorName: provider.name, actorRole: 'doctor', facilityName: provider.facilityName, details: 'Fictional local emergency record created.' });
      MOCK_STATE.emergencyRecords.unshift(record);
      recordDemoAudit('EMERGENCY_RECORD_CREATED', '', `${provider.name} created local demo emergency record ${record.id}.`);
      return { ok: true, status: 201, data: { record } };
    }
    if (!record) return { ok: false, status: 404, data: { error: 'Emergency record not found.' } };

    if (method === 'PUT' && !action) {
      let body: any = {};
      try { body = JSON.parse(options.body as string); } catch {}
      const doctorId = options.doctorId || body.doctorId;
      if (doctorId !== record.createdByDoctorId) return { ok: false, status: 403, data: { error: 'Only the demo clinician who created this record can edit it.' } };
      if (!body.patientDetails?.apparentName?.text && !body.emergencyObservations?.text) return { ok: false, status: 400, data: { error: 'Keep an identifying description or emergency observation.' } };
      Object.assign(record, {
        status: body.status || record.status, dataSource: body.dataSource || record.dataSource,
        patientDetails: body.patientDetails || record.patientDetails,
        emergencyObservations: body.emergencyObservations || record.emergencyObservations,
        allergies: body.allergies || record.allergies, medicines: body.medicines || record.medicines,
        medicalHistory: body.medicalHistory || record.medicalHistory, treatmentProvided: body.treatmentProvided || record.treatmentProvided,
        updatedAt: new Date().toISOString(),
      });
      record.auditTrail.unshift({ id: `aud-${Date.now()}`, timestamp: record.updatedAt, action: 'RECORD_UPDATED', actorId: doctorId, actorName: record.createdByDoctorName, actorRole: 'doctor', facilityName: record.facilityName, details: 'Emergency details updated in the local demo.' });
      recordDemoAudit('EMERGENCY_RECORD_UPDATED', record.linkingWorkflow?.targetPatientId || '', `${record.createdByDoctorName} updated demo emergency record ${record.id}.`);
      return { ok: true, status: 200, data: { record } };
    }

    let body: any = {};
    try { body = JSON.parse(options.body as string); } catch {}
    if (method === 'POST' && action === 'documents') {
      if (!String(body.title || '').trim() || !tags.includes(body.tag)) return { ok: false, status: 400, data: { error: 'Enter a document title and a valid source label.' } };
      const provider = MOCK_STATE.providers.find((item: any) => item.id === (options.doctorId || body.doctorId));
      record.documents.unshift({ id: `doc-${Date.now()}`, title: String(body.title).trim(), mimeType: 'image/svg+xml', dataUrl: body.fileDataUrl || '', summaryText: String(body.summaryText || '').trim(), tag: body.tag, uploadedAt: new Date().toISOString(), uploadedByDoctorId: provider?.id || '', uploadedByDoctorName: provider?.name || 'Demo clinician', facilityName: provider?.facilityName || '' });
      record.updatedAt = new Date().toISOString();
      return { ok: true, status: 201, data: { record } };
    }
    if (method === 'POST' && action === 'corrections') {
      const note = String(body.note || '').trim();
      if (!note || note.length > 1000) return { ok: false, status: 400, data: { error: 'Enter a correction note up to 1,000 characters.' } };
      record.corrections.unshift({ id: `cor-${Date.now()}`, timestamp: new Date().toISOString(), note, actorId: options.doctorId || body.doctorId || 'unknown-demo-user' });
      record.updatedAt = new Date().toISOString();
      return { ok: true, status: 201, data: { record } };
    }
    if (method === 'POST' && action === 'link-initiate') {
      const byHealthPassId: Record<string, { id: string; name: string }> = {
        'HP-DEMO-0417': { id: 'pat-1', name: 'Demo Patient (Ananya Rao)' },
        'HP-CHILD-0892': { id: 'pat-2', name: 'Aarav Kumar (Child Profile)' },
        'HP-ELDER-0931': { id: 'pat-3', name: 'Lakshmi Narayana (Elderly Care)' },
      };
      const healthPassId = normalizePrescriptionText(body.targetHealthPassId).toUpperCase();
      const target = byHealthPassId[healthPassId];
      if (!target) return { ok: false, status: 404, data: { error: 'No fictional demo patient matches that HealthPass ID.' } };
      if (!body.identityVerified) return { ok: false, status: 400, data: { error: 'Record an identity check before submitting a linking request.' } };
      if (!body.authorizationBasis || !body.consentOrAuthReference?.trim()) return { ok: false, status: 400, data: { error: 'Document the authorization basis and its reference.' } };
      if (body.authorizationBasis === 'AUTHORIZED_REPRESENTATIVE' && (!body.authorizedRepresentativeName?.trim() || !body.authorizedRepresentativeRelation?.trim())) return { ok: false, status: 400, data: { error: 'Enter the authorized representative name and relationship.' } };
      const provider = MOCK_STATE.providers.find((item: any) => item.id === (options.doctorId || body.doctorId));
      if (!provider) return { ok: false, status: 403, data: { error: 'Choose a listed demo clinician.' } };
      const now = new Date().toISOString();
      record.linkingWorkflow = {
        targetPatientId: target.id, targetHealthPassId: healthPassId, targetPatientName: target.name,
        initiatedByDoctorId: provider.id, initiatedByDoctorName: provider.name, initiatedFacilityName: provider.facilityName,
        initiatedAt: now, identityVerified: true, identityVerificationMethod: body.identityVerificationMethod,
        identityVerificationNotes: String(body.identityVerificationNotes || '').trim(), authorizationBasis: body.authorizationBasis,
        authorizedRepresentativeName: body.authorizedRepresentativeName || '', authorizedRepresentativeRelation: body.authorizedRepresentativeRelation || '',
        consentOrAuthReference: String(body.consentOrAuthReference).trim(), detectedConflicts: [],
        conflictResolutionMode: body.conflictResolutionMode || 'KEEP_SEPARATE_PROVENANCE',
        decisionStatus: body.authorizationBasis === 'PATIENT_APP_CONSENT' ? 'PENDING_PATIENT_APPROVAL' : 'PENDING_PATIENT_APPROVAL',
      };
      record.status = 'AWAITING_CONSENT';
      record.updatedAt = now;
      record.auditTrail.unshift({ id: `aud-${Date.now()}`, timestamp: now, action: 'LINK_REQUESTED', actorId: provider.id, actorName: provider.name, actorRole: 'doctor', facilityName: provider.facilityName, details: `Patient consent requested for ${healthPassId}.` });
      recordDemoAudit('EMERGENCY_LINK_REQUESTED', target.id, `${provider.name} requested patient approval to link emergency record ${record.id}.`);
      return { ok: true, status: 200, data: { record } };
    }
    if (method === 'POST' && action === 'link-complete') {
      const workflow = record.linkingWorkflow;
      if (!workflow?.identityVerified || workflow.decisionStatus !== 'PENDING_PATIENT_APPROVAL') return { ok: false, status: 409, data: { error: 'There is no pending emergency-link consent to approve.' } };
      if (body.actorRole === 'patient') {
        if (body.patientId !== workflow.targetPatientId) return { ok: false, status: 403, data: { error: 'Only the identified patient can approve this link request.' } };
      } else {
        const doctorId = options.doctorId || body.doctorId;
        if (doctorId !== workflow.initiatedByDoctorId || workflow.authorizationBasis === 'PATIENT_APP_CONSENT') return { ok: false, status: 403, data: { error: 'Patient app consent is still required. The clinician cannot approve on the patient’s behalf.' } };
      }
      const now = new Date().toISOString();
      workflow.decisionStatus = 'APPROVED_AND_LINKED'; workflow.decidedAt = now; workflow.decidedBy = body.actorRole === 'patient' ? workflow.targetPatientId : workflow.initiatedByDoctorId;
      record.status = 'LINKED'; record.updatedAt = now;
      record.auditTrail.unshift({ id: `aud-${Date.now()}`, timestamp: now, action: 'LINK_APPROVED', actorId: workflow.decidedBy, actorName: body.actorRole === 'patient' ? workflow.targetPatientName : workflow.initiatedByDoctorName, actorRole: body.actorRole || 'doctor', facilityName: record.facilityName, details: 'Emergency record linked with original provenance preserved.' });
      recordDemoAudit('EMERGENCY_LINK_APPROVED', workflow.targetPatientId, `${workflow.targetPatientName} approved emergency record ${record.id}; its source details remain separate.`);
      return { ok: true, status: 200, data: { record, securityNotice: 'Local demo link only; source provenance was retained.' } };
    }
    if (method === 'POST' && action === 'link-reject') {
      const workflow = record.linkingWorkflow;
      if (!workflow || workflow.decisionStatus !== 'PENDING_PATIENT_APPROVAL') return { ok: false, status: 409, data: { error: 'There is no pending emergency-link request to reject.' } };
      if (body.actorRole === 'patient' && body.patientId !== workflow.targetPatientId) return { ok: false, status: 403, data: { error: 'Only the identified patient can reject this link request.' } };
      if (body.actorRole !== 'patient' && (options.doctorId || body.doctorId) !== workflow.initiatedByDoctorId) return { ok: false, status: 403, data: { error: 'Only the requesting demo clinician can reject this request.' } };
      workflow.decisionStatus = 'REJECTED'; workflow.decidedAt = new Date().toISOString(); workflow.decidedBy = body.patientId || options.doctorId || body.doctorId;
      workflow.rejectionOrUnlinkReason = String(body.reason || 'Rejected').slice(0, 500); record.status = 'LINKING_REJECTED'; record.updatedAt = workflow.decidedAt;
      record.auditTrail.unshift({ id: `aud-${Date.now()}`, timestamp: workflow.decidedAt, action: 'LINK_REJECTED', actorId: workflow.decidedBy, actorName: body.actorRole === 'patient' ? workflow.targetPatientName : workflow.initiatedByDoctorName, actorRole: body.actorRole || 'doctor', facilityName: record.facilityName, details: workflow.rejectionOrUnlinkReason });
      recordDemoAudit('EMERGENCY_LINK_REJECTED', workflow.targetPatientId, `Emergency record ${record.id} link request was rejected; patient records remain unchanged.`);
      return { ok: true, status: 200, data: { record } };
    }
    if (method === 'POST' && action === 'unlink') {
      const reason = String(body.reason || '').trim();
      if (record.status !== 'LINKED' || !record.linkingWorkflow || !reason) return { ok: false, status: 400, data: { error: 'A linked emergency record and an unlink reason are required.' } };
      if ((options.doctorId || body.doctorId) !== record.linkingWorkflow.initiatedByDoctorId) return { ok: false, status: 403, data: { error: 'Only the requesting demo clinician can unlink this record.' } };
      const now = new Date().toISOString(); record.linkingWorkflow.decisionStatus = 'UNLINKED'; record.linkingWorkflow.decidedAt = now; record.linkingWorkflow.rejectionOrUnlinkReason = reason.slice(0, 500); record.status = 'READY_FOR_LINKING'; record.updatedAt = now;
      record.auditTrail.unshift({ id: `aud-${Date.now()}`, timestamp: now, action: 'LINK_REMOVED', actorId: record.linkingWorkflow.initiatedByDoctorId, actorName: record.linkingWorkflow.initiatedByDoctorName, actorRole: 'doctor', facilityName: record.facilityName, details: reason.slice(0, 500) });
      recordDemoAudit('EMERGENCY_LINK_REMOVED', record.linkingWorkflow.targetPatientId, `Emergency record ${record.id} was unlinked. Reason: ${reason.slice(0, 500)}`);
      return { ok: true, status: 200, data: { record } };
    }
    return { ok: false, status: 405, data: { error: 'This emergency record action is not supported.' } };
  }

  // Fail visibly instead of returning false success for an unimplemented action.
  return {
    ok: false,
    status: 404,
    data: { error: 'This action is not available in the local demo.' } as any,
  };
}

function handleMockApiRequest(endpoint: string, options: ApiRequestOptions): ApiResult {
  loadDemoStore();
  const auditCountBefore = MOCK_STATE.auditLogs.length;
  const result = handleMockApiRequestInternal(endpoint, options);
  const method = (options.method || 'GET').toUpperCase();
  const skipsLocalWrite = endpoint.includes('/api/demo/reset') || endpoint.includes('/api/auth/login') || endpoint.endsWith('/explanation');
  const hasNewAudit = MOCK_STATE.auditLogs.length > auditCountBefore;
  if ((method !== 'GET' || hasNewAudit) && result.ok && !skipsLocalWrite) {
    if (!persistDemoStore()) {
      return {
        ok: false,
        status: 507,
        data: { ...result.data, error: 'This demo change is active in this tab, but browser storage could not save it. Free space or reset demo data before continuing.' },
      };
    }
    demoStorageStatus = 'loaded';
  }
  return result;
}

// ----------------------------------------------------------------------------
// MAIN API REQUEST FUNCTION
// ----------------------------------------------------------------------------
export async function handleBackendApiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<ApiResult<T>> {
  try {
    const headers: Record<string, string> = {
      ...((options.headers as any) || {}),
    };
    if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(endpoint, {
      ...options,
      headers,
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 403 && data.code) {
        const consentError = map403ToConsentScreen(data.code, data.error || data.message);
        if (!options.suppressGlobal403 && global403Handler) {
          global403Handler(consentError, { doctorId: options.doctorId, patientId: options.patientId, endpoint });
        }
        return { ok: false, status: res.status, data, consentError };
      }
      return { ok: false, status: res.status, data };
    }
    return { ok: true, status: res.status, data };
  } catch (error: any) {
    return {
      ok: false,
      status: 0,
      data: { error: error?.message || 'Network error connecting to HealthPass backend.' } as any,
    };
  }
}

let activeBackend: 'demo' | 'supabase' | 'api' = 'api';

export function setHealthPassBackend(backend: 'demo' | 'supabase' | 'api') {
  activeBackend = backend;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<ApiResult<T>> {
  return await routeApiRequest(activeBackend, endpoint, options, {
    api: async (path: string, requestOptions: ApiRequestOptions) => handleBackendApiRequest<T>(path, requestOptions),
    supabase: async (path: string, requestOptions: ApiRequestOptions) => {
      const { handleSupabaseApiRequest } = await import('./services/supabaseApi.ts');
      return handleSupabaseApiRequest(path, requestOptions);
    },
    demo: (path: string, requestOptions: ApiRequestOptions) => handleMockApiRequest(path, requestOptions),
  }) as ApiResult<T>;
}
