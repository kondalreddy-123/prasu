import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Brain,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  Columns,
  Download,
  Droplets,
  ExternalLink,
  FileText,
  FlaskConical,
  Globe,
  HeartPulse,
  Home,
  Hospital,
  Info,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  MoreHorizontal,
  MessageSquare,
  Pill,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stethoscope,
  Syringe,
  Unlock,
  Upload,
  UserCheck,
  Users,
  Wind,
  X,
} from 'lucide-react';
import consentShieldImg from './assets/images/consent_shield_3d.svg';
import {
  LANG_META,
  SupportedLang,
  TRANSLATIONS,
  tr,
  translateUiPhrase,
  PRIMARY_UI_LANGUAGES,
  applyDocumentLanguagePreferences,
  translateMedicalCategory,
} from './i18n/translations.ts';
import {
  AccessTimer,
  AllergyBanner,
  FacilityBadge,
  FacilityLevel,
  FacilityType,
  LabReportExplanationPanel,
  LockAnimation,
  PWAInstallButton,
  PatientBanner,
  PrescriptionDetailModal,
  RxSlipCard,
  SpeechButton,
  VoiceSearchInput,
  StatusChip,
  WalletCard,
} from './components/SharedUI.tsx';
import { AddConsultationModal } from './components/AddConsultationModal.tsx';
import { MedicalDocumentOcrModal } from './components/MedicalDocumentOcrModal.tsx';
import { ReportReadAloudControls } from './components/ReportReadAloudControls.tsx';
import { HowItWorksWalkthrough } from './components/HowItWorksWalkthrough.tsx';
import {
  EmergencyRecordsWorkspace,
  PatientEmergencyLinksPanel,
} from './components/EmergencyRecordsWorkspace.tsx';
import {
  apiRequest,
  setHealthPassBackend,
  ConsentErrorState,
  map403ToConsentScreen,
  registerGlobal403Handler,
} from './api.ts';
import { isSupabaseConfigured } from './services/supabaseClient.ts';
import { restoreSupabaseUser, signInSupabase, signOutSupabase, signUpSupabasePatient } from './services/supabaseAuth.ts';
import {
  getMedicalRecordCategory,
  isMedicalCategoryAuthorized,
  MEDICAL_RECORD_CATEGORIES,
} from './medicalRecordCategories.ts';
import { buildMedicalRecordCompleteness } from './services/medicalRecordCompleteness.ts';
import { formatReportExplanation, getReportExplanationSections, REPORT_EXPLANATION_SAFETY_NOTICE, validateReportExplanation } from './services/reportExplanation.js';
import { createPersonalHealthReportPdf } from './services/personalHealthReportPdf.ts';
import {
  buildOfflineMedicalSummary,
  clearEncryptedOfflineSummary,
  loadEncryptedOfflineSummary,
  replaceEncryptedOfflineSummary,
  saveEncryptedOfflineSummary,
  shouldReplaceOfflineSummary,
  OfflineSummaryKey,
} from './services/offlineMedicalSummary.ts';

type WorkspaceMode =
  | 'LANDING'
  | 'HOW_IT_WORKS'
  | 'PATIENT'
  | 'DOCTOR'
  | 'EMERGENCY'
  | 'SPLIT_DEMO'
  | 'PHARMACY'
  | 'LAB'
  | 'ADMIN';

type ProviderNavGroup = 'WORKSPACE' | 'EMERGENCY' | 'ACTIVITY';

type PatientTab = 'HEALTH' | 'MEDICINES' | 'QR' | 'REPORTS' | 'CONSENT' | 'PRIVACY';

const ALL_CATEGORIES = [...MEDICAL_RECORD_CATEGORIES];
const MEDICAL_CATEGORY_ICON: Record<string, React.ElementType> = {
  'Cardiac Care': HeartPulse,
  'Diabetes & Metabolic Health': Activity,
  'Respiratory Health': Wind,
  'Neurological Health': Brain,
  'Kidney Health': Droplets,
  Allergies: AlertTriangle,
  'Medications & Prescriptions': Pill,
  'Laboratory Reports': FlaskConical,
  'Surgeries & Procedures': Stethoscope,
  Vaccinations: Syringe,
  'Consultation History': Users,
  'General Medical History': FileText,
  'Other Medical Records': FileText,
};

export const DOCTOR_DIRECTORY = [
  {
    id: 'doc-village',
    name: 'Dr. Anil Kumar',
    email: 'village.doctor@demo.com',
    facilityName: 'Village Health Centre, Kothapalli',
    facilityLevel: 'VILLAGE' as FacilityLevel,
    facilityType: 'Village Health Centre' as FacilityType,
    badgeColor: 'bg-[#ECFDF5] text-[#1E8E5A] border-[#A7F3D0]',
  },
  {
    id: 'doc-mandal',
    name: 'Dr. Rahul Sharma',
    email: 'doctor@demo.com',
    facilityName: 'Mandal Health Centre, Nandigama',
    facilityLevel: 'MANDAL' as FacilityLevel,
    facilityType: 'Mandal Health Centre' as FacilityType,
    badgeColor: 'bg-[#EFF6FF] text-[#1769AA] border-[#BFDBFE]',
  },
  {
    id: 'doc-district',
    name: 'Dr. Meera Reddy',
    email: 'district.doctor@demo.com',
    facilityName: 'District Hospital, Vijayawada',
    facilityLevel: 'DISTRICT' as FacilityLevel,
    facilityType: 'District Hospital' as FacilityType,
    badgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
  },
];

export const DEMO_PATIENTS = [
  {
    id: 'pat-1',
    name: 'Demo Patient (Ananya Rao)',
    email: 'patient@demo.com',
    healthPassId: 'HP-DEMO-0417',
    abhaNumber: '91-4820-7391-0417',
    summary: '42 yrs · Sulfa Allergy · 3-Level History',
  },
  {
    id: 'pat-2',
    name: 'Aarav Kumar (Child Profile)',
    email: 'child@demo.com',
    healthPassId: 'HP-CHILD-0892',
    abhaNumber: '91-6192-8410-0892',
    summary: '7 yrs · Guardian Managed Demo Profile',
  },
  {
    id: 'pat-3',
    name: 'Lakshmi Narayana (Elderly Care)',
    email: 'elder@demo.com',
    healthPassId: 'HP-ELDER-0931',
    abhaNumber: '91-7731-9024-0931',
    summary: '68 yrs · Demo Profile',
  },
];

export default function App() {
  const [mode, setMode] = useState<WorkspaceMode>('LANDING');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [registrationName, setRegistrationName] = useState('');
  const [demoStorageWarning, setDemoStorageWarning] = useState('');
  const [providerNavGroup, setProviderNavGroup] = useState<ProviderNavGroup>('WORKSPACE');
  const [lang, setLang] = useState<SupportedLang>(() => {
    try {
      const saved = localStorage.getItem('healthpass_lang');
      if (saved && PRIMARY_UI_LANGUAGES.includes(saved as SupportedLang)) {
        return saved as SupportedLang;
      }
    } catch {
      // Ignore localStorage error
    }
    return 'EN';
  });

  useEffect(() => {
    try {
      localStorage.setItem('healthpass_lang', lang);
    } catch {
      // Ignore localStorage error
    }
    applyDocumentLanguagePreferences(lang);
  }, [lang]);

  useEffect(() => {
    let cancelled = false;
    void apiRequest('/api/demo/status').then((result) => {
      if (cancelled) return;
      const status = result.data?.storageStatus;
      if (!result.data?.persistent) {
        setDemoStorageWarning(status === 'corrupt' || status === 'invalid'
          ? 'Saved demo data could not be read. The app is using built-in examples; use Reset demo data after signing in to start a fresh saved demo.'
          : 'Browser storage is unavailable. Demo changes may not survive a refresh.');
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    void restoreSupabaseUser().then((user) => {
      if (cancelled || !user) return;
      setHealthPassBackend('supabase');
      setLoggedInUser(user);
      setWalletData(null); setDoctorRecord(null); setPharmacyData(null);
      if (user.role === 'patient') { setActivePatientId(user.id); setMode('PATIENT'); }
      else if (user.role === 'doctor') { setActiveDoctorId(user.id); setMode('DOCTOR'); }
      else if (user.role === 'pharmacy') setMode('PHARMACY');
      else if (user.role === 'lab') setMode('LAB');
    }).catch((error) => {
      if (!cancelled) showToast(error?.message || 'Saved HealthPass sign-in could not be restored.');
    });
    return () => { cancelled = true; };
  }, []);

  const [fontScale, setFontScale] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const [highContrast, setHighContrast] = useState(false);
  const [helperMode, setHelperMode] = useState(false);
  const [showMoreRolesDropdown, setShowMoreRolesDropdown] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Active Patient & Doctor selection
  const [activePatientId, setActivePatientId] = useState<string>('pat-1');
  const [activeDoctorId, setActiveDoctorId] = useState<string>('doc-village');
  const [doctorList, setDoctorList] = useState(DOCTOR_DIRECTORY);
  const [patientTab, setPatientTab] = useState<PatientTab>('HEALTH');
  useEffect(() => () => reportAiAbortRef.current?.abort(), [mode, patientTab]);
  const [selectedMedicalRecordCategory, setSelectedMedicalRecordCategory] = useState<string | null>(null);
  const [selectedDoctorRecordCategory, setSelectedDoctorRecordCategory] = useState<string | null>(null);
  const [medicalRecordSearch, setMedicalRecordSearch] = useState('');
  const [medicalRecordDateFrom, setMedicalRecordDateFrom] = useState('');
  const [medicalRecordDateTo, setMedicalRecordDateTo] = useState('');
  const [patientProfileDraft, setPatientProfileDraft] = useState<any>(null);
  const [patientProfileEditing, setPatientProfileEditing] = useState(false);
  const [patientProfileSaving, setPatientProfileSaving] = useState(false);
  const [patientProfileMessage, setPatientProfileMessage] = useState('');
  const [reportSummaries, setReportSummaries] = useState<Record<string, any>>({});
  const [summaryLoadingId, setSummaryLoadingId] = useState<string | null>(null);
  const [summaryErrors, setSummaryErrors] = useState<Record<string, string>>({});
  const [reportExplanationLanguage, setReportExplanationLanguage] = useState<'en' | 'te' | 'hi'>(() => {
    try {
      const saved = localStorage.getItem('healthpass_report_explanation_language');
      return saved === 'te' || saved === 'hi' ? saved : 'en';
    } catch { return 'en'; }
  });
  const [externalAiConsent, setExternalAiConsent] = useState<Record<string, boolean>>({});
  const [reportAiExplanations, setReportAiExplanations] = useState<Record<string, any>>({});
  const [copiedExplanationId, setCopiedExplanationId] = useState<string | null>(null);
  const reportAiAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try { localStorage.setItem('healthpass_report_explanation_language', reportExplanationLanguage); } catch { /* preference storage is optional */ }
  }, [reportExplanationLanguage]);

  useEffect(() => () => reportAiAbortRef.current?.abort(), []);


  const requestReportSummary = async (reportId: string) => {
    setSummaryLoadingId(reportId);
    setSummaryErrors((current) => ({ ...current, [reportId]: '' }));
    try {
      const result = await apiRequest(`/api/patient/${activePatientId}/reports/${reportId}/summary`, { method: 'POST', patientId: activePatientId });
      if (!result.ok) throw new Error(result.data?.error || result.data?.message || 'Unable to access this report.');
      setReportSummaries((current) => ({ ...current, [reportId]: result.data.summary }));
    } catch (error: any) {
      setSummaryErrors((current) => ({ ...current, [reportId]: error.message || 'Summary could not be generated.' }));
    } finally {
      setSummaryLoadingId(null);
    }
  };

  const requestReportAiExplanation = async (reportId: string) => {
    if (reportAiAbortRef.current) return;
    setSummaryErrors((current) => ({ ...current, [reportId]: '' }));
    if (loggedInUser?.role !== 'patient' || loggedInUser.id !== activePatientId) {
      setSummaryErrors((current) => ({ ...current, [reportId]: 'Sign in as the patient who owns this report before requesting an explanation.' }));
      return;
    }
    if (!externalAiConsent[reportId]) {
      setSummaryErrors((current) => ({ ...current, [reportId]: 'Please consent before sending de-identified report text to the configured AI service.' }));
      return;
    }
    if (loggedInUser?.backend === 'supabase') {
      setSummaryErrors((current) => ({ ...current, [reportId]: 'AI explanations are not enabled for signed-in cloud accounts. This local demo service cannot verify cloud report permissions.' }));
      return;
    }
    setSummaryLoadingId(reportId);
    const controller = new AbortController();
    reportAiAbortRef.current?.abort();
    reportAiAbortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 38000);
    try {
      const authorized = await apiRequest(`/api/patient/${activePatientId}/reports/${reportId}/explanation`, {
        method: 'POST', patientId: activePatientId,
        body: JSON.stringify({ language: reportExplanationLanguage, externalAiConsent: true }),
      });
      if (!authorized.ok) throw new Error(authorized.data?.error || authorized.data?.message || 'This report is not available for explanation.');

      const sessionResponse = await fetch('/api/report-explanations/session', { cache: 'no-store', signal: controller.signal });
      const session = await sessionResponse.json().catch(() => ({}));
      if (!sessionResponse.ok || !session.token) throw new Error(session.error || 'The local AI service is unavailable. Start it in a second terminal; the original report was not sent.');
      if (!session.configured) throw new Error('AI is not configured. Your report was not sent. Configure the server-side OPENAI_API_KEY and restart the local AI service.');
      const response = await fetch('/api/report-explanations', {
        method: 'POST', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'X-HealthPass-AI-Session': session.token },
        body: JSON.stringify({ reportText: authorized.data.sourceText, language: reportExplanationLanguage, externalAiConsent: true }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'The AI explanation could not be generated. The original report is unchanged.');
      if (!validateReportExplanation(result.explanation, reportExplanationLanguage, authorized.data.sourceText)) throw new Error('The AI returned an incomplete explanation or a value not found in the report. You can retry.');
      setReportAiExplanations((current) => ({ ...current, [`${reportId}:${reportExplanationLanguage}`]: result.explanation }));
    } catch (error: any) {
      const message = error?.name === 'AbortError' ? 'The explanation request timed out or was cancelled. Your original report is unchanged.' : error.message || 'AI explanation is unavailable. The original report was not sent.';
      setSummaryErrors((current) => ({ ...current, [reportId]: message }));
    } finally {
      window.clearTimeout(timeout);
      if (reportAiAbortRef.current === controller) reportAiAbortRef.current = null;
      setSummaryLoadingId(null);
    }
  };

  const copyReportAiExplanation = async (reportId: string, explanation: any) => {
    try {
      await navigator.clipboard.writeText(formatReportExplanation(explanation));
      setCopiedExplanationId(reportId);
      window.setTimeout(() => setCopiedExplanationId((current) => current === reportId ? null : current), 1800);
    } catch {
      setSummaryErrors((current) => ({ ...current, [reportId]: 'Copy is unavailable in this browser. Select the explanation text and copy it manually.' }));
    }
  };

  const savePatientHealthProfile = async () => {
    setPatientProfileSaving(true);
    setPatientProfileMessage('');
    try {
      const result = await apiRequest(`/api/patient/${activePatientId}/health-profile`, {
        method: 'PUT', patientId: activePatientId, body: JSON.stringify(patientProfileDraft || {}),
      });
      if (!result.ok) throw new Error(result.data?.error || 'Profile could not be saved.');
      setPatientProfileDraft(result.data.profile);
      setWalletData((current: any) => current ? { ...current, patientHealthProfile: result.data.profile } : current);
      setPatientProfileEditing(false);
      setPatientProfileMessage('Profile saved. Patient-provided information is marked unverified.');
    } catch (error: any) {
      setPatientProfileMessage(error.message || 'Profile could not be saved.');
    } finally { setPatientProfileSaving(false); }
  };

  // Login Modal State
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('patient@demo.com');
  const [loginPassword, setLoginPassword] = useState('Demo@123');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<{
    id: string;
    name: string;
    email: string;
    role: string;
    facilityName?: string;
    facilityLevel?: string;
    healthPassId?: string;
    backend?: 'demo' | 'supabase';
  } | null>(null);

  useEffect(() => {
    setExternalAiConsent({});
    setReportAiExplanations({});
    setSummaryErrors({});
  }, [activePatientId, loggedInUser?.id]);

  // Patient Wallet State
  const [walletData, setWalletData] = useState<any | null>(null);
  const [_loadingWallet, setLoadingWallet] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [offlineSummary, setOfflineSummary] = useState<any | null>(null);
  const [offlinePassphrase, setOfflinePassphrase] = useState('');
  const [offlineMessage, setOfflineMessage] = useState('');
  const [offlineBusy, setOfflineBusy] = useState(false);
  const offlineKeyRef = useRef<OfflineSummaryKey | null>(null);

  // Consent Decision State on Patient Screen
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'General Medical History',
    'Medications & Prescriptions',
  ]);
  const [selectedDuration, setSelectedDuration] = useState<number>(24);
  const [useFastExpirySeconds, setUseFastExpirySeconds] = useState<number | null>(null);

  // Doctor Request Access Form State
  const [requestPurpose, setRequestPurpose] = useState(
    'Outpatient point-of-care consultation & medication safety review'
  );
  const [requestCategories, setRequestCategories] = useState<string[]>([...ALL_CATEGORIES]);
  const [requestDurationHours, setRequestDurationHours] = useState<number>(24);

  // Doctor Point-of-Care State
  const [doctorLookupQuery, setDoctorLookupQuery] = useState('HP-DEMO-0417');
  const [preConsentIdentity, setPreConsentIdentity] = useState<{
    patientId: string;
    name: string;
    healthPassId: string;
    gatewayLabel?: string;
  } | null>({
    patientId: 'pat-1',
    name: 'Demo Patient (Ananya Rao)',
    healthPassId: 'HP-DEMO-0417',
    gatewayLabel: 'HealthPass Verified Token Lookup',
  });
  const [doctorRecord, setDoctorRecord] = useState<any | null>(null);
  const [doctorConsentError, setDoctorConsentError] = useState<ConsentErrorState | null>(null);
  const [authorizedGrantsForDoctor, setAuthorizedGrantsForDoctor] = useState<any[]>([]);
  const [recordOpenSeconds, setRecordOpenSeconds] = useState<number | null>(0.4);
  const [simulatedOtpCode, setSimulatedOtpCode] = useState<string>('482910');
  const [otpInput, setOtpInput] = useState('');
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [showConsultationModal, setShowConsultationModal] = useState(false);
  const [showDoctorReportOcrModal, setShowDoctorReportOcrModal] = useState(false);
  const [prefillConsultMed, setPrefillConsultMed] = useState<any | null>(null);

  // Doctor Upload Report Modal State
  const [showDoctorReportModal, setShowDoctorReportModal] = useState(false);
  const [docReportTitle, setDocReportTitle] = useState('');
  const [docReportCategory, setDocReportCategory] = useState('Lab reports');
  const [docReportSummary, setDocReportSummary] = useState('');

  // AI Explain My Medical History State
  const [aiExplanation, setAiExplanation] = useState<any | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [allowExternalAi, setAllowExternalAi] = useState(false);

  // Self-reported medicine form state
  const [showSelfMedForm, setShowSelfMedForm] = useState(false);
  const [selfMedName, setSelfMedName] = useState('');
  const [selfMedStrength, setSelfMedStrength] = useState('500 mg');
  const [selfMedError, setSelfMedError] = useState('');
  const [selfMedSaving, setSelfMedSaving] = useState(false);
  const [existingMedicineId, setExistingMedicineId] = useState('');
  const [prescriptionSearch, setPrescriptionSearch] = useState('');
  const [prescriptionDateFrom, setPrescriptionDateFrom] = useState('');
  const [prescriptionDateTo, setPrescriptionDateTo] = useState('');
  const [prescriptionPeriodFilter, setPrescriptionPeriodFilter] = useState('ALL');
  const [prescriptionCategoryFilter, setPrescriptionCategoryFilter] = useState('ALL');
  const [prescriptionEditId, setPrescriptionEditId] = useState<string | null>(null);
  const [prescriptionMetadataDraft, setPrescriptionMetadataDraft] = useState<any>({});
  const [prescriptionSaveError, setPrescriptionSaveError] = useState('');
  const [healthReportCategories, setHealthReportCategories] = useState<string[]>([]);
  const [healthReportFromDate, setHealthReportFromDate] = useState('');
  const [healthReportToDate, setHealthReportToDate] = useState('');
  const [healthReportPreview, setHealthReportPreview] = useState<any[] | null>(null);
  const [healthReportBusy, setHealthReportBusy] = useState(false);
  const [healthReportError, setHealthReportError] = useState('');

  // Upload report form state (Patient & OCR Modal)
  const [showUploadReportForm, setShowUploadReportForm] = useState(false);
  const [showPatientOcrModal, setShowPatientOcrModal] = useState(false);
  const [prescriptionUploadMode, setPrescriptionUploadMode] = useState(false);
  const [newReportTitle, setNewReportTitle] = useState('');
  const [newReportCategory, setNewReportCategory] = useState('Lab reports');
  const [newReportSummary, setNewReportSummary] = useState('');

  // Prescription Detail Modal & Lab Explanation Expansion State
  const [selectedPrescription, setSelectedPrescription] = useState<any | null>(null);
  const [expandedLabReportIds, setExpandedLabReportIds] = useState<Record<string, boolean>>({
    'rep-1': true,
    'rep-2': true,
  });

  // Clinic Self-Registration Modal
  const [showClinicRegModal, setShowClinicRegModal] = useState(false);
  const [regClinicName, setRegClinicName] = useState('');
  const [regDoctorName, setRegDoctorName] = useState('');
  const [regFacilityLevel, setRegFacilityLevel] = useState<FacilityLevel>('VILLAGE');
  const [regFacilityType, setRegFacilityType] = useState<FacilityType>('Village Health Centre');
  const [regLicense, setRegLicense] = useState('');
  const [regPin, setRegPin] = useState('2026');

  // Pharmacy, Lab, Admin Data
  const [pharmacyData, setPharmacyData] = useState<any | null>(null);
  const [pharmacySearchId, setPharmacySearchId] = useState('HP-DEMO-0417');
  const [pharmacyLookupQuery, setPharmacyLookupQuery] = useState('HP-DEMO-0417');
  const [labHealthPassId, setLabHealthPassId] = useState('');
  const [labPatientIdentity, setLabPatientIdentity] = useState<any | null>(null);
  const [labAccessStatus, setLabAccessStatus] = useState('NONE');
  const [labLookupBusy, setLabLookupBusy] = useState(false);
  const [labSaveBusy, setLabSaveBusy] = useState(false);
  const [labTestName, setLabTestName] = useState('HbA1c & Fasting Lipid Panel');
  const [labResultSummary, setLabResultSummary] = useState('HbA1c: 5.7% (Normal) · LDL: 94 mg/dL');
  const [labReportDate, setLabReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [adminData, setAdminData] = useState<any | null>(null);

  // Toast / Status Banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [_sseConnected, setSseConnected] = useState(false);
  const scanStartRef = useRef<number>(Date.now());

  const t = TRANSLATIONS[lang] || TRANSLATIONS.EN;
  const ui = (phrase: string) => translateUiPhrase(phrase, lang);
  const currentDoctorObj =
    doctorList.find((d) => d.id === activeDoctorId) || doctorList[0];

  const showToast = useCallback((msg: string) => {
    setToastMessage(translateUiPhrase(msg, lang));
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  }, [lang]);

  const handleLogout = useCallback(async () => {
    const patientId = loggedInUser?.role === 'patient' ? loggedInUser.id : null;
    let cacheClearFailed = false;
    offlineKeyRef.current = null;
    setOfflineSummary(null);
    setOfflinePassphrase('');
    setOfflineMessage('');
    if (patientId) {
      try { await clearEncryptedOfflineSummary(patientId); }
      catch { cacheClearFailed = true; }
    }
    if (loggedInUser?.backend === 'supabase') {
      try { await signOutSupabase(); }
      catch (error: any) { showToast(error?.message || 'Could not complete secure sign-out.'); return; }
    }
    setHealthPassBackend('demo');
    setLoggedInUser(null);
    setWalletData(null); setDoctorRecord(null); setAuthorizedGrantsForDoctor([]);
    setPharmacyData(null);
    setShowUserDropdown(false);
    showToast(cacheClearFailed
      ? 'Signed out. The encrypted offline copy could not be removed; it remains passphrase-protected on this device.'
      : 'Signed out from HealthPass.');
  }, [loggedInUser, showToast]);

  // Navigation handlers
  const handleNavigateHome = () => {
    setMode('LANDING');
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateHowItWorks = () => {
    setMobileMenuOpen(false);
    setMode('HOW_IT_WORKS');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Register centralized 403 handler
  useEffect(() => {
    registerGlobal403Handler((consentError, ctx) => {
      if (!ctx.doctorId || ctx.doctorId === activeDoctorId) {
        if (consentError.code !== 'CATEGORY_NOT_SHARED') {
          setDoctorRecord(null);
        }
        setDoctorConsentError(consentError);
      }
    });
    return () => registerGlobal403Handler(null);
  }, [activeDoctorId]);

  // Fetch Patient Wallet
  const fetchPatientWallet = useCallback(
    async (patId = activePatientId) => {
      setLoadingWallet(true);
      try {
        const res = await apiRequest(`/api/patient/${patId}/wallet`, {
          method: 'GET',
          patientId: patId,
          suppressGlobal403: true,
        });
        if (res.ok && res.data) {
          setWalletData(res.data);
          setPatientProfileDraft(res.data.patientHealthProfile || null);
          const currentOffline = offlineSummary;
          const offlineKey = offlineKeyRef.current;
          if (navigator.onLine && loggedInUser?.role === 'patient' && loggedInUser.id === patId && currentOffline?.patientId === patId && offlineKey) {
            const freshSummary = buildOfflineMedicalSummary(patId, res.data.patient, res.data.record, res.data.patientHealthProfile);
            if (shouldReplaceOfflineSummary(currentOffline.version || 0, freshSummary.version)) {
              try {
                await replaceEncryptedOfflineSummary(freshSummary, offlineKey.key, offlineKey.salt);
                setOfflineSummary(freshSummary);
                setOfflineMessage('A newer server summary was synchronized to this device.');
              } catch { setOfflineMessage('Could not update the encrypted offline copy. The current copy was kept.'); }
            } else if (freshSummary.version < (currentOffline.version || 0)) {
              setOfflineMessage('The server copy is older than this saved summary. The newer local copy was kept; no local data was sent to the server.');
            }
          }
        }
      } catch {
        // Handled gracefully by mock store
      } finally {
        setLoadingWallet(false);
      }
    },
    [activePatientId, loggedInUser, offlineSummary]
  );

  // Fetch Authorized Patients list strictly for this Doctor
  const fetchDoctorAuthorizedList = useCallback(
    async (docId = activeDoctorId) => {
      try {
        const res = await apiRequest(`/api/provider/${docId}/authorized-patients`, {
          method: 'GET',
          doctorId: docId,
          suppressGlobal403: true,
        });
        if (res.ok && res.data) {
          setAuthorizedGrantsForDoctor(res.data.authorizedGrants || []);
        }
      } catch {
        // Handled gracefully
      }
    },
    [activeDoctorId]
  );

  // Fetch Doctor Point-of-Care Record
  const fetchDoctorRecord = useCallback(
    async (patId = activePatientId, docId = activeDoctorId) => {
      scanStartRef.current = performance.now();
      try {
        const result = await apiRequest(
          `/api/provider/patient/${patId}/record?doctorId=${docId}`,
          {
            method: 'GET',
            doctorId: docId,
            patientId: patId,
          }
        );
        const elapsedSec = Math.max(0.2, (performance.now() - scanStartRef.current) / 1000);
        setRecordOpenSeconds(elapsedSec);

        if (result.status === 403 || !result.ok) {
          setDoctorRecord(null);
          if (result.consentError) {
            setDoctorConsentError(result.consentError);
          }
          return;
        }

        setDoctorConsentError(null);
        setDoctorRecord(result.data);
        setPreConsentIdentity({
          patientId: result.data.patient.id,
          name: result.data.patient.name,
          healthPassId: result.data.patient.healthPassId,
          gatewayLabel: 'HealthPass Verified Identity',
        });
      } catch {
        // Handled gracefully
      }
    },
    [activePatientId, activeDoctorId]
  );

  const fetchPharmacyView = useCallback(async (query = pharmacySearchId) => {
    if (loggedInUser?.role !== 'pharmacy') { setPharmacyData(null); return; }
    const res = await apiRequest(`/api/pharmacy/patient/${encodeURIComponent(query)}`, {
      pharmacistId: loggedInUser.id,
      suppressGlobal403: true,
    });
    setPharmacyData(res.ok ? res.data : { error: res.data?.error || 'Prescription access is unavailable.' });
  }, [loggedInUser, pharmacySearchId]);

  const fetchAdminOverview = useCallback(async () => {
    const res = await apiRequest('/api/admin/overview', { suppressGlobal403: true });
    if (res.ok) {
      setAdminData(res.data);
    }
  }, []);

  useEffect(() => {
    fetchPatientWallet(activePatientId);
    fetchDoctorRecord(activePatientId, activeDoctorId);
    fetchDoctorAuthorizedList(activeDoctorId);
  }, [activePatientId, activeDoctorId, fetchPatientWallet, fetchDoctorRecord, fetchDoctorAuthorizedList]);

  useEffect(() => {
    const onOffline = () => setIsOnline(false);
    const onOnline = () => {
      setIsOnline(true);
      if (loggedInUser?.role === 'patient' && loggedInUser.id === activePatientId) fetchPatientWallet(activePatientId);
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => { window.removeEventListener('offline', onOffline); window.removeEventListener('online', onOnline); };
  }, [activePatientId, fetchPatientWallet, loggedInUser]);

  // Keep the patient consent inbox current while a pharmacist is requesting access.
  // In demo mode this also picks up fictional consent changes from another tab.
  useEffect(() => {
    if (mode !== 'PATIENT' || loggedInUser?.role !== 'patient' || loggedInUser.id !== activePatientId) return;
    const refresh = () => { void fetchPatientWallet(activePatientId); };
    const interval = window.setInterval(refresh, 4000);
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'healthpass-local-demo-state-v1' || event.key === 'healthpass-demo-consent-grants-v1') refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', onStorage);
    };
  }, [mode, loggedInUser, activePatientId, fetchPatientWallet]);

  useEffect(() => {
    if (mode !== 'LAB' || loggedInUser?.role !== 'lab' || !labPatientIdentity || labAccessStatus !== 'PENDING') return;
    const refreshLabRequest = async () => {
      const result = await apiRequest('/api/lab/patient-lookup', {
        method: 'POST', labId: loggedInUser.id,
        body: JSON.stringify({ healthPassId: labPatientIdentity.healthPassId }), suppressGlobal403: true,
      });
      if (result.ok) {
        setLabAccessStatus(result.data.accessStatus || 'NONE');
        setLabPatientIdentity((current: any) => current?.healthPassId === result.data.patient?.healthPassId ? { ...current, grant: result.data.grant } : current);
      }
    };
    const interval = window.setInterval(() => { void refreshLabRequest(); }, 4000);
    return () => window.clearInterval(interval);
  }, [mode, loggedInUser, labPatientIdentity, labAccessStatus]);

  useEffect(() => {
    setSelectedDoctorRecordCategory(null);
  }, [activePatientId, activeDoctorId]);

  useEffect(() => {
    if (mode === 'PHARMACY') fetchPharmacyView(pharmacySearchId);
    if (mode === 'ADMIN') fetchAdminOverview();
  }, [mode, pharmacySearchId, fetchPharmacyView, fetchAdminOverview]);

  useEffect(() => {
    if (mode !== 'PHARMACY' || loggedInUser?.role !== 'pharmacy' || pharmacyData?.accessStatus !== 'ACTIVE') return;
    const expiry = Date.parse(pharmacyData.grant?.expiresAt || '');
    const grantId = pharmacyData.grant?.id;
    const clearIfExpired = () => {
      if (Number.isFinite(expiry) && expiry <= Date.now()) {
        setPharmacyData((current: any) => current?.grant?.id === grantId
          ? { ...current, accessStatus: 'EXPIRED', prescriptions: [] }
          : current);
      } else {
        void fetchPharmacyView(pharmacySearchId);
      }
    };
    const interval = window.setInterval(clearIfExpired, 5000);
    return () => window.clearInterval(interval);
  }, [mode, loggedInUser, pharmacyData?.accessStatus, pharmacyData?.grant?.id, pharmacyData?.grant?.expiresAt, pharmacySearchId, fetchPharmacyView]);

  // Live Camera QR Scanner Effect
  useEffect(() => {
    if (!showScannerModal) return;
    let stream: MediaStream | null = null;
    let scanInterval: ReturnType<typeof setInterval> | null = null;
    setCameraError(null);

    const startCamera = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Camera API unavailable in this browser context. Use manual HealthPass ID input or a demo patient shortcut below.'
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const BarcodeDetectorClass = (window as any).BarcodeDetector;
        if (BarcodeDetectorClass) {
          const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
          scanInterval = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                const scannedToken = String(barcodes[0].rawValue).trim();
                setDoctorLookupQuery(scannedToken);
                setShowScannerModal(false);
                handleDoctorLookup(scannedToken);
              }
            } catch {
              // Ignore frame decode error
            }
          }, 350);
        }
      } catch {
        setCameraError(
          'Camera permission declined or no camera hardware detected. Enter the HealthPass ID below or tap a demo patient shortcut.'
        );
      }
    };

    startCamera();

    return () => {
      if (scanInterval) clearInterval(scanInterval);
      if (stream) {
        stream.getTracks().forEach((tr) => tr.stop());
      }
    };
  }, [showScannerModal]);

  // ============================================================================
  // USER ACTIONS (LOGIN, CONSENT, REVOKE, SCAN, REQUEST, AI EXPLAIN, FHIR)
  // ============================================================================
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (isCreatingAccount) {
      if (!isSupabaseConfigured) { setLoginError('Patient account creation requires the configured Supabase connection.'); return; }
      try {
        if (!registrationName.trim()) throw new Error('Enter your name to create a patient account.');
        const registered = await signUpSupabasePatient(loginEmail.trim(), loginPassword, registrationName);
        setIsCreatingAccount(false);
        if (registered.confirmationRequired) {
          setLoginError('Check your email to confirm your account, then sign in.');
          return;
        }
        if (!registered.user) throw new Error('The account was created, but sign-in could not be completed.');
        setHealthPassBackend('supabase');
        setLoggedInUser(registered.user); setActivePatientId(registered.user.id); setWalletData(null);
        setMode('PATIENT'); setShowLoginModal(false);
        showToast('Patient account created and signed in.');
      } catch (error: any) { setLoginError(error?.message || 'Account creation failed.'); }
      return;
    }
    // The listed fictional identities always use their isolated browser demo store.
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      suppressGlobal403: true,
    });
    let user: any = res.ok ? res.data?.user : null;
    if (user) {
      if (loggedInUser?.backend === 'supabase') {
        try { await signOutSupabase(); }
        catch (error: any) { setLoginError(error?.message || 'Could not close the current secure session.'); return; }
      }
      setHealthPassBackend('demo');
    }
    else {
      if (!isSupabaseConfigured) { setLoginError(translateUiPhrase(res.data?.error || 'Login failed. Supabase connection is not configured.', lang)); return; }
      try { user = await signInSupabase(loginEmail.trim(), loginPassword); setHealthPassBackend('supabase'); }
      catch (error: any) { setLoginError(translateUiPhrase(error?.message || 'Login failed.', lang)); return; }
    }
    const u = { ...user, backend: user.backend || 'demo' };
    // Never carry an unlocked summary or key across account changes.
    offlineKeyRef.current = null;
    setOfflineSummary(null);
    setOfflinePassphrase('');
    setOfflineMessage('');
    setLoggedInUser(u);
    setWalletData(null); setDoctorRecord(null); setAuthorizedGrantsForDoctor([]);
    setPharmacyData(null);
    setLabPatientIdentity(null);
    setLabAccessStatus('NONE');
    setLabHealthPassId('');
    setShowLoginModal(false);
    if (u.role === 'patient') {
      setActivePatientId(u.id);
      setMode('PATIENT');
      showToast(`Signed in as ${u.name} (${u.healthPassId || 'HP-DEMO-0417'})`);
    } else if (u.role === 'doctor') {
      setActiveDoctorId(u.id);
      setMode('DOCTOR');
      showToast(`Signed in as ${u.name}`);
    } else if (u.role === 'pharmacy') {
      setMode('PHARMACY');
    } else if (u.role === 'lab') {
      setMode('LAB');
    } else if (u.role === 'admin') {
      setMode('ADMIN');
    }
  };

  const handleDoctorLookup = async (customQuery?: string) => {
    const q = (customQuery || doctorLookupQuery).trim();
    if (!q) return;

    const res = await apiRequest('/api/provider/lookup', {
      method: 'POST',
      doctorId: activeDoctorId,
      body: JSON.stringify({ query: q, doctorId: activeDoctorId }),
      suppressGlobal403: true,
    });

    if (!res.ok || !res.data?.lookup) {
      showToast('Patient not found.');
      return;
    }

    const foundPatId = res.data.lookup.patientId;
    setPreConsentIdentity({
      patientId: foundPatId,
      name: res.data.lookup.name,
      healthPassId: res.data.lookup.healthPassId,
      gatewayLabel: res.data.lookup.gatewayLabel,
    });
    setActivePatientId(foundPatId);
    await fetchDoctorRecord(foundPatId, activeDoctorId);
    await fetchPatientWallet(foundPatId);
    showToast(`Verified Identity: ${res.data.lookup.name} (${res.data.lookup.healthPassId})`);
  };

  const handleDoctorRequestAccess = async (customPurpose?: string) => {
    const res = await apiRequest('/api/provider/request-access', {
      method: 'POST',
      doctorId: activeDoctorId,
      patientId: activePatientId,
      body: JSON.stringify({
        patientId: activePatientId,
        doctorId: activeDoctorId,
        purpose: customPurpose || requestPurpose,
        requestedCategories: requestCategories.length > 0 ? requestCategories : [...ALL_CATEGORIES],
        durationHours: requestDurationHours,
      }),
      suppressGlobal403: true,
    });

    if (!res.ok) {
      showToast(res.data?.error || 'Cannot request access.');
      return;
    }
    if (res.data?.simulatedOtp) {
      setSimulatedOtpCode(res.data.simulatedOtp);
    }
    setSelectedCategories(
      requestCategories.length > 0
        ? requestCategories
        : ['Medical history', 'Prescriptions', 'Medicines']
    );
    setSelectedDuration(requestDurationHours);
    await fetchPatientWallet(activePatientId);
    await fetchDoctorRecord(activePatientId, activeDoctorId);
    await fetchDoctorAuthorizedList(activeDoctorId);
    showToast(`Consent request sent to patient from ${currentDoctorObj.name} (${currentDoctorObj.facilityLevel}).`);
  };

  const handlePatientConsentDecision = async (
    grantId: string,
    decision: 'GRANT' | 'DENY',
    overrideCats?: string[],
    overrideHours?: number
  ) => {
    const pendingRequest = walletData?.grants?.find((grant: any) => grant.id === grantId);
    const res = await apiRequest(`/api/patient/${activePatientId}/consent/${grantId}/decide`, {
      method: 'POST',
      patientId: activePatientId,
      body: JSON.stringify({
        decision,
        grantedCategories: pendingRequest?.providerType === 'pharmacist'
          ? ['Medications & Prescriptions']
          : overrideCats || selectedCategories,
        durationHours: overrideHours || selectedDuration,
        durationSeconds: useFastExpirySeconds || undefined,
        actedByHelper: helperMode
          ? walletData?.patient?.trustedHelperName || 'Community Health Worker'
          : undefined,
      }),
      suppressGlobal403: true,
    });
    if (res.ok) {
      setUseFastExpirySeconds(null);
      await fetchPatientWallet(activePatientId);
      await fetchDoctorRecord(activePatientId, activeDoctorId);
      await fetchDoctorAuthorizedList(activeDoctorId);
      showToast(decision === 'GRANT' ? 'Consent granted successfully.' : 'Access declined.');
    } else showToast(res.data?.error || 'Could not update this consent request.');
  };

  const handlePatientRevoke = async (grantId: string) => {
    const res = await apiRequest(`/api/patient/${activePatientId}/consent/${grantId}/revoke`, {
      method: 'POST',
      patientId: activePatientId,
      body: JSON.stringify({
        actedByHelper: helperMode
          ? walletData?.patient?.trustedHelperName || 'Community Health Worker'
          : undefined,
      }),
      suppressGlobal403: true,
    });
    if (res.ok) {
      const revokedGrant = walletData?.grants?.find((grant: any) => grant.id === grantId);
      if (revokedGrant?.providerType === 'pharmacist') {
        setPharmacyData((current: any) => current?.grant?.id === grantId
          ? { ...current, accessStatus: 'REVOKED', prescriptions: [] }
          : current);
      }
      setDoctorRecord(null);
      setDoctorConsentError(
        map403ToConsentScreen('ACCESS_REVOKED', 'The patient has withdrawn permission.')
      );
      await fetchPatientWallet(activePatientId);
      await fetchDoctorAuthorizedList(activeDoctorId);
      showToast('🔒 ACCESS REVOKED BY PATIENT: Doctor screen immediately locked out (HTTP 403).');
    } else showToast(res.data?.error || 'Could not revoke access.');
  };

  const handlePatientExtend = async (grantId: string) => {
    const result = await apiRequest(`/api/patient/${activePatientId}/consent/${grantId}/extend`, {
      method: 'POST',
      patientId: activePatientId,
      body: JSON.stringify({ extraHours: 24 }),
      suppressGlobal403: true,
    });
    if (!result.ok) { showToast(result.data?.error || 'Could not extend consent.'); return; }
    await fetchPatientWallet(activePatientId);
    await fetchDoctorRecord(activePatientId, activeDoctorId);
    showToast('Consent grant extended by 24 hours.');
  };

  const handleRevokeAll = async () => {
    const result = await apiRequest(`/api/patient/${activePatientId}/consent/revoke-all`, {
      method: 'POST',
      patientId: activePatientId,
      suppressGlobal403: true,
    });
    if (!result.ok) { showToast(result.data?.error || 'Could not revoke access.'); return; }
    setDoctorRecord(null);
    setDoctorConsentError(
      map403ToConsentScreen('ACCESS_REVOKED', 'The patient has withdrawn permission.')
    );
    await fetchPatientWallet(activePatientId);
    await fetchDoctorAuthorizedList(activeDoctorId);
    showToast('All providers revoked.');
  };

  const handleRegenerateQr = async () => {
    const result = await apiRequest(`/api/patient/${activePatientId}/qr-token`, { method: 'POST', patientId: activePatientId, suppressGlobal403: true });
    if (!result.ok) { showToast(result.data?.error || 'Could not replace the QR token.'); return; }
    setDoctorRecord(null);
    setDoctorConsentError(
      map403ToConsentScreen('ACCESS_REVOKED', 'The patient has withdrawn permission.')
    );
    await fetchPatientWallet(activePatientId);
    await fetchDoctorAuthorizedList(activeDoctorId);
    showToast('A new demo QR token was created and active access grants were revoked.');
  };

  const handleApproveInPersonOtp = async (grantId: string) => {
    const res = await apiRequest('/api/provider/approve-in-person-otp', {
      method: 'POST',
      body: JSON.stringify({
        grantId,
        otp: otpInput || simulatedOtpCode,
        selectedCategories,
      }),
      suppressGlobal403: true,
    });
    if (!res.ok) {
      showToast('OTP verification failed.');
      return;
    }
    setOtpInput('');
    await fetchPatientWallet(activePatientId);
    await fetchDoctorRecord(activePatientId, activeDoctorId);
    await fetchDoctorAuthorizedList(activeDoctorId);
    showToast('Approved in person via OTP.');
  };

  const handleDoctorVerifyUnsharedCategory = async (category: string) => {
    showToast(`🔒 HTTP 403 (CATEGORY_NOT_SHARED): Patient withheld "${category}".`);
  };

  const handleDoctorRepeatMedicineDirect = async (med: any) => {
    setPrefillConsultMed(med);
    setShowConsultationModal(true);
  };

  const handleDoctorUploadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docReportTitle.trim()) return;
    const result = await apiRequest(`/api/provider/patient/${activePatientId}/reports`, {
      method: 'POST',
      doctorId: activeDoctorId,
      patientId: activePatientId,
      body: JSON.stringify({
        doctorId: activeDoctorId,
        title: docReportTitle,
        testName: docReportTitle,
        reportDate: new Date().toISOString().slice(0, 10),
        category: docReportCategory,
        resultSummary: docReportSummary || 'Uploaded by consulting doctor at point of care.',
      }),
    });
    if (!result.ok) {
      showToast(result.status === 403 ? `🔒 HTTP 403 (${result.data?.code}): ${result.data?.message}` : result.data?.error || 'Report upload failed.');
      setShowDoctorReportModal(false);
      return;
    }
    setDocReportTitle('');
    setDocReportSummary('');
    setShowDoctorReportModal(false);
    fetchDoctorRecord(activePatientId, activeDoctorId);
    fetchPatientWallet(activePatientId);
    showToast('Report uploaded to patient HealthPass.');
  };

  const handlePharmacyRequestAccess = async (event: React.FormEvent) => {
    event.preventDefault();
    const healthPassId = pharmacyLookupQuery.trim();
    if (!healthPassId || loggedInUser?.role !== 'pharmacy') return;
    const result = await apiRequest('/api/pharmacy/request-access', {
      method: 'POST', pharmacistId: loggedInUser.id,
      body: JSON.stringify({ healthPassId, durationHours: 24 }), suppressGlobal403: true,
    });
    if (!result.ok) {
      setPharmacyData({ error: result.data?.error || 'Could not request prescription access.' });
      return;
    }
    setPharmacySearchId(healthPassId);
    await fetchPharmacyView(healthPassId);
    showToast('Prescription access request sent. The patient must approve before any prescription is shown.');
  };

  const handleLabPatientLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loggedInUser?.role !== 'lab' || loggedInUser.id !== 'lab-demo') { showToast('Sign in with the diagnostic lab account to identify a patient.'); return; }
    setLabLookupBusy(true);
    const result = await apiRequest('/api/lab/patient-lookup', {
      method: 'POST', labId: loggedInUser.id,
      body: JSON.stringify({ healthPassId: labHealthPassId }), suppressGlobal403: true,
    });
    setLabLookupBusy(false);
    if (!result.ok) { setLabPatientIdentity(null); showToast(result.data?.error || 'Patient not found.'); return; }
    setLabPatientIdentity(result.data.patient);
    setLabAccessStatus(result.data.accessStatus || 'NONE');
    showToast(`Patient identified: ${result.data.patient.name}`);
  };

  const handleLabRequestAccess = async () => {
    if (loggedInUser?.role !== 'lab' || loggedInUser.id !== 'lab-demo' || !labPatientIdentity) return;
    setLabLookupBusy(true);
    const result = await apiRequest('/api/lab/request-access', {
      method: 'POST', labId: loggedInUser.id,
      body: JSON.stringify({ healthPassId: labPatientIdentity.healthPassId }), suppressGlobal403: true,
    });
    setLabLookupBusy(false);
    if (!result.ok) { showToast(result.data?.error || 'Could not request patient approval.'); return; }
    setLabAccessStatus(result.data.grant?.status || 'PENDING');
    setLabPatientIdentity((current: any) => current ? { ...current, grant: result.data.grant } : current);
    showToast('Report request sent. The patient must approve it from Access Requests before you can add the report.');
  };

  const handleLabReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loggedInUser?.role !== 'lab' || loggedInUser.id !== 'lab-demo' || !labPatientIdentity || labAccessStatus !== 'GRANTED') { showToast('The patient must approve your active laboratory report request before you can save a result.'); return; }
    setLabSaveBusy(true);
    const result = await apiRequest('/api/lab/reports', {
      method: 'POST', labId: loggedInUser.id,
      body: JSON.stringify({ healthPassId: labPatientIdentity.healthPassId, title: labTestName, reportDate: labReportDate, resultSummary: labResultSummary }),
      suppressGlobal403: true,
    });
    setLabSaveBusy(false);
    if (!result.ok) { showToast(result.data?.error || 'Could not save the lab report.'); return; }
    showToast(`Lab report added to ${labPatientIdentity.name}’s HealthPass.`);
    setLabTestName('');
    setLabResultSummary('');
  };

  const handleProviderVerification = async (providerId: string) => {
    const result = await apiRequest(`/api/admin/providers/${providerId}/verification`, {
      method: 'POST', body: JSON.stringify({}), suppressGlobal403: true,
    });
    if (!result.ok) { showToast('Could not update provider verification.'); return; }
    await fetchAdminOverview();
    showToast(`${result.data?.provider?.name || 'Provider'} verification updated.`);
  };

  const handlePatientMedAction = async (
    medId: string,
    action: 'MARK_TAKEN' | 'TOGGLE_STOP' | 'REQUEST_REFILL' | 'DELETE_SELF_REPORTED'
  ) => {
    if (action === 'DELETE_SELF_REPORTED') {
      if (!window.confirm('Remove this self-reported medication entry? Prescribed records cannot be deleted here.')) return;
      const deleted = await apiRequest(`/api/patient/${activePatientId}/medicines/${medId}`, { method: 'DELETE', patientId: activePatientId, suppressGlobal403: true });
      if (!deleted.ok) { showToast(deleted.data?.error || 'Could not remove this entry.'); return; }
      await fetchPatientWallet(activePatientId);
      showToast('Self-reported medication entry removed.');
      return;
    }
    const result = await apiRequest(`/api/patient/${activePatientId}/medicines/${medId}`, {
      method: 'POST', patientId: activePatientId,
      body: JSON.stringify({ medicineId: medId, action }), suppressGlobal403: true,
    });
    if (!result.ok) { showToast(result.data?.error || 'Could not update medication status.'); return; }
    showToast(action === 'MARK_TAKEN' ? 'Dose marked as taken.' : action === 'REQUEST_REFILL' ? 'Refill request recorded.' : 'Medicine status updated.');
    await fetchPatientWallet(activePatientId);
  };

  const handleRemovePatientReport = async (reportId: string, title: string) => {
    if (!window.confirm(`Remove your uploaded document “${title}”? Clinician and lab records are retained.`)) return;
    const result = await apiRequest(`/api/patient/${activePatientId}/reports/${reportId}`, { method: 'DELETE', patientId: activePatientId, suppressGlobal403: true });
    if (!result.ok) { showToast(result.data?.error || 'Could not remove this document.'); return; }
    await fetchPatientWallet(activePatientId);
    showToast('Your uploaded document was removed from the local demo.');
  };

  const handleAddSelfReportedMed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selfMedSaving) return;
    if (!selfMedName.trim()) return;
    setSelfMedError('');
    setExistingMedicineId('');
    setSelfMedSaving(true);
    const result = await apiRequest(`/api/patient/${activePatientId}/medicines`, {
      method: 'POST', patientId: activePatientId,
      body: JSON.stringify({ name: selfMedName, strength: selfMedStrength }), suppressGlobal403: true,
    });
    setSelfMedSaving(false);
    if (!result.ok) {
      setSelfMedError(result.data?.error || 'Could not add this medicine.');
      setExistingMedicineId(result.data?.existingMedicineId || '');
      return;
    }
    setSelfMedName('');
    setShowSelfMedForm(false);
    await fetchPatientWallet(activePatientId);
    showToast('Self-reported medicine added to your HealthPass.');
  };

  const handleUploadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReportTitle.trim()) return;
    const result = await apiRequest('/api/patient/reports', {
      method: 'POST', patientId: activePatientId,
      body: JSON.stringify({ title: newReportTitle, category: newReportCategory, reportDate: new Date().toISOString().slice(0, 10), resultSummary: newReportSummary }),
      suppressGlobal403: true,
    });
    if (!result.ok) { showToast(result.data?.error || 'Could not upload this document.'); return; }
    setNewReportTitle('');
    setNewReportSummary('');
    setShowUploadReportForm(false);
    await fetchPatientWallet(activePatientId);
    showToast(`Document uploaded under category "${newReportCategory}".`);
  };

  const handleCategorizeMedicalRecord = async (reportId: string, medicalCategory: string) => {
    const result = await apiRequest(
      `/api/patient/${activePatientId}/reports/${reportId}/category`,
      { method: 'POST', patientId: activePatientId, body: JSON.stringify({ medicalCategory }), suppressGlobal403: true }
    );
    if (!result.ok) { showToast(result.data?.error || 'Could not update the record category.'); return; }
    await fetchPatientWallet(activePatientId);
    showToast('Medical record category updated.');
  };

  const savePrescriptionMetadata = async (reportId: string) => {
    setPrescriptionSaveError('');
    const result = await apiRequest(`/api/patient/${activePatientId}/prescriptions/${reportId}/metadata`, {
      method: 'PATCH', patientId: activePatientId, body: JSON.stringify(prescriptionMetadataDraft), suppressGlobal403: true,
    });
    if (!result.ok) { setPrescriptionSaveError(result.data?.error || 'Prescription details could not be updated.'); return; }
    setPrescriptionEditId(null);
    await fetchPatientWallet(activePatientId);
    showToast('Prescription details updated. The original document was preserved.');
  };

  const requestHealthReportEntries = async () => {
    if (!healthReportCategories.length) throw new Error('Select at least one medical category.');
    const result = await apiRequest(`/api/patient/${activePatientId}/personal-health-report`, {
      method: 'POST', patientId: activePatientId,
      body: JSON.stringify({ categories: healthReportCategories, fromDate: healthReportFromDate, toDate: healthReportToDate }),
      suppressGlobal403: true,
    });
    if (!result.ok) throw new Error(result.data?.error || result.data?.message || 'Could not load authorized records.');
    return result.data.entries || [];
  };

  const previewHealthReport = async () => {
    setHealthReportBusy(true); setHealthReportError(''); setHealthReportPreview(null);
    try { setHealthReportPreview(await requestHealthReportEntries()); }
    catch (error: any) { setHealthReportError(error.message || 'Could not prepare the preview.'); }
    finally { setHealthReportBusy(false); }
  };

  const downloadHealthReport = async () => {
    setHealthReportBusy(true); setHealthReportError('');
    try {
      const entries = await requestHealthReportEntries();
      if (!entries.length) throw new Error('There are no records in this selection to download.');
      const blob = createPersonalHealthReportPdf({ entries, categories: healthReportCategories, fromDate: healthReportFromDate, toDate: healthReportToDate });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `HealthPass-Personal-Health-Report-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (error: any) { setHealthReportError(error.message || 'The PDF could not be generated or downloaded.'); }
    finally { setHealthReportBusy(false); }
  };

  const openOriginalMedicalFile = (fileUrl?: string) => {
    if (!fileUrl) return;
    try {
      // Chromium blocks top-level navigation to data: URLs. Convert uploaded
      // originals to a same-origin blob URL; reserve the tab synchronously so
      // the browser's popup blocker recognizes the user's click.
      if (fileUrl.startsWith('data:')) {
        const tab = window.open('about:blank', '_blank');
        if (!tab) {
          showToast('The original file could not be opened. Allow pop-ups and try again.');
          return;
        }
        tab.opener = null;
        tab.document.title = 'Opening original file…';
        void fetch(fileUrl).then(async (fileResponse) => {
          if (!fileResponse.ok) throw new Error('Could not read the original file.');
          const blob = await fileResponse.blob();
          const blobUrl = URL.createObjectURL(blob);
          tab.location.replace(blobUrl);
          window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
        }).catch(() => {
          tab.close();
          showToast('The original file could not be read.');
        });
        return;
      }
      const opened = window.open(fileUrl, '_blank', 'noopener,noreferrer');
      if (!opened) showToast('The original file could not be opened. Allow pop-ups and try again.');
    } catch {
      showToast('The original file could not be opened.');
    }
  };

  const saveOfflinePatientSummary = async () => {
    if (loggedInUser?.role !== 'patient' || loggedInUser.id !== activePatientId) {
      setOfflineMessage(ui('Sign in as this patient to save an offline summary.')); return;
    }
    if (!isOnline || !walletData?.record || walletData?.patient?.id !== activePatientId) {
      setOfflineMessage(ui('Connect to the internet and load this patient record before saving an offline summary.')); return;
    }
    setOfflineBusy(true); setOfflineMessage('');
    try {
      const summary = buildOfflineMedicalSummary(activePatientId, walletData.patient, walletData.record, walletData.patientHealthProfile);
      const key = await saveEncryptedOfflineSummary(summary, offlinePassphrase);
      offlineKeyRef.current = key;
      setOfflineSummary(summary);
      setOfflinePassphrase('');
      setOfflineMessage(ui('Encrypted offline summary saved on this device.'));
    } catch (error: any) { setOfflineMessage(error.message || 'Could not save the encrypted offline summary.'); }
    finally { setOfflineBusy(false); }
  };

  const unlockOfflinePatientSummary = async () => {
    if (loggedInUser?.role !== 'patient' || loggedInUser.id !== activePatientId) {
      setOfflineMessage(ui('Sign in as this patient before unlocking offline information.')); return;
    }
    setOfflineBusy(true); setOfflineMessage('');
    try {
      const unlocked = await loadEncryptedOfflineSummary(activePatientId, offlinePassphrase);
      if (!unlocked) throw new Error('No offline summary is saved for this patient on this device.');
      offlineKeyRef.current = { key: unlocked.key, salt: unlocked.salt };
      setOfflineSummary(unlocked.summary);
      setOfflinePassphrase('');
      setOfflineMessage(ui('Offline summary unlocked for this signed-in patient.'));
    } catch (error: any) { setOfflineMessage(error.message || 'Could not unlock the offline summary.'); }
    finally { setOfflineBusy(false); }
  };

  const clearOfflinePatientSummary = async () => {
    if (loggedInUser?.role !== 'patient' || loggedInUser.id !== activePatientId) return;
    setOfflineBusy(true); setOfflineMessage('');
    try {
      await clearEncryptedOfflineSummary(activePatientId);
      offlineKeyRef.current = null; setOfflineSummary(null); setOfflinePassphrase('');
      setOfflineMessage(ui('Saved offline information was cleared from this device.'));
    } catch (error: any) { setOfflineMessage(error.message || 'Could not clear the saved offline information.'); }
    finally { setOfflineBusy(false); }
  };

  const handleExplainHistoryAi = async () => {
    setLoadingAi(true);
    setTimeout(() => {
      setAiExplanation({
        source: 'HealthPass Clinical Knowledge Engine (Deterministic Plain-Language)',
        patientSummary:
          'You have managed Type 2 Diabetes for 3 years, which is well-controlled on Metformin. You recently recovered from an acute viral febrile illness treated with Paracetamol at Kothapalli Village Clinic. IMPORTANT: You have a documented severe allergy to Sulfa antibiotics; all clinicians are warned.',
        clinicianBrief:
          '42yo F with controlled T2D (HbA1c 6.8%) on Metformin 500mg BID. Documented severe allergy to sulfonamide antibiotics. Recent uncomplicated viral illness resolved.',
        disclaimer:
          'This summary is generated for personal reference and does not substitute for clinical judgment.',
      });
      setLoadingAi(false);
    }, 700);
  };

  const handleDownloadFhir = async () => {
    const bundle = {
      resourceType: 'Bundle',
      type: 'document',
      timestamp: new Date().toISOString(),
      entry: [
        { resource: { resourceType: 'Patient', id: activePatientId, name: [{ text: 'Ananya Rao' }] } },
      ],
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `healthpass-fhir-r4-${walletData?.patient?.healthPassId || 'HP-DEMO-0417'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('HL7 FHIR R4 Bundle exported.');
  };

  const handleResetDemo = async (resetMode: 'CLEAN_LOCKED' | 'PENDING_REQUEST') => {
    if (resetMode === 'PENDING_REQUEST') {
      await handleDoctorRequestAccess();
      return;
    }
    if (!window.confirm('Reset all fictional HealthPass demo records and consent requests in this browser? This cannot be undone.')) return;
    const result = await apiRequest('/api/demo/reset', { method: 'POST', suppressGlobal403: true });
    if (!result.ok) {
      showToast(result.data?.error || 'Demo data could not be reset.');
      return;
    }
    setActivePatientId('pat-1');
    setActiveDoctorId('doc-village');
    setPharmacyData(null);
    setWalletData(null);
    setDoctorRecord(null);
    setDoctorConsentError(null);
    setAiExplanation(null);
    setDemoStorageWarning('');
    await Promise.all(DEMO_PATIENTS.map(async (patient) => { try { await clearEncryptedOfflineSummary(patient.id); } catch { /* Reset remains available even if an old encrypted cache cannot be cleared. */ } }));
    await fetchPatientWallet('pat-1');
    await fetchDoctorRecord('pat-1', 'doc-village');
    showToast('All fictional demo data was reset in this browser.');
  };

  const handleClinicRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await apiRequest('/api/admin/providers', {
      method: 'POST', suppressGlobal403: true,
      body: JSON.stringify({ name: regDoctorName, facilityName: regClinicName, facilityLevel: regFacilityLevel, facilityType: regFacilityType }),
    });
    if (!result.ok) { showToast(result.data?.error || 'Could not add this demo provider.'); return; }
    setShowClinicRegModal(false);
    const newDoc = {
      ...result.data.provider,
      badgeColor: 'bg-[#ECFDF5] text-[#1E8E5A] border-[#A7F3D0]',
    };
    setDoctorList((prev) => [...prev, newDoc]);
    setActiveDoctorId(newDoc.id);
    showToast(`Registered ${regClinicName} successfully.`);
  };

  // ============================================================================
  // RENDER PATIENT WALLET PANE
  // ============================================================================
  const renderPatientPane = (isSplit = false) => {
    const pat = walletData?.patient || {
      id: 'pat-1',
      name: 'Demo Patient (Ananya Rao)',
      age: 42,
      gender: 'Female',
      bloodGroup: 'O+',
      healthPassId: 'HP-DEMO-0417',
      abhaNumber: '91-4820-7391-0417',
    };
    const rec = walletData?.record || {
      allergies: [],
      medicines: [],
      visits: [],
      reports: [],
      chronicConditions: [],
      vitals: [],
      vaccinations: [],
      consentTemplates: [],
    };
    const savedHealthProfile = walletData?.patientHealthProfile || {};
    const profileFallback = {
      knownAllergies: (rec.allergies || []).map((item: any) => `${item.allergen}${item.severity ? ` (${item.severity})` : ''}`).join(', '),
      currentMedications: (rec.medicines || []).filter((item: any) => item.computedStatus === 'ACTIVE').map((item: any) => `${item.name}${item.strength ? ` ${item.strength}` : ''}`).join(', '),
      healthConditions: (rec.chronicConditions || []).map((item: any) => item.simpleLabel || item.name).filter(Boolean).join(', '),
      pastSurgeries: '', bloodGroup: pat.bloodGroup || '',
      emergencyContactName: pat.emergencyContact?.name || '', emergencyContactRelation: pat.emergencyContact?.relation || '',
      emergencyContactPhone: pat.emergencyContact?.phone || '',
    };
    const completeness = buildMedicalRecordCompleteness(pat, rec, savedHealthProfile);
    const prescriptionDocuments = (rec.reports || []).filter((report: any) =>
      report.extractedFields?.reportType === 'Prescription' || /prescription/i.test(report.category || '')
    );
    const prescriptionDateValue = (report: any) => report.prescriptionMetadataCorrections?.reportDate || report.extractedFields?.reportDate || report.reportDate || report.uploadedAt || report.createdAt || '';
    const filteredPrescriptionDocuments = [...prescriptionDocuments].sort((a: any, b: any) =>
      (Date.parse(prescriptionDateValue(b)) || 0) - (Date.parse(prescriptionDateValue(a)) || 0)
    ).filter((report: any) => {
      const correction = report.prescriptionMetadataCorrections || {};
      const provider = correction.prescribingProvider || report.extractedFields?.doctorName || report.facilityName || '';
      const date = correction.reportDate || report.extractedFields?.reportDate || report.reportDate || '';
      const category = correction.medicalCategory || report.medicalCategory || getMedicalRecordCategory(report);
      const period = correction.prescriptionPeriod || report.prescriptionPeriod || 'UNCLASSIFIED';
      const terms = `${report.title || ''} ${provider} ${category} ${report.resultSummary || ''}`.toLowerCase();
      if (prescriptionSearch.trim() && !terms.includes(prescriptionSearch.trim().toLowerCase())) return false;
      if (prescriptionPeriodFilter !== 'ALL' && period !== prescriptionPeriodFilter) return false;
      if (prescriptionCategoryFilter !== 'ALL' && category !== prescriptionCategoryFilter) return false;
      const parsedDate = date ? new Date(date) : null;
      const isoDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString().slice(0, 10) : '';
      if (prescriptionDateFrom && (!isoDate || isoDate < prescriptionDateFrom)) return false;
      if (prescriptionDateTo && (!isoDate || isoDate > prescriptionDateTo)) return false;
      return true;
    });
    const grants: any[] = walletData?.grants || [];
    const audits: any[] = walletData?.auditLogs || [];
    const notifications: any[] = walletData?.notifications || [];

    const activeGrants = grants.filter((g) => g.status === 'GRANTED');
    const pendingGrants = grants.filter((g) => g.status === 'PENDING');
    const pharmacistAccessHistory = grants.filter((grant) => grant.providerType === 'pharmacist' && grant.status !== 'PENDING' && grant.status !== 'GRANTED');
    const activeMeds = (rec.medicines || []).filter((m: any) => m.computedStatus === 'ACTIVE');
    const pastMeds = (rec.medicines || []).filter((m: any) => m.computedStatus !== 'ACTIVE');
    const medicalRecords = [
      ...(rec.reports || []).map((report: any) => ({ ...report, sourceRecordType: 'report', medicalCategory: getMedicalRecordCategory(report) })),
      ...(rec.medicines || []).map((medicine: any) => ({
        id: `medicine-${medicine.id}`, sourceRecordType: 'linked', title: `${medicine.name} ${medicine.strength || ''}`.trim(),
        category: 'Medications & Prescriptions', medicalCategory: 'Medications & Prescriptions',
        resultSummary: `${medicine.dosage || ''} ${medicine.route || ''} · ${medicine.computedStatus || 'Recorded'}`,
        createdAt: medicine.startDate,
      })),
      ...(rec.allergies || []).map((allergy: any) => ({
        id: `allergy-${allergy.id}`, sourceRecordType: 'linked', title: `Allergy: ${allergy.allergen}`,
        category: 'Allergies', medicalCategory: 'Allergies', resultSummary: `${allergy.severity || ''} · ${allergy.reaction || ''}`,
      })),
      ...(rec.visits || []).map((visit: any) => ({
        id: `visit-${visit.id}`, sourceRecordType: 'linked', title: visit.diagnosis,
        category: 'Consultation History', medicalCategory: 'Consultation History',
        resultSummary: `${visit.date || ''} · ${visit.chiefComplaint || ''} · ${visit.clinicalNotes || ''}`,
        createdAt: visit.date,
      })),
      ...(rec.chronicConditions || []).map((condition: any, index: number) => ({
        id: `condition-${condition.id || index}`, sourceRecordType: 'linked', title: condition.name || condition.simpleLabel,
        category: 'General Medical History', medicalCategory: getMedicalRecordCategory(condition),
        resultSummary: `${condition.simpleLabel || ''} · Since ${condition.since || 'date not recorded'}`,
      })),
      ...(rec.vaccinations || []).map((vaccine: any) => ({
        id: `vaccination-${vaccine.id}`, sourceRecordType: 'linked', title: vaccine.vaccineName,
        category: 'Vaccinations', medicalCategory: 'Vaccinations', resultSummary: vaccine.status || 'Recorded',
      })),
    ];
    const getReportDate = (report: any) => {
      const rawDate = report.extractedFields?.reportDate || report.reportDate || report.date || report.createdAt;
      if (!rawDate) return '';
      const parsedDate = new Date(rawDate);
      return Number.isNaN(parsedDate.getTime()) ? '' : parsedDate.toISOString().slice(0, 10);
    };
    const filteredMedicalRecords = medicalRecords.filter((report: any) => {
      if (selectedMedicalRecordCategory && report.medicalCategory !== selectedMedicalRecordCategory) return false;
      const searchText = `${report.title || ''} ${report.resultSummary || ''} ${report.medicalCategory}`.toLowerCase();
      if (medicalRecordSearch.trim() && !searchText.includes(medicalRecordSearch.trim().toLowerCase())) return false;
      const date = getReportDate(report);
      if (medicalRecordDateFrom && (!date || date < medicalRecordDateFrom)) return false;
      if (medicalRecordDateTo && (!date || date > medicalRecordDateTo)) return false;
      return true;
    });

    return (
      <div className="space-y-5">
        <div className="clay-card p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[#0E7C86] inline-flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{ui('Choose a patient:')}</span>
            </span>
            {DEMO_PATIENTS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePatientId(p.id)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activePatientId === p.id
                    ? 'bg-[#0E7C86] text-white shadow-xs'
                    : 'bg-[#F5F9FA] text-[#1F2D3D] border border-[#DDE7EA] hover:bg-white'
                }`}
              >
                {p.name.split(' (')[0]} ({p.healthPassId})
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setHelperMode(!helperMode)}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
              helperMode
                ? 'bg-[#FFFBEB] border-[#E8A317] text-[#92400E]'
                : 'bg-white border-[#DDE7EA] text-[#5B6B7A]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>{helperMode ? 'Assisted Mode: ON' : 'Trusted Helper Mode'}</span>
          </button>
        </div>

        {pendingGrants.map((pg) => (
          <div
            key={pg.id}
            className="rounded-2xl bg-[#FFFBEB] border-2 border-[#E8A317] p-4 sm:p-5 shadow-md space-y-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#E8A317] text-white flex items-center justify-center shrink-0">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-extrabold text-[#B7791F]">
                      {pg.providerType === 'pharmacist' ? 'PHARMACIST PRESCRIPTION ACCESS REQUEST' : pg.providerType === 'lab' ? 'DIAGNOSTIC LAB REPORT REQUEST' : 'LIVE ACCESS REQUEST RECEIVED'}
                    </span>
                    <FacilityBadge
                      level={pg.facilityLevel}
                      type={pg.facilityType}
                      name={pg.facilityName}
                      lang={lang}
                    />
                  </div>
                  <h3 className="text-lg font-bold text-[#1F2D3D] mt-0.5">
                    {pg.doctorName} {t.requestingAccessTitle}
                  </h3>
                  <p className="text-xs text-[#5B6B7A] mt-0.5">
                    Facility: <strong>{pg.facilityName}</strong> ({pg.facilityLevel}) · Purpose:{' '}
                    <strong>{pg.purpose}</strong>
                  </p>
                </div>
              </div>
              <StatusChip status="PENDING" label={translateUiPhrase('AWAITING YOUR CONSENT', lang)} lang={lang} />
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-[#DDE7EA] space-y-2.5">
              <div className="text-xs font-bold text-[#1F2D3D]">{t.whatToShare}:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(pg.providerType === 'pharmacist' ? ['Medications & Prescriptions'] : pg.providerType === 'lab' ? ['Laboratory Reports'] : ALL_CATEGORIES).map((cat) => {
                  const checked = pg.providerType === 'pharmacist' || pg.providerType === 'lab' || selectedCategories.includes(cat);
                  return (
                    <label
                      key={cat}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                        checked
                          ? 'bg-[#0E7C86]/10 border-[#0E7C86] text-[#1F2D3D]'
                          : 'bg-[#F5F9FA] border-[#DDE7EA] text-[#5B6B7A]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={pg.providerType === 'pharmacist' || pg.providerType === 'lab'}
                        onChange={() => {
                          setSelectedCategories((prev) =>
                            prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                          );
                        }}
                        className="w-4 h-4 accent-[#0E7C86]"
                      />
                      <span>{translateMedicalCategory(cat, lang)}</span>
                    </label>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#DDE7EA]">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs font-bold text-[#1F2D3D]">{t.durationLabel}:</label>
                  <select
                    value={useFastExpirySeconds ? 'FAST_15S' : String(selectedDuration)}
                    onChange={(e) => {
                      if (e.target.value === 'FAST_15S') {
                        setUseFastExpirySeconds(15);
                      } else {
                        setUseFastExpirySeconds(null);
                        setSelectedDuration(Number(e.target.value));
                      }
                    }}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] bg-[#F5F9FA] text-xs font-bold text-[#1F2D3D]"
                  >
                    <option value="1">1 Hour</option>
                    <option value="12">12 Hours</option>
                    <option value="24">24 Hours (Default)</option>
                    <option value="48">48 Hours</option>
                    <option value="FAST_15S">15 Seconds (Test Auto-Expiry 403)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePatientConsentDecision(pg.id, 'DENY')}
                    className="min-h-[44px] px-4 py-2 rounded-xl border border-[#D32F2F] bg-white text-xs font-bold text-[#D32F2F] hover:bg-[#FEF2F2] cursor-pointer"
                  >
                    {t.denyAccessBtn}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePatientConsentDecision(pg.id, 'GRANT')}
                    className="min-h-[44px] px-5 py-2 clay-btn-primary text-xs font-bold cursor-pointer"
                  >
                    {t.grantAccessBtn}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {activeGrants.map((ag) => (
          <div key={ag.id} className="space-y-2">
            <div className="flex items-center justify-between px-1 text-xs text-[#5B6B7A]">
              <span>
                Active Grant to <strong>{ag.doctorName}</strong> ({ag.facilityName} ·{' '}
                <strong>{ag.facilityLevel}</strong>)
              </span>
              <span className="font-mono">Shared: {ALL_CATEGORIES.filter((category) => isMedicalCategoryAuthorized(ag, category as any)).join(', ')}</span>
            </div>
            <AccessTimer
              expiresAt={ag.expiresAt}
              lang={lang}
              onExtend={() => handlePatientExtend(ag.id)}
              onRevoke={() => handlePatientRevoke(ag.id)}
              onExpired={() => {
                fetchPatientWallet(activePatientId);
                fetchDoctorRecord(activePatientId, activeDoctorId);
              }}
            />
          </div>
        ))}

        {pharmacistAccessHistory.length > 0 && <section className="clay-card p-4 space-y-2" aria-label="Pharmacist prescription access history">
          <h3 className="text-sm font-bold text-[#1F2D3D]">{ui('Pharmacist prescription access')}</h3>
          {pharmacistAccessHistory.map((grant) => <div key={grant.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#DDE7EA] bg-white p-3 text-sm">
            <div><p className="font-bold text-[#1F2D3D]">{grant.doctorName || 'Pharmacist'}</p><p className="text-xs text-[#5B6B7A]">Requested: Prescriptions · Expires: {grant.expiresAt ? new Date(grant.expiresAt).toLocaleString() : 'Not granted'}</p></div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{grant.status === 'GRANTED' && Date.parse(grant.expiresAt || '') <= Date.now() ? 'EXPIRED' : grant.status}</span>
          </div>)}
        </section>}

        {walletData?.emergencyLinks && walletData.emergencyLinks.length > 0 && (
          <PatientEmergencyLinksPanel
            patientId={pat.id}
            healthPassId={pat.healthPassId || 'HP-DEMO-0417'}
            emergencyLinks={walletData.emergencyLinks}
            lang={lang}
            onUpdated={() => fetchPatientWallet(activePatientId)}
            onNotify={showToast}
          />
        )}

        {/* Patient Sub-Tabs Bar */}
        {patientTab === 'HEALTH' && pendingGrants.some((grant) => grant.providerType === 'pharmacist' || grant.providerType === 'lab') && (
          <button
            type="button"
            onClick={() => setPatientTab('CONSENT')}
            className="w-full my-3 p-4 rounded-2xl border-2 border-[#E8A317] bg-[#FFFBEB] text-left flex flex-wrap items-center justify-between gap-3 hover:bg-[#FEF3C7]"
          >
            <span>
              <strong className="block text-sm text-[#1F2D3D]">{ui('A provider is requesting access')}</strong>
              <span className="block mt-1 text-xs text-[#5B6B7A]">{ui('Review who requested access and approve or reject from Access Requests. Requested records stay private until you approve.')}</span>
            </span>
            <span className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0E7C86] text-white text-xs font-bold inline-flex items-center">{ui('Review request')}</span>
          </button>
        )}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 no-print">
          {(
            [
              { id: 'HEALTH', label: t.myHealth, icon: HeartPulse },
              { id: 'MEDICINES', label: t.myMedicines, icon: Pill },
              { id: 'QR', label: t.myQr, icon: QrCode },
              { id: 'REPORTS', label: t.myReports, icon: FileText },
              {
                id: 'CONSENT',
                label: t.myConsent,
                icon: ShieldCheck,
                badge: pendingGrants.length || activeGrants.length,
              },
              { id: 'PRIVACY', label: t.myPrivacy, icon: Lock },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = patientTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPatientTab(tab.id)}
                className={`min-h-[48px] px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  active
                    ? 'clay-btn-primary shadow-xs'
                    : 'bg-white border border-[#DDE7EA] text-[#1F2D3D] hover:bg-[#F5F9FA]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
                {'badge' in tab && tab.badge ? (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                      active ? 'bg-white text-[#0E7C86]' : 'bg-[#0E7C86] text-white'
                    }`}
                  >
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* TAB 1: MY HEALTH */}
        {patientTab === 'HEALTH' && (
          <div className="space-y-5">
            <section className="clay-card p-4 sm:p-5 space-y-3" aria-labelledby="record-completeness-heading">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h3 id="record-completeness-heading" className="text-base font-bold text-[#1F2D3D]">{ui('Medical Record Completeness')}</h3><p className="text-xs text-[#5B6B7A]">{ui('A record overview to help you review your information. Empty sections do not imply that a record is needed.')}</p></div>
                <span className="text-[11px] text-[#5B6B7A]">{ui('Last updated is based on saved dates; unknown dates are shown as Unknown.')}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {completeness.sections.map((section) => {
                  const destination: PatientTab = section.id === 'medications' || section.id === 'prescriptions' ? 'MEDICINES' : section.id === 'laboratory' ? 'REPORTS' : 'HEALTH';
                  return <button key={section.id} type="button" onClick={() => setPatientTab(destination)} className="p-3 rounded-xl border border-[#DDE7EA] bg-[#F5F9FA] text-left hover:bg-white">
                    <span className="block text-sm font-bold text-[#1F2D3D]">{section.label}</span>
                    <span className="block mt-1 text-xs text-[#5B6B7A]">{section.count ? `${section.count} record${section.count === 1 ? '' : 's'} on file` : 'Information not provided'}</span>
                    <span className="block mt-1 text-[10px] text-[#5B6B7A]">Last updated: {section.lastUpdated}</span>
                  </button>;
                })}
              </div>
              <div className="pt-2 border-t border-[#DDE7EA]">
                <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-xs font-bold text-[#1F2D3D]">{ui('Records to review')}</h4><span className="text-[10px] text-[#5B6B7A]">{ui('Metadata reminders only; records are not changed.')}</span></div>
                {completeness.reviewItems.length ? <ul className="mt-2 space-y-1.5">{completeness.reviewItems.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5B6B7A]"><span><strong className="text-[#1F2D3D]">{item.title}</strong> · {ui('Review this record')}: {ui('Missing')} {item.missing.map(ui).join(` ${ui('and')} `)}</span><button type="button" onClick={() => setPatientTab('REPORTS')} className="min-h-[30px] px-2 rounded-lg border border-[#DDE7EA] bg-white text-[11px] font-bold text-[#0E7C86]">{ui('Review record')}</button></li>)}</ul> : <p className="mt-2 text-xs text-[#5B6B7A]">{ui('No missing date or source metadata was identified for prescription and laboratory documents.')}</p>}
              </div>
            </section>
            <section className="clay-card p-4 sm:p-5 space-y-3" aria-labelledby="offline-summary-heading">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><h3 id="offline-summary-heading" className="text-base font-bold text-[#1F2D3D]">{ui('Offline Medical Summary')}</h3><p className="text-xs text-[#5B6B7A]">{ui('A small encrypted copy of allergies, current medicines, important conditions, emergency contact, and update time.')}</p></div>
                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${isOnline ? 'bg-[#ECFDF5] text-[#1E8E5A]' : 'bg-[#FEF3C7] text-[#92400E]'}`}>{isOnline ? 'Online' : 'Offline'}</span>
              </div>
                <p className="text-[11px] text-[#5B6B7A]">{ui('Offline information may be outdated. It is encrypted on this device, requires a passphrase to unlock, and is scoped to the signed-in patient.')}</p>
              {loggedInUser?.role === 'patient' && loggedInUser.id === activePatientId ? <>
                <label className="block max-w-sm text-[11px] font-semibold text-[#5B6B7A]">{ui('Device passphrase (10 characters minimum)')}<input type="password" autoComplete="new-password" value={offlinePassphrase} onChange={(e) => setOfflinePassphrase(e.target.value)} className="block mt-1 w-full min-h-[38px] px-3 rounded-xl border border-[#DDE7EA] bg-white text-xs" /></label>
                <div className="flex flex-wrap gap-2">
                  {isOnline && <button type="button" disabled={offlineBusy || offlinePassphrase.trim().length < 10} onClick={saveOfflinePatientSummary} className="min-h-[38px] px-3 rounded-xl clay-btn-primary text-xs font-bold disabled:opacity-50">{offlineBusy ? 'Saving…' : ui('Save offline summary')}</button>}
                  {!offlineSummary && <button type="button" disabled={offlineBusy || !offlinePassphrase} onClick={unlockOfflinePatientSummary} className="min-h-[38px] px-3 rounded-xl border border-[#DDE7EA] bg-white text-xs font-bold text-[#0E7C86] disabled:opacity-50">{ui('Unlock saved summary')}</button>}
                  {offlineSummary?.patientId === activePatientId && <button type="button" disabled={offlineBusy} onClick={clearOfflinePatientSummary} className="min-h-[38px] px-3 rounded-xl border border-[#DDE7EA] bg-white text-xs font-bold text-[#B42318] disabled:opacity-50">{ui('Clear saved information')}</button>}
                </div>
                {offlineSummary?.patientId === activePatientId && <div className="p-3 rounded-xl bg-[#FEF3C7]/60 border border-[#FCD34D] space-y-2">
                  <p className="text-xs font-bold text-[#92400E]">{ui('Saved offline copy · may be outdated')}</p>
                  <p className="text-[11px] text-[#5B6B7A]">{ui('Last updated')}: {offlineSummary.updatedAt ? new Date(offlineSummary.updatedAt).toLocaleString() : ui('Unknown')}</p>
                  {([['Allergies',offlineSummary.allergies],['Current medications',offlineSummary.currentMedications],['Important medical conditions',offlineSummary.conditions],['Emergency contacts',offlineSummary.emergencyContacts]] as const).map(([label,values]) => <p key={label} className="text-xs text-[#1F2D3D]"><strong>{ui(label)}:</strong> {values?.length ? values.join('; ') : ui('Information not provided')}</p>)}
                </div>}
                <p className="text-[10px] text-[#5B6B7A]">{ui('When connected again, the app refreshes this copy only if server record timestamps are newer. Offline changes are not sent to or used to overwrite server records.')}</p>
              </> : <p className="text-xs text-[#5B6B7A]">{ui('Sign in as the patient to save or unlock this private offline summary.')}</p>}
              {offlineMessage && <p role="status" className="text-xs text-[#0E7C86]">{offlineMessage}</p>}
            </section>
            <PatientBanner
              patient={pat}
              lang={lang}
              onCopyId={(id) => showToast(`Copied HealthPass ID: ${id}`)}
              onShowQr={() => setPatientTab('QR')}
            />

            <div className="clay-card p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-bold text-[#1F2D3D]">
                Patient-Held Record Actions ({pat.healthPassId}):
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPatientOcrModal(true)}
                  className="min-h-[40px] px-3.5 py-1.5 clay-btn-primary text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{ui('Upload Medical Document (OCR)')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPatientTab('MEDICINES')}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-white border border-[#DDE7EA] hover:bg-[#F5F9FA] text-xs font-bold text-[#1F2D3D] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Pill className="w-3.5 h-3.5 text-[#0E7C86]" />
                  <span>Prescriptions ({rec.prescriptions?.length || 0})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPatientTab('QR')}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-white border border-[#DDE7EA] hover:bg-[#F5F9FA] text-xs font-bold text-[#0E7C86] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{ui('Show My QR')}</span>
                </button>
              </div>
            </div>

            <section className="clay-card p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h3 className="text-base font-bold text-[#1F2D3D]">{ui('Patient Health Profile')}</h3><p className="text-xs text-[#5B6B7A]">{ui('Patient-provided details are labeled unverified; unknown information stays unknown.')}</p></div>
                {!patientProfileEditing && <button type="button" onClick={() => { setPatientProfileDraft({ ...profileFallback, ...savedHealthProfile }); setPatientProfileEditing(true); }} className="min-h-[38px] px-3 rounded-xl border border-[#DDE7EA] bg-white text-xs font-bold text-[#0E7C86]">{ui('Edit profile')}</button>}
              </div>
              {patientProfileEditing ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([['knownAllergies','Known allergies'],['currentMedications','Current medications'],['healthConditions','Existing health conditions'],['pastSurgeries','Relevant past surgeries']] as const).map(([key,label]) => <label key={key} className="text-xs font-semibold text-[#5B6B7A]">{ui(label)}<textarea value={patientProfileDraft?.[key] || ''} onChange={(e) => setPatientProfileDraft((current: any) => ({ ...current, [key]: e.target.value }))} placeholder={ui('Unknown')} rows={2} className="block mt-1 w-full p-2 rounded-xl border border-[#DDE7EA] bg-white text-xs text-[#1F2D3D]" /></label>)}
                <label className="text-xs font-semibold text-[#5B6B7A]">{ui('Blood group (optional)')}<input value={patientProfileDraft?.bloodGroup || ''} onChange={(e) => setPatientProfileDraft((current: any) => ({ ...current, bloodGroup: e.target.value }))} placeholder={ui('Unknown')} className="block mt-1 w-full min-h-[38px] px-2 rounded-xl border border-[#DDE7EA] bg-white text-xs text-[#1F2D3D]" /></label>
                <label className="text-xs font-semibold text-[#5B6B7A]">{ui('Emergency contact name')}<input value={patientProfileDraft?.emergencyContactName || ''} onChange={(e) => setPatientProfileDraft((current: any) => ({ ...current, emergencyContactName: e.target.value }))} placeholder={ui('Unknown')} className="block mt-1 w-full min-h-[38px] px-2 rounded-xl border border-[#DDE7EA] bg-white text-xs text-[#1F2D3D]" /></label>
                <label className="text-xs font-semibold text-[#5B6B7A]">{ui('Emergency contact relation')}<input value={patientProfileDraft?.emergencyContactRelation || ''} onChange={(e) => setPatientProfileDraft((current: any) => ({ ...current, emergencyContactRelation: e.target.value }))} placeholder={ui('Unknown')} className="block mt-1 w-full min-h-[38px] px-2 rounded-xl border border-[#DDE7EA] bg-white text-xs text-[#1F2D3D]" /></label>
                <label className="text-xs font-semibold text-[#5B6B7A]">{ui('Emergency contact phone')}<input value={patientProfileDraft?.emergencyContactPhone || ''} onChange={(e) => setPatientProfileDraft((current: any) => ({ ...current, emergencyContactPhone: e.target.value }))} placeholder={ui('Unknown')} className="block mt-1 w-full min-h-[38px] px-2 rounded-xl border border-[#DDE7EA] bg-white text-xs text-[#1F2D3D]" /></label>
                <div className="sm:col-span-2 flex gap-2"><button type="button" disabled={patientProfileSaving} onClick={savePatientHealthProfile} className="min-h-[38px] px-4 rounded-xl clay-btn-primary text-xs font-bold disabled:opacity-60">{patientProfileSaving ? 'Saving…' : ui('Save profile')}</button><button type="button" onClick={() => setPatientProfileEditing(false)} className="min-h-[38px] px-4 rounded-xl border border-[#DDE7EA] bg-white text-xs font-bold">{ui('Cancel')}</button></div>
              </div> : <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {([['Known allergies',savedHealthProfile.knownAllergies || profileFallback.knownAllergies],['Current medications',savedHealthProfile.currentMedications || profileFallback.currentMedications],['Existing health conditions',savedHealthProfile.healthConditions || profileFallback.healthConditions],['Relevant past surgeries',savedHealthProfile.pastSurgeries],['Blood group',savedHealthProfile.bloodGroup || profileFallback.bloodGroup],['Emergency contact',[savedHealthProfile.emergencyContactName || profileFallback.emergencyContactName,savedHealthProfile.emergencyContactRelation || profileFallback.emergencyContactRelation,savedHealthProfile.emergencyContactPhone || profileFallback.emergencyContactPhone].filter(Boolean).join(' · ')]] as const).map(([label,value]) => <div key={label} className="p-3 rounded-xl bg-[#F5F9FA] border border-[#DDE7EA]"><span className="font-bold text-[#1F2D3D]">{label}: </span><span className="text-[#5B6B7A]">{value || 'Unknown'}</span><div className="mt-1 text-[10px] text-[#5B6B7A]">Source: {savedHealthProfile.source || (value ? 'Existing HealthPass record' : 'Unknown')} · Status: {savedHealthProfile.verificationStatus || (value ? 'Verification status unavailable' : 'Unknown')} · Updated: {savedHealthProfile.updatedAt ? new Date(savedHealthProfile.updatedAt).toLocaleDateString() : 'Unknown'}</div></div>)}
              </div>}
              {patientProfileMessage && <p role="status" className="text-xs text-[#0E7C86]">{patientProfileMessage}</p>}
            </section>
            <AllergyBanner allergies={rec.allergies} lang={lang} />

            <div className="clay-card p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#0E7C86]/10 text-[#0E7C86] flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-[#1F2D3D]">
                        {t.explainMyHistoryBtn}
                      </h3>
                      <span className="text-[11px] font-semibold text-[#0E7C86]">
                        · Bilingual Plain Language
                      </span>
                    </div>
                    <p className="text-xs text-[#5B6B7A]">{t.aiDisclaimer}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs text-[#5B6B7A] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowExternalAi}
                      onChange={(e) => setAllowExternalAi(e.target.checked)}
                      className="accent-[#0E7C86]"
                    />
                    <span>{ui('Allow de-identified cloud assist')}</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleExplainHistoryAi}
                    disabled={loadingAi}
                    className="min-h-[42px] px-4 py-2 clay-btn-primary text-xs font-bold cursor-pointer"
                  >
                    {loadingAi ? 'Summarizing...' : 'Generate Summary'}
                  </button>
                </div>
              </div>

              {aiExplanation && (
                <div className="p-4 rounded-2xl bg-[#F5F9FA] border border-[#DDE7EA] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#0E7C86]">
                      Source: {aiExplanation.source}
                    </span>
                    <SpeechButton text={aiExplanation.patientSummary} lang={lang} />
                  </div>
                  <p className="text-sm text-[#1F2D3D] leading-relaxed">
                    {aiExplanation.patientSummary}
                  </p>
                  <div className="p-3 rounded-xl bg-white border border-[#DDE7EA]">
                    <div className="text-xs font-bold text-[#1769AA]">
                      2-Sentence Clinician Handover Brief:
                    </div>
                    <p className="text-xs text-[#1F2D3D] font-mono mt-1">
                      {aiExplanation.clinicianBrief}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="clay-card p-4 sm:p-5 space-y-3">
                <h3 className="text-base font-bold text-[#1F2D3D] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#0E7C86]" />
                  <span>{t.chronicConditions}</span>
                </h3>
                {(rec.chronicConditions || []).map((cc: any, i: number) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-[#F5F9FA] border border-[#DDE7EA] flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-bold text-[#1F2D3D]">{cc.simpleLabel}</div>
                      <div className="text-xs text-[#5B6B7A]">{cc.name}</div>
                    </div>
                    <span className="text-xs font-mono text-[#0E7C86]">Since {cc.since}</span>
                  </div>
                ))}
              </div>

              <div className="clay-card p-4 sm:p-5 space-y-3">
                <h3 className="text-base font-bold text-[#1F2D3D] flex items-center gap-2">
                  <Syringe className="w-4 h-4 text-[#1769AA]" />
                  <span>{ui('Vitals & Immunization Status')}</span>
                </h3>
                {rec.vitals?.[0] && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-[#F5F9FA] border border-[#DDE7EA]">
                      <div className="text-[11px] text-[#5B6B7A]">{ui('Blood Pressure')}</div>
                      <div className="text-sm font-extrabold font-mono text-[#1F2D3D]">
                        {rec.vitals[0].bpSystolic}/{rec.vitals[0].bpDiastolic}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#F5F9FA] border border-[#DDE7EA]">
                      <div className="text-[11px] text-[#5B6B7A]">{ui('Fasting Sugar')}</div>
                      <div className="text-sm font-extrabold font-mono text-[#B7791F]">
                        {rec.vitals[0].bloodSugarMgDl} mg/dL
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#F5F9FA] border border-[#DDE7EA]">
                      <div className="text-[11px] text-[#5B6B7A]">{ui('Weight')}</div>
                      <div className="text-sm font-extrabold font-mono text-[#1F2D3D]">
                        {rec.vitals[0].weightKg} kg
                      </div>
                    </div>
                  </div>
                )}
                {rec.vaccinations?.map((vac: any) => (
                  <div
                    key={vac.id}
                    className="flex items-center justify-between text-xs pt-1 border-t border-[#DDE7EA]"
                  >
                    <span className="font-semibold text-[#1F2D3D]">{vac.vaccineName}</span>
                    <StatusChip status="ACTIVE" label={vac.status} lang={lang} />
                  </div>
                ))}
              </div>
            </div>

            <div className="clay-card p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#1F2D3D]">{t.recentVisits}</h3>
                <span className="text-xs text-[#5B6B7A]">
                  Continuity across Village → Mandal → District
                </span>
              </div>
              <div className="space-y-3">
                {(rec.visits || []).map((vis: any) => (
                  <div
                    key={vis.id}
                    className="p-4 rounded-2xl bg-[#F5F9FA] border border-[#DDE7EA] space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-[#0E7C86] text-white text-xs font-mono font-bold">
                          {vis.date}
                        </span>
                        <span className="text-sm font-bold text-[#1F2D3D]">{vis.diagnosis}</span>
                      </div>
                      <FacilityBadge
                        level={vis.facilityLevel}
                        type={vis.facilityType}
                        name={vis.facilityName}
                        lang={lang}
                      />
                    </div>
                    <p className="text-xs text-[#5B6B7A]">
                <strong>{ui('Doctor')}:</strong> {vis.doctorName} · <strong>{ui('Complaint')}:</strong>{' '}
                      {vis.chiefComplaint}
                    </p>
                    <p className="text-xs text-[#1F2D3D]">{vis.clinicalNotes}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MY MEDICINES */}
        {patientTab === 'MEDICINES' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[#1F2D3D]">{t.activeMedicines}</h3>
                <p className="text-xs text-[#5B6B7A]">
                  Pictorial Morning / Noon / Night schedule with audio read-aloud
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSelfMedForm(!showSelfMedForm)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-white border border-[#0E7C86] text-xs font-bold text-[#0E7C86] hover:bg-[#F5F9FA] cursor-pointer"
              >
                {t.addSelfMed}
              </button>
            </div>

            {showSelfMedForm && <form onSubmit={handleAddSelfReportedMed} className="clay-card p-4 flex flex-wrap items-end gap-3" aria-label={ui('Add self-reported medicine')}>
              <label className="flex-1 min-w-[190px] text-xs font-semibold text-[#5B6B7A]">{ui('Medicine name')}<input value={selfMedName} onChange={(event) => setSelfMedName(event.target.value)} required maxLength={200} className="block mt-1 w-full min-h-[42px] rounded-xl border border-[#DDE7EA] bg-white px-3 text-sm text-[#1F2D3D]" /></label>
              <label className="w-full sm:w-40 text-xs font-semibold text-[#5B6B7A]">{ui('Strength')}<input value={selfMedStrength} onChange={(event) => setSelfMedStrength(event.target.value)} maxLength={100} className="block mt-1 w-full min-h-[42px] rounded-xl border border-[#DDE7EA] bg-white px-3 text-sm text-[#1F2D3D]" /></label>
              <button type="submit" disabled={selfMedSaving} className="min-h-[42px] rounded-xl clay-btn-primary px-4 text-xs font-bold disabled:opacity-50">{selfMedSaving ? ui('Saving…') : ui('Save medicine')}</button>
              <button type="button" onClick={() => { setShowSelfMedForm(false); setSelfMedError(''); }} className="min-h-[42px] rounded-xl border border-[#DDE7EA] bg-white px-4 text-xs font-bold">{ui('Cancel')}</button>
              {selfMedError && <p role="alert" className="w-full text-xs font-semibold text-red-700">{selfMedError} {existingMedicineId && <button type="button" onClick={() => document.getElementById(`medicine-${existingMedicineId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="underline font-bold">{ui('View Existing Record')}</button>}</p>}
            </form>}

            <section className="clay-card p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h3 className="text-base font-bold text-[#1F2D3D]">{ui('Prescription Documents')}</h3><p className="text-xs text-[#5B6B7A]">{ui('Original files stay unchanged. Current or historical status is only set when you choose it.')}</p></div>
                <button type="button" onClick={() => { setPrescriptionUploadMode(true); setShowPatientOcrModal(true); }} className="min-h-[40px] px-3 rounded-xl clay-btn-primary text-xs font-bold inline-flex items-center gap-1.5"><Upload className="w-4 h-4" />{ui('Upload prescription')}</button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex-1 min-w-[220px] text-[11px] font-semibold text-[#5B6B7A]">{tr('searchPrescriptions', lang)}<VoiceSearchInput value={prescriptionSearch} onChange={setPrescriptionSearch} lang={lang} placeholder={tr('searchPrescriptions', lang)} ariaLabel={tr('searchPrescriptions', lang)} /></label>
                <label className="text-[11px] font-semibold text-[#5B6B7A]">{ui('From')}<input type="date" value={prescriptionDateFrom} onChange={(e) => setPrescriptionDateFrom(e.target.value)} className="block mt-1 min-h-[38px] px-2 rounded-xl border border-[#DDE7EA] bg-white text-xs" /></label>
                <label className="text-[11px] font-semibold text-[#5B6B7A]">To<input type="date" value={prescriptionDateTo} onChange={(e) => setPrescriptionDateTo(e.target.value)} className="block mt-1 min-h-[38px] px-2 rounded-xl border border-[#DDE7EA] bg-white text-xs" /></label>
                <label className="text-[11px] font-semibold text-[#5B6B7A]">{ui('Status')}<select value={prescriptionPeriodFilter} onChange={(e) => setPrescriptionPeriodFilter(e.target.value)} className="block mt-1 min-h-[38px] px-2 rounded-xl border border-[#DDE7EA] bg-white text-xs"><option value="ALL">All</option><option value="CURRENT">{ui('Current')}</option><option value="HISTORICAL">Historical</option><option value="UNCLASSIFIED">{ui('Unclassified')}</option></select></label>
                <label className="text-[11px] font-semibold text-[#5B6B7A]">{tr('medicalCategoryLabel', lang)}<select value={prescriptionCategoryFilter} onChange={(e) => setPrescriptionCategoryFilter(e.target.value)} className="block mt-1 min-h-[38px] max-w-[210px] px-2 rounded-xl border border-[#DDE7EA] bg-white text-xs"><option value="ALL">{tr('allCategories', lang)}</option>{MEDICAL_RECORD_CATEGORIES.map((category) => <option key={category} value={category}>{translateMedicalCategory(category, lang)}</option>)}</select></label>
              </div>
              {filteredPrescriptionDocuments.length === 0 ? <p className="p-3 rounded-xl bg-[#F5F9FA] text-xs text-[#5B6B7A]">{ui('No prescription documents match these filters. Upload a prescription document to add one.')}</p> : <div className="space-y-3">
                {filteredPrescriptionDocuments.map((report: any) => {
                  const correction = report.prescriptionMetadataCorrections || {};
                  const reportDate = correction.reportDate || report.extractedFields?.reportDate || report.reportDate || '';
                  const provider = correction.prescribingProvider || report.extractedFields?.doctorName || report.facilityName || 'Unknown';
                  const category = correction.medicalCategory || report.medicalCategory || getMedicalRecordCategory(report);
                  const period = correction.prescriptionPeriod || report.prescriptionPeriod || 'UNCLASSIFIED';
                  const uploadedAt = report.uploadedAt || report.createdAt;
                  return <article key={report.id} className="p-3 rounded-xl border border-[#DDE7EA] bg-[#F5F9FA] space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="text-sm font-bold text-[#1F2D3D]">{report.title}</h4><p className="mt-1 text-xs text-[#5B6B7A]">Prescription date: {reportDate || 'Unknown'} · Prescribing provider: {provider}</p><p className="text-[11px] text-[#5B6B7A]">Medical category: {category} · {period === 'CURRENT' ? 'Current prescription' : period === 'HISTORICAL' ? 'Historical prescription' : 'Status not classified'}</p></div><span className="px-2 py-1 rounded-lg bg-white border border-[#DDE7EA] text-[10px] font-bold text-[#5B6B7A]">{report.verificationStatus === 'PATIENT_REVIEWED' || report.confirmedByUser ? 'Patient reviewed' : 'Unverified'}</span></div>
                    <p className="text-[11px] text-[#5B6B7A]">Source: {report.source || 'Unknown'} · Uploaded: {uploadedAt ? new Date(uploadedAt).toLocaleString() : 'Unknown'}</p>
                    <div className="flex flex-wrap gap-2">{report.fileDataUrl ? <button type="button" onClick={() => openOriginalMedicalFile(report.fileDataUrl)} className="min-h-[34px] px-3 inline-flex items-center rounded-lg border border-[#DDE7EA] bg-white text-xs font-bold text-[#0E7C86]">{ui('Open original prescription')}</button> : <span className="text-[11px] text-[#5B6B7A]">{ui('Original file is not available in this record.')}</span>}<button type="button" onClick={() => { setPrescriptionMetadataDraft({ reportDate, prescribingProvider: provider === 'Unknown' ? '' : provider, medicalCategory: category, prescriptionPeriod: period }); setPrescriptionEditId(report.id); setPrescriptionSaveError(''); }} className="min-h-[34px] px-3 rounded-lg border border-[#DDE7EA] bg-white text-xs font-bold text-[#0E7C86]">{ui('Correct details')}</button></div>
                    {prescriptionEditId === report.id && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-lg border border-[#DDE7EA] bg-white">
                      <label className="text-[11px] font-semibold text-[#5B6B7A]">{ui('Prescription date')}<input value={prescriptionMetadataDraft.reportDate || ''} onChange={(e) => setPrescriptionMetadataDraft((current: any) => ({ ...current, reportDate: e.target.value }))} placeholder="Unknown" className="block mt-1 w-full min-h-[36px] px-2 rounded-lg border border-[#DDE7EA] text-xs" /></label>
                      <label className="text-[11px] font-semibold text-[#5B6B7A]">{ui('Prescribing provider')}<input value={prescriptionMetadataDraft.prescribingProvider || ''} onChange={(e) => setPrescriptionMetadataDraft((current: any) => ({ ...current, prescribingProvider: e.target.value }))} placeholder="Unknown" className="block mt-1 w-full min-h-[36px] px-2 rounded-lg border border-[#DDE7EA] text-xs" /></label>
                      <label className="text-[11px] font-semibold text-[#5B6B7A]">{tr('medicalCategoryLabel', lang)}<select value={prescriptionMetadataDraft.medicalCategory || ''} onChange={(e) => setPrescriptionMetadataDraft((current: any) => ({ ...current, medicalCategory: e.target.value }))} className="block mt-1 w-full min-h-[36px] px-2 rounded-lg border border-[#DDE7EA] text-xs">{MEDICAL_RECORD_CATEGORIES.map((value) => <option key={value} value={value}>{translateMedicalCategory(value, lang)}</option>)}</select></label>
                      <label className="text-[11px] font-semibold text-[#5B6B7A]">{ui('Prescription status')}<select value={prescriptionMetadataDraft.prescriptionPeriod || 'UNCLASSIFIED'} onChange={(e) => setPrescriptionMetadataDraft((current: any) => ({ ...current, prescriptionPeriod: e.target.value }))} className="block mt-1 w-full min-h-[36px] px-2 rounded-lg border border-[#DDE7EA] text-xs"><option value="UNCLASSIFIED">{ui('Unclassified')}</option><option value="CURRENT">{ui('Current')}</option><option value="HISTORICAL">Historical</option></select></label>
                      <p className="sm:col-span-2 text-[10px] text-[#5B6B7A]">{ui('Corrections update record metadata only. The uploaded prescription and its medicine instructions are preserved.')}</p>
                      {prescriptionSaveError && <p role="alert" className="sm:col-span-2 text-xs text-red-700">{prescriptionSaveError}</p>}
                      <div className="sm:col-span-2 flex gap-2"><button type="button" onClick={() => savePrescriptionMetadata(report.id)} className="min-h-[34px] px-3 rounded-lg clay-btn-primary text-xs font-bold">{ui('Save details')}</button><button type="button" onClick={() => setPrescriptionEditId(null)} className="min-h-[34px] px-3 rounded-lg border border-[#DDE7EA] text-xs font-bold">{ui('Cancel')}</button></div>
                    </div>}
                  </article>;
                })}
              </div>}
            </section>

            <div className="space-y-3">
              {activeMeds.map((med: any) => (
                <div id={`medicine-${med.id}`} key={med.id}><RxSlipCard med={med} lang={lang} isPatientView={true} onPatientAction={handlePatientMedAction} /></div>
              ))}
            </div>

            {pastMeds.length > 0 && (
              <div className="space-y-3 pt-3">
                <h4 className="text-sm font-bold text-[#5B6B7A]">{t.pastMedicines}</h4>
                {pastMeds.map((med: any) => (
                  <RxSlipCard
                    key={med.id}
                    med={med}
                    lang={lang}
                    isPatientView={true}
                    onPatientAction={handlePatientMedAction}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MY QR PASS */}
        {patientTab === 'QR' && (
          <div className="py-2">
            <WalletCard
              patient={pat}
              allergies={rec.allergies}
              lang={lang}
              onRegenerateQr={handleRegenerateQr}
            />
          </div>
        )}

        {/* TAB 4: MY REPORTS */}
        {patientTab === 'REPORTS' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[#1F2D3D]">{t.recentTests}</h3>
                <p className="text-xs text-[#5B6B7A]">
                  Upload prescriptions, lab reports, discharge summaries with OCR & review
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPatientOcrModal(true)}
                  className="min-h-[42px] px-4 py-2 clay-btn-primary text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>{ui('Upload Medical Document (OCR)')}</span>
                </button>
              </div>
            </div>

            <section className="clay-card p-4 sm:p-5 space-y-3">
              <div><h3 className="text-base font-bold text-[#1F2D3D]">{ui('Download Personal Health Report')}</h3><p className="text-xs text-[#5B6B7A]">{ui('Choose categories and an optional date range, then preview the authorized records before downloading a PDF summary. Original documents remain separate.')}</p></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {MEDICAL_RECORD_CATEGORIES.map((category) => <label key={category} className="min-h-[38px] flex items-center gap-2 px-3 rounded-xl border border-[#DDE7EA] bg-white text-xs text-[#1F2D3D]">
                <input type="checkbox" checked={healthReportCategories.includes(category)} onChange={(e) => { setHealthReportCategories((current) => e.target.checked ? [...current, category] : current.filter((value) => value !== category)); setHealthReportPreview(null); setHealthReportError(''); }} className="accent-[#0E7C86]" />{translateMedicalCategory(category, lang)}
                </label>)}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-[11px] font-semibold text-[#5B6B7A]">{ui('From')}<input type="date" value={healthReportFromDate} onChange={(e) => { setHealthReportFromDate(e.target.value); setHealthReportPreview(null); }} className="block mt-1 min-h-[38px] px-2 rounded-xl border border-[#DDE7EA] bg-white text-xs" /></label>
                <label className="text-[11px] font-semibold text-[#5B6B7A]">To<input type="date" value={healthReportToDate} onChange={(e) => { setHealthReportToDate(e.target.value); setHealthReportPreview(null); }} className="block mt-1 min-h-[38px] px-2 rounded-xl border border-[#DDE7EA] bg-white text-xs" /></label>
                <button type="button" disabled={healthReportBusy || !healthReportCategories.length} onClick={previewHealthReport} className="min-h-[38px] px-4 rounded-xl border border-[#DDE7EA] bg-white text-xs font-bold text-[#0E7C86] disabled:opacity-50">{healthReportBusy ? 'Preparing…' : ui('Preview selection')}</button>
                <button type="button" disabled={healthReportBusy || !healthReportCategories.length || !healthReportPreview?.length} onClick={downloadHealthReport} className="min-h-[38px] px-4 rounded-xl clay-btn-primary text-xs font-bold disabled:opacity-50">{ui('Download PDF')}</button>
              </div>
              {healthReportError && <p role="alert" className="text-xs text-red-700">{healthReportError}</p>}
              {healthReportPreview && <div className="p-3 rounded-xl border border-[#DDE7EA] bg-[#F5F9FA] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-xs font-bold text-[#1F2D3D]">Preview · {healthReportPreview.length} record{healthReportPreview.length === 1 ? '' : 's'}</h4><span className="text-[10px] text-[#5B6B7A]">Missing details display as Unknown; unverified status is retained.</span></div>
                {healthReportPreview.length ? <div className="max-h-64 overflow-y-auto space-y-2">{healthReportPreview.map((entry, index) => <div key={`${entry.id || entry.title}-${index}`} className="p-2 rounded-lg bg-white border border-[#DDE7EA] text-xs"><p className="font-bold text-[#1F2D3D]">{entry.title || 'Untitled record'} · {entry.category}</p><p className="mt-1 text-[#5B6B7A]">Date: {entry.date || 'Unknown'} · Provider: {entry.provider || 'Unknown'}</p><p className="text-[#5B6B7A]">Source: {entry.source || 'Unknown'} · Verification: {entry.verificationStatus || 'Unverified'}</p></div>)}</div> : <p className="text-xs text-[#5B6B7A]">{ui('No records match the selected categories and date range.')}</p>}
              </div>}
              <p className="text-[10px] text-[#5B6B7A]">{ui('The PDF is generated in this browser from records you are authorized to access. It is not published as a public link.')}</p>
            </section>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {MEDICAL_RECORD_CATEGORIES.map((category) => {
                const Icon = MEDICAL_CATEGORY_ICON[category] || FileText;
                const count = medicalRecords.filter((report: any) => report.medicalCategory === category).length;
                const selected = selectedMedicalRecordCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedMedicalRecordCategory(selected ? null : category)}
                    aria-pressed={selected}
                    className={`min-h-[82px] p-3 rounded-2xl border text-left transition-colors cursor-pointer ${selected ? 'border-[#0E7C86] bg-[#0E7C86]/10 ring-1 ring-[#0E7C86]' : 'border-[#DDE7EA] bg-white hover:bg-[#F5F9FA]'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Icon className="w-4 h-4 text-[#0E7C86] shrink-0" />
                      <span className="min-w-6 px-1.5 py-0.5 rounded-lg bg-[#F5F9FA] text-center text-[11px] font-bold text-[#5B6B7A]">{count}</span>
                    </div>
                    <div className="mt-2 text-xs font-bold leading-snug text-[#1F2D3D]">{translateMedicalCategory(category, lang)}</div>
                  </button>
                );
              })}
            </div>

            <div className="clay-card p-3.5 flex flex-wrap items-end gap-3">
              <div className="relative flex-1 min-w-[190px]">
                <VoiceSearchInput value={medicalRecordSearch} onChange={setMedicalRecordSearch} lang={lang} placeholder={tr('searchMedicalRecords', lang)} ariaLabel={tr('searchMedicalRecords', lang)} />
              </div>
              <label className="text-xs font-semibold text-[#5B6B7A]">{ui('From')} <input type="date" value={medicalRecordDateFrom} onChange={(e) => setMedicalRecordDateFrom(e.target.value)} className="block mt-1 min-h-[38px] px-2 rounded-xl border border-[#DDE7EA] text-xs text-[#1F2D3D]" /></label>
              <label className="text-xs font-semibold text-[#5B6B7A]">To <input type="date" value={medicalRecordDateTo} onChange={(e) => setMedicalRecordDateTo(e.target.value)} className="block mt-1 min-h-[38px] px-2 rounded-xl border border-[#DDE7EA] text-xs text-[#1F2D3D]" /></label>
              {(selectedMedicalRecordCategory || medicalRecordSearch || medicalRecordDateFrom || medicalRecordDateTo) && (
                <button type="button" onClick={() => { setSelectedMedicalRecordCategory(null); setMedicalRecordSearch(''); setMedicalRecordDateFrom(''); setMedicalRecordDateTo(''); }} className="min-h-[38px] px-3 rounded-xl border border-[#DDE7EA] bg-white text-xs font-bold text-[#0E7C86] cursor-pointer">
                  Show all records · {medicalRecords.length}
                </button>
              )}
            </div>

            <div className="space-y-3">
              {filteredMedicalRecords.length === 0 ? (
                <div className="clay-card p-5 text-center text-sm text-[#5B6B7A]">{ui('No medical records match these filters.')}</div>
              ) : filteredMedicalRecords.map((rep: any) => (
                <div id={`medical-record-${rep.id}`} key={rep.id} className="clay-card p-4 sm:p-5 space-y-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-bold text-[#1F2D3D]">{rep.title}</h4>
                        {rep.sourceRecordType === 'report' && rep.statusColor && <StatusChip status={rep.statusColor} lang={lang} />}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#5B6B7A]">
                        {rep.facilityName && <FacilityBadge lang={lang}
                          level={rep.facilityLevel}
                          type={rep.facilityType}
                          name={rep.facilityName}
                        />}
                        <span>·</span>
                        <span className="font-mono font-semibold text-[#0E7C86]">
                          Category: {rep.medicalCategory}
                        </span>
                        {(rep.uploaderRole === 'doctor' || rep.source === 'DOCTOR_UPLOAD' || rep.source === 'PROVIDER_UPLOAD') && <span className="text-[11px] text-[#5B6B7A]">· Doctor-uploaded · {rep.uploadedAt ? new Date(rep.uploadedAt).toLocaleDateString() : 'date unavailable'} · {rep.processingStatus || 'Processing status unavailable'}</span>}
                        {rep.medicalCategory !== rep.category && <span className="text-[11px] text-[#5B6B7A]">· Access group: {rep.category}</span>}
                      </div>
                    </div>
                    {rep.sourceRecordType === 'report' && <label className="shrink-0 text-[11px] font-semibold text-[#5B6B7A]">
                      Categorize
                      <select value={rep.medicalCategory} onChange={(e) => handleCategorizeMedicalRecord(rep.id, e.target.value)} className="block mt-1 min-h-[36px] max-w-[220px] px-2 rounded-lg border border-[#DDE7EA] bg-white text-xs text-[#1F2D3D]">
                        {MEDICAL_RECORD_CATEGORIES.map((category) => <option key={category} value={category}>{translateMedicalCategory(category, lang)}</option>)}
                      </select>
                    </label>}
                  </div>
                  <div className="p-3 rounded-xl bg-[#F5F9FA] border border-[#DDE7EA] font-mono text-xs text-[#1F2D3D]">
                    {rep.resultSummary}
                  </div>
                  {rep.sourceRecordType === 'report' && (
                    <div className="flex flex-wrap items-center gap-2">
                      {rep.fileDataUrl && <button type="button" onClick={() => openOriginalMedicalFile(rep.fileDataUrl)} className="min-h-[36px] px-3 inline-flex items-center rounded-xl border border-[#DDE7EA] bg-white text-xs font-bold text-[#0E7C86]">{ui('View original report')}</button>}
                      {rep.source === 'PATIENT_UPLOAD' && <button type="button" onClick={() => handleRemovePatientReport(rep.id, rep.title || 'this document')} className="min-h-[36px] px-3 rounded-xl border border-rose-200 bg-white text-xs font-bold text-rose-700 hover:bg-rose-50">{ui('Remove my upload')}</button>}
                      {(rep.uploaderRole === 'doctor' || rep.source === 'DOCTOR_UPLOAD' || rep.source === 'PROVIDER_UPLOAD') ? <>
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#1F2D3D]">
                          {ui('Explain in')}
                          <select aria-label={ui('Explain in')} value={reportExplanationLanguage} onChange={(e) => setReportExplanationLanguage(e.target.value as 'en' | 'te' | 'hi')} className="min-h-[40px] px-2 rounded-lg border border-[#DDE7EA] bg-white">
                            <option value="en">English</option><option value="te">తెలుగు</option><option value="hi">हिन्दी</option>
                          </select>
                        </label>
                        <button type="button" onClick={() => requestReportAiExplanation(rep.id)} disabled={summaryLoadingId === rep.id} className="min-h-[44px] px-3 rounded-xl border border-[#DDE7EA] bg-white text-sm font-bold text-[#0E7C86] disabled:opacity-60">
                          {summaryLoadingId === rep.id ? ui('Preparing explanation…') : reportAiExplanations[`${rep.id}:${reportExplanationLanguage}`] ? ui('Regenerate explanation') : ui('Explain This Report')}
                        </button>
                        <label className="w-full flex items-start gap-2 text-[11px] text-[#5B6B7A]">
                          <input type="checkbox" checked={Boolean(externalAiConsent[rep.id])} onChange={(e) => setExternalAiConsent((current) => ({ ...current, [rep.id]: e.target.checked }))} className="mt-0.5 accent-[#0E7C86]" />
                          {ui('I agree to send this report’s de-identified text to the configured AI service. I will use fictional demo data only; this local prototype is not approved for real patient records.')}
                        </label>
                      </> : <button type="button" onClick={() => requestReportSummary(rep.id)} disabled={summaryLoadingId === rep.id} className="min-h-[36px] px-3 rounded-xl border border-[#DDE7EA] bg-white text-xs font-bold text-[#0E7C86] disabled:opacity-60">
                        {summaryLoadingId === rep.id ? 'Preparing report facts…' : reportSummaries[rep.id] ? 'Refresh extracted facts' : 'View extracted report facts'}
                      </button>}
                    </div>
                  )}
                  {summaryErrors[rep.id] && <p role="alert" className="text-xs text-red-700">{summaryErrors[rep.id]}</p>}
                  {reportAiExplanations[`${rep.id}:${reportExplanationLanguage}`] && (() => {
                    const explanation = reportAiExplanations[`${rep.id}:${reportExplanationLanguage}`];
                    const readingSections = getReportExplanationSections(explanation);
                    return (
                      <section className="p-4 rounded-xl border border-[#A7DDE0] bg-white space-y-3" aria-label={ui('AI-generated explanation')}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h5 className="text-sm font-bold text-[#1F2D3D]">{ui('AI-generated explanation')}</h5>
                          <button type="button" onClick={() => void copyReportAiExplanation(rep.id, explanation)} className="min-h-[40px] px-3 rounded-lg border border-[#DDE7EA] text-sm font-semibold text-[#0E7C86]">{copiedExplanationId === rep.id ? ui('Copied') : ui('Copy explanation')}</button>
                        </div>
                        <div><p className="text-xs font-bold text-[#0E7C86]">{ui('What is this report?')}</p><p className="mt-1 text-sm text-[#1F2D3D] whitespace-pre-wrap">{explanation.whatIsThisReport}</p></div>
                        <div><p className="text-xs font-bold text-[#0E7C86]">{ui('Main findings')}</p>{explanation.mainFindings.length ? <ul className="mt-1 list-disc pl-5 text-sm text-[#1F2D3D]">{explanation.mainFindings.map((item: string, index: number) => <li key={index}>{item}</li>)}</ul> : <p className="mt-1 text-sm text-[#5B6B7A]">{ui('No values or reference ranges were provided in the report.')}</p>}</div>
                        <div><p className="text-xs font-bold text-[#0E7C86]">{ui('Important values')}</p>{explanation.importantValues.length ? <ul className="mt-1 list-disc pl-5 text-sm text-[#1F2D3D]">{explanation.importantValues.map((item: any, index: number) => <li key={index}><strong>{item.name}: {item.value}</strong>{item.referenceRange ? ` · ${ui('Reference range')}: ${item.referenceRange}` : ''} · {item.plainMeaning}</li>)}</ul> : <p className="mt-1 text-sm text-[#5B6B7A]">{ui('No values or reference ranges were provided in the report.')}</p>}</div>
                        <div><p className="text-xs font-bold text-[#0E7C86]">{ui('Medical terms')}</p>{explanation.medicalTerms.length ? <ul className="mt-1 list-disc pl-5 text-sm text-[#1F2D3D]">{explanation.medicalTerms.map((item: any, index: number) => <li key={index}><strong>{item.term}:</strong> {item.meaning}</li>)}</ul> : <p className="mt-1 text-sm text-[#5B6B7A]">{ui('No medical terms were explained in this report.')}</p>}</div>
                        <div><p className="text-xs font-bold text-[#0E7C86]">{ui('What this report does not establish')}</p><p className="mt-1 text-sm text-[#1F2D3D] whitespace-pre-wrap">{explanation.whatThisDoesNotEstablish}</p></div>
                        <div><p className="text-xs font-bold text-[#0E7C86]">{ui('Questions for your doctor')}</p>{explanation.questionsForDoctor.length ? <ul className="mt-1 list-disc pl-5 text-sm text-[#1F2D3D]">{explanation.questionsForDoctor.map((item: string, index: number) => <li key={index}>{item}</li>)}</ul> : <p className="mt-1 text-sm text-[#5B6B7A]">{ui('No questions were suggested.')}</p>}</div>
                        <ReportReadAloudControls sections={readingSections} language={reportExplanationLanguage} uiLang={lang} />
                        <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">{REPORT_EXPLANATION_SAFETY_NOTICE}</p>
                      </section>
                    );
                  })()}
                  {reportSummaries[rep.id] && (
                    <section className="p-3 rounded-xl border border-[#DDE7EA] bg-white space-y-2" aria-label="Medical report summary">
                      <h5 className="text-sm font-bold text-[#1F2D3D]">{reportSummaries[rep.id].aiGenerated ? 'AI-generated explanation' : 'Extracted report facts'}</h5>
                      {reportSummaries[rep.id].readable ? <>
                        <div><p className="text-xs font-bold text-[#0E7C86]">{ui('Extracted facts')}</p><ul className="mt-1 list-disc pl-5 space-y-1 text-xs text-[#1F2D3D]">{reportSummaries[rep.id].facts.map((fact: string, index: number) => <li key={index} className="whitespace-pre-wrap">{fact}</li>)}</ul></div>
                        <div><p className="text-xs font-bold text-[#0E7C86]">{ui('Plain-language explanation')}</p><p className="mt-1 text-xs text-[#1F2D3D]">{reportSummaries[rep.id].explanation}</p></div>
                        {reportSummaries[rep.id].questions?.length > 0 && <div><p className="text-xs font-bold text-[#0E7C86]">{ui('Questions to ask your doctor')}</p><ul className="mt-1 list-disc pl-5 text-xs text-[#1F2D3D]">{reportSummaries[rep.id].questions.map((question: string, index: number) => <li key={index}>{question}</li>)}</ul></div>}
                        {reportSummaries[rep.id].aiGenerated && <SpeechButton text={reportSummaries[rep.id].readAloudText || reportSummaries[rep.id].explanation} lang={reportExplanationLanguage === 'te' ? 'TE' : 'EN'} label="Read explanation aloud" />}
                        <p className="text-[11px] text-[#5B6B7A]">{ui('Informational only; this summary does not replace interpretation by a healthcare professional. No diagnosis or treatment advice is provided.')}</p>
                      </> : <p className="text-xs text-[#5B6B7A]">{ui('Could not reliably read this report, so no summary was generated. You can still open the original report for review.')}</p>}
                    </section>
                  )}
                  {rep.sourceRecordType === 'report' && (rep.category === 'Lab reports' || rep.extractedFields?.labValues?.length > 0) && <LabReportExplanationPanel report={rep} lang={lang} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: MY CONSENT */}
        {patientTab === 'CONSENT' && (
          <div className="space-y-4">
            <div className="clay-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={consentShieldImg}
                  alt="Consent Shield"
                  className="w-14 h-14 rounded-2xl object-cover border border-[#DDE7EA]"
                />
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#1F2D3D]">{tr('consentCenterTitle', lang)}</h3>
                  <p className="text-xs text-[#5B6B7A]">{tr('consentCenterInstructions', lang)}</p>
                </div>
              </div>
              <div className="space-y-1"><SpeechButton text={tr('consentInstructionsSpeech', lang)} lang={lang} label={tr('readInstructions', lang)} /><p className="text-[10px] text-[#5B6B7A]">{tr('consentInstructionsSpeech', lang)}</p></div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fetchPatientWallet(activePatientId)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[#0E7C86] bg-white text-xs font-bold text-[#0E7C86] inline-flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" /> Refresh requests
                </button>
                <button
                  type="button"
                  onClick={handleRevokeAll}
                  className="min-h-[44px] px-4 py-2 clay-btn-danger text-xs font-bold cursor-pointer"
                >
                  {t.revokeAllBtn}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {grants.map((g) => (
                <div key={g.id} className="clay-card p-4 sm:p-5 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-bold text-[#1F2D3D]">{g.doctorName}</h4>
                        <FacilityBadge lang={lang}
                          level={g.facilityLevel}
                          type={g.facilityType}
                          name={g.facilityName}
                        />
                      </div>
                      <p className="text-xs text-[#5B6B7A] mt-0.5">
                        Purpose: {g.purpose} · Duration: {g.durationHours}h
                      </p>
                    </div>
                    <StatusChip status={g.status} lang={lang} />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {ALL_CATEGORIES.map((cat) => {
                      const isShared = isMedicalCategoryAuthorized(g, cat as any);
                      return (
                        <span
                          key={cat}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                            isShared
                              ? 'bg-[#ECFDF5] text-[#1E8E5A] border border-[#A7F3D0]'
                              : 'bg-[#FEF2F2] text-[#D32F2F] border border-[#FECACA]'
                          }`}
                        >
                          {isShared ? `✓ ${translateMedicalCategory(cat, lang)}` : `🔒 ${translateMedicalCategory(cat, lang)}`}
                        </span>
                      );
                    })}
                  </div>

                  {g.status === 'GRANTED' && (
                    <div className="pt-2 border-t border-[#DDE7EA] flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handlePatientExtend(g.id)}
                        className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-[#DDE7EA] bg-white text-xs font-bold text-[#0E7C86] cursor-pointer"
                      >
                        {t.extend24hBtn}
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePatientRevoke(g.id)}
                        className="min-h-[40px] px-4 py-1.5 clay-btn-danger text-xs font-bold cursor-pointer"
                      >
                        {t.revokeAccessBtn}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: MY PRIVACY */}
        {patientTab === 'PRIVACY' && (
          <div className="space-y-4">
            <div className="clay-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#1F2D3D]">
                  {ui('Access History')}
                </h3>
                <p className="text-xs text-[#5B6B7A]">
                  {walletData?.auditChainVerification?.simulated
                    ? ui('Simulated access events are saved locally in this browser. This timeline is not tamper-proof or server-verified.')
                    : ui('Server-recorded events, including emergency access, appear here for your review.')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setShowDoctorReportOcrModal(true)} className="min-h-[48px] px-5 py-2.5 rounded-xl border border-[#DDE7EA] bg-white text-[#0E7C86] font-bold text-sm inline-flex items-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4" /><span>{ui('Upload report')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadFhir}
                  className="min-h-[40px] px-3.5 py-1.5 clay-btn-primary text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t.exportFhirBtn}</span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {audits.map((aud: any) => (
                <div key={aud.id} className="clay-card p-4 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#0E7C86]/10 text-[#0E7C86]">
                      {aud.action}
                    </span>
                    <span className="text-xs font-mono text-[#5B6B7A]">
                      {new Date(aud.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[#1F2D3D]">{aud.plainSummary}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // RENDER DOCTOR POINT-OF-CARE CONSOLE PANE
  // ============================================================================
  const renderDoctorPane = () => {
    const isUnlocked = Boolean(doctorRecord && !doctorConsentError);
    const isRevoked = doctorConsentError?.code === 'ACCESS_REVOKED';
    const isExpired = doctorConsentError?.code === 'ACCESS_EXPIRED';
    const doctorMedicalRecords = doctorRecord ? [
      ...(doctorRecord.medicalRecordsSection?.records || []).map((record: any) => ({
        ...record,
        medicalCategory: getMedicalRecordCategory(record),
      })),
      ...(doctorRecord.allergies || []).map((allergy: any) => ({
        id: `doctor-allergy-${allergy.id}`, title: `Allergy: ${allergy.allergen}`,
        resultSummary: `${allergy.severity || ''} · ${allergy.reaction || ''}`,
        medicalCategory: 'Allergies',
      })),
      ...(doctorRecord.medicinesSection?.shared ? [
        ...(doctorRecord.medicinesSection.activeMedicines || []),
        ...(doctorRecord.medicinesSection.pastMedicines || []),
      ].map((medicine: any) => ({
        id: `doctor-medicine-${medicine.id}`, title: `${medicine.name} ${medicine.strength || ''}`.trim(),
        resultSummary: `${medicine.dosage || ''} ${medicine.route || ''} · ${medicine.computedStatus || ''}`,
        medicalCategory: 'Medications & Prescriptions',
      })) : []),
      ...(doctorRecord.prescriptionsSection?.prescriptions || []).map((prescription: any) => ({
        id: `doctor-prescription-${prescription.id}`,
        title: `Prescription · ${prescription.diagnosis || prescription.date || 'Clinical prescription'}`,
        resultSummary: (prescription.medicines || []).map((medicine: any) => `${medicine.name} ${medicine.strength || ''}`.trim()).join(', '),
        medicalCategory: 'Medications & Prescriptions',
      })),
      ...(doctorRecord.historySection?.visits || []).map((visit: any) => ({
        id: `doctor-visit-${visit.id}`, title: visit.diagnosis,
        resultSummary: `${visit.date || ''} · ${visit.chiefComplaint || ''} · ${visit.clinicalNotes || ''}`,
        medicalCategory: 'Consultation History',
      })),
      ...(doctorRecord.historySection?.chronicConditions || []).map((condition: any, index: number) => ({
        id: `doctor-condition-${condition.id || index}`, title: condition.name || condition.simpleLabel,
        resultSummary: `${condition.simpleLabel || ''} · Since ${condition.since || 'date not recorded'}`,
        medicalCategory: getMedicalRecordCategory(condition),
      })),
    ] : [];
    const approvedDoctorCategories = doctorRecord
      ? MEDICAL_RECORD_CATEGORIES.filter((category) => isMedicalCategoryAuthorized(doctorRecord.grant, category as any))
      : [];
    const filteredDoctorMedicalRecords = doctorMedicalRecords.filter((record: any) =>
      !selectedDoctorRecordCategory || record.medicalCategory === selectedDoctorRecordCategory
    );

    return (
      <div className="space-y-5">
        <div className="clay-card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-[#0E7C86]">
                YOUR CLINIC
              </span>
              <h3 className="text-base font-bold text-[#1F2D3D]">
                Select your clinic
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowClinicRegModal(true)}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F5F9FA] border border-[#DDE7EA] text-xs font-bold text-[#0E7C86] hover:bg-white cursor-pointer"
            >
              + Register New Clinic
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {DOCTOR_DIRECTORY.map((doc) => {
              const selected = activeDoctorId === doc.id;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => {
                    setActiveDoctorId(doc.id);
                    fetchDoctorRecord(activePatientId, doc.id);
                    fetchDoctorAuthorizedList(doc.id);
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    selected
                      ? 'border-2 border-[#0E7C86] bg-[#0E7C86]/5 shadow-xs'
                      : 'border-[#DDE7EA] bg-white hover:bg-[#F5F9FA]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-extrabold text-[#0E7C86]">
                      {doc.facilityLevel} LEVEL
                    </span>
                    {selected && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#0E7C86] text-white">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-bold text-[#1F2D3D] mt-1">{doc.name}</div>
                  <div className="text-xs text-[#5B6B7A] truncate">{doc.facilityName}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="clay-card p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-bold text-[#1F2D3D] flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-[#0E7C86]" />
              <span>{ui('Find a patient')}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowScannerModal(true)}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#0E7C86] text-white text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#0A626A] cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{ui('Scan Patient QR')}</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-[#5B6B7A] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="doctor-patient-search"
                type="text"
                value={doctorLookupQuery}
                onChange={(e) => setDoctorLookupQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleDoctorLookup(); } }}
                placeholder="Enter patient HealthPass ID"
                className="w-full min-h-[42px] pl-9 pr-3 py-1.5 rounded-xl border border-[#DDE7EA] bg-[#F5F9FA] text-xs font-mono font-bold text-[#1F2D3D]"
              />
            </div>
            <button
              type="button"
              onClick={() => handleDoctorLookup()}
              className="min-h-[42px] px-4 py-2 clay-btn-primary text-xs font-bold cursor-pointer"
            >
              Find patient
            </button>
          </div>
        </div>

        {!isUnlocked ? (
          <div id="doctor-access-request" className="space-y-4">
            {preConsentIdentity && (
              <div className="clay-card p-4 sm:p-5 border-l-4 border-l-[#0E7C86] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-extrabold tracking-wider text-[#0E7C86]">
                    PRE-CONSENT IDENTITY ONLY (ZERO CLINICAL DATA)
                  </span>
                  <h3 className="text-lg font-bold text-[#1F2D3D] mt-0.5">
                    {preConsentIdentity.name}
                  </h3>
                  <div className="text-xs font-mono font-bold text-[#5B6B7A] mt-0.5">
                    Verified ID: {preConsentIdentity.healthPassId}
                  </div>
                </div>
                <span className="px-3 py-1.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-bold text-[#D32F2F] inline-flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>{ui('Clinical Data Locked')}</span>
                </span>
              </div>
            )}

            <LockAnimation
              lang={lang}
              isUnlocked={false}
              revokedByPatient={isRevoked}
              expiredAccess={isExpired}
              denialCode={doctorConsentError?.code || 'NO_CONSENT'}
              title={doctorConsentError?.screenTitle}
              subtitle={doctorConsentError?.screenSubtitle}
              onAction={() => handleDoctorRequestAccess()}
              actionLabel={doctorConsentError?.primaryActionLabel || 'Request access'}
            />

            <div className="clay-card p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-base font-bold text-[#1F2D3D]">
                  Request Patient Consent as {currentDoctorObj.name}
                </h4>
                <FacilityBadge
                  level={currentDoctorObj.facilityLevel}
                  name={currentDoctorObj.facilityName}
                  lang={lang}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#1F2D3D] mb-1">{ui('Purpose')}</label>
                  <input
                    type="text"
                    value={requestPurpose}
                    onChange={(e) => setRequestPurpose(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] bg-white text-xs text-[#1F2D3D]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1F2D3D] mb-1">{ui('Duration')}</label>
                  <select
                    value={requestDurationHours}
                    onChange={(e) => setRequestDurationHours(Number(e.target.value))}
                    className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] bg-white text-xs font-bold"
                  >
                    <option value={1}>1 Hour</option>
                    <option value={12}>12 Hours</option>
                    <option value={24}>24 Hours (Default)</option>
                    <option value={48}>48 Hours</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-[#DDE7EA]">
                <button
                  type="button"
                  onClick={() => handleDoctorRequestAccess()}
                  className="min-h-[44px] px-6 py-2.5 clay-btn-primary text-xs font-bold cursor-pointer"
                >
                  Send Access Request ({requestDurationHours}h)
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex-1 min-w-[260px]">
                <AccessTimer
                  expiresAt={doctorRecord.grant?.expiresAt}
                  lang={lang}
                  onExpired={() => fetchDoctorRecord(activePatientId, activeDoctorId)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPrefillConsultMed(null);
                    setShowConsultationModal(true);
                  }}
                  className="min-h-[48px] px-5 py-2.5 clay-btn-primary font-bold text-sm inline-flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t.addConsultation}</span>
                </button>
              </div>
            </div>

            <PatientBanner patient={doctorRecord.patient} recordOpenSeconds={recordOpenSeconds} lang={lang} />

            {doctorRecord.healthProfileSection?.shared && <section className="clay-card p-4 space-y-2">
              <h3 className="text-sm font-bold text-[#1F2D3D]">{ui('Patient Health Profile · Consent-shared details')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {([['Known allergies',doctorRecord.healthProfileSection.profile?.knownAllergies],['Current medications',doctorRecord.healthProfileSection.profile?.currentMedications],['Existing health conditions',doctorRecord.healthProfileSection.profile?.healthConditions],['Relevant past surgeries',doctorRecord.healthProfileSection.profile?.pastSurgeries],['Blood group',doctorRecord.healthProfileSection.profile?.bloodGroup],['Emergency contact',[doctorRecord.healthProfileSection.profile?.emergencyContactName,doctorRecord.healthProfileSection.profile?.emergencyContactRelation,doctorRecord.healthProfileSection.profile?.emergencyContactPhone].filter(Boolean).join(' · ')]] as const).filter(([,value]) => value).map(([label,value]) => <div key={label} className="p-2 rounded-lg bg-[#F5F9FA] border border-[#DDE7EA]"><b>{label}: </b>{value}</div>)}
              </div>
              <p className="text-[10px] text-[#5B6B7A]">Source: {doctorRecord.healthProfileSection.profile?.source || 'Unknown'} · Status: {doctorRecord.healthProfileSection.profile?.verificationStatus || 'Unknown'} · Updated: {doctorRecord.healthProfileSection.profile?.updatedAt ? new Date(doctorRecord.healthProfileSection.profile.updatedAt).toLocaleDateString() : 'Unknown'}</p>
            </section>}

            <AllergyBanner allergies={doctorRecord.allergies} lang={lang} />

            <div className="space-y-3">
              <h3 className="text-base font-bold text-[#1F2D3D] flex items-center gap-2">
                <Pill className="w-4 h-4 text-[#0E7C86]" />
                <span>1. Active Medicines & Prescriptions</span>
              </h3>
              {doctorRecord.medicinesSection?.shared ? (
                <div className="space-y-3">
                  {doctorRecord.medicinesSection.activeMedicines.map((med: any) => (
                    <RxSlipCard
                      key={med.id}
                      med={med}
                      lang={lang}
                      isPatientView={false}
                      onDoctorRepeatOrContinue={(m) => handleDoctorRepeatMedicineDirect(m)}
                    />
                  ))}
                </div>
              ) : (
                <div className="clay-card p-4 border border-[#DDE7EA] text-xs font-bold text-[#5B6B7A]">
                  Medicines category withheld by patient.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-bold text-[#1F2D3D] flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-[#1769AA]" />
                <span>2. Medical History & Consultations</span>
              </h3>
              {doctorRecord.historySection?.shared ? (
                <div className="clay-card p-4 space-y-3">
                  <div className="space-y-2">
                    {doctorRecord.historySection.visits.map((v: any) => (
                      <div key={v.id} className="p-3 rounded-xl bg-[#F5F9FA] text-xs space-y-1">
                        <div className="font-bold text-[#1F2D3D]">{v.date} — {v.diagnosis}</div>
                        <div className="text-[#5B6B7A]">{v.doctorName} · {v.clinicalNotes}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="clay-card p-4 border border-[#DDE7EA] text-xs font-bold text-[#5B6B7A]">
                  History category withheld by patient.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-bold text-[#1F2D3D] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0E7C86]" />
                <span>3. Categorized Medical Records</span>
              </h3>
              <p className="text-xs text-[#5B6B7A]">{ui('Categories marked approved were shared by the patient for this session.')}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {MEDICAL_RECORD_CATEGORIES.map((category) => {
                  const Icon = MEDICAL_CATEGORY_ICON[category] || FileText;
                  const approved = approvedDoctorCategories.includes(category);
                  const count = doctorMedicalRecords.filter((record: any) => record.medicalCategory === category).length;
                  const selected = selectedDoctorRecordCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      disabled={!approved}
                      onClick={() => setSelectedDoctorRecordCategory(selected ? null : category)}
                      aria-pressed={selected}
                      className={`min-h-[88px] p-3 rounded-2xl border text-left transition-colors ${approved ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'} ${selected ? 'border-[#0E7C86] bg-[#0E7C86]/10 ring-1 ring-[#0E7C86]' : approved ? 'border-[#A7F3D0] bg-[#ECFDF5] hover:bg-[#DFF8EC]' : 'border-[#DDE7EA] bg-[#F5F9FA]'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Icon className={`w-4 h-4 shrink-0 ${approved ? 'text-[#0E7C86]' : 'text-[#8796A2]'}`} />
                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${approved ? 'bg-white text-[#1E8E5A]' : 'bg-white text-[#8796A2]'}`}>
                          {approved ? 'APPROVED' : 'NOT SHARED'}
                        </span>
                      </div>
                      <div className="mt-2 text-xs font-bold leading-snug text-[#1F2D3D]">{translateMedicalCategory(category, lang)}</div>
                      {approved && <div className="mt-1 text-[11px] text-[#5B6B7A]">{count} record{count === 1 ? '' : 's'}</div>}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-[#1F2D3D]">
                  {selectedDoctorRecordCategory || 'All approved categories'}
                </h4>
                {selectedDoctorRecordCategory && <button type="button" onClick={() => setSelectedDoctorRecordCategory(null)} className="min-h-[34px] px-3 rounded-xl border border-[#DDE7EA] bg-white text-xs font-bold text-[#0E7C86] cursor-pointer">{ui('Show all approved')}</button>}
              </div>
              {filteredDoctorMedicalRecords.length ? (
                <div className="space-y-3">
                  {filteredDoctorMedicalRecords.map((record: any) => (
                    <div key={record.id} className="clay-card p-4 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-[#1F2D3D]">{record.title}</h4>
                        <span className="px-2.5 py-1 rounded-lg bg-[#0E7C86]/10 text-[#0E7C86] text-[11px] font-bold">{record.medicalCategory}</span>
                      </div>
                      <p className="text-xs text-[#5B6B7A]">{record.resultSummary}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="clay-card p-4 border border-[#DDE7EA] text-xs font-bold text-[#5B6B7A]">
                  No records are available for this approved category.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`min-h-screen flex flex-col ${
        highContrast ? 'high-contrast' : ''
      } ${fontScale === 'large' ? 'text-[17px]' : fontScale === 'xlarge' ? 'text-[19px]' : ''}`}
    >
      {/* Global navigation */}
      <header className="hp-site-header sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl no-print" onKeyDown={(event) => { if (event.key === 'Escape') { setShowMoreRolesDropdown(false); setShowLanguageDropdown(false); setMobileMenuOpen(false); } }}>
        <div className="hp-header-inner max-w-[1440px] mx-auto px-3 sm:px-6 min-h-16 flex items-center justify-between gap-2 sm:gap-4">
          <button type="button" onClick={() => { if (loggedInUser?.role === 'patient') { setMode('PATIENT'); setPatientTab('HEALTH'); } else if (loggedInUser?.role === 'doctor') { setMode('DOCTOR'); setProviderNavGroup('WORKSPACE'); } else { handleNavigateHome(); } setMobileMenuOpen(false); }} className="hp-brand flex items-center gap-3 text-left shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C86]" title="HealthPass home">
            <span className="hp-brand-mark" aria-hidden="true"><HeartPulse className="w-6 h-6 text-white relative z-10" /></span>
            <span className="font-display font-extrabold text-[1.65rem] sm:text-[1.85rem] leading-none tracking-tight text-slate-900">HealthPass</span>
          </button>

          <nav aria-label="Primary navigation" className="hp-desktop-nav hidden xl:flex items-center justify-center gap-1">
            {loggedInUser?.role === 'patient' || mode === 'PATIENT' ? <>
              <button type="button" onClick={() => { setMode('PATIENT'); setPatientTab('HEALTH'); }} aria-current={mode === 'PATIENT' && patientTab === 'HEALTH' ? 'page' : undefined} className={`hp-nav-link ${mode === 'PATIENT' && patientTab === 'HEALTH' ? 'hp-nav-active' : ''}`}>{ui('Dashboard')}</button>
              <button type="button" onClick={() => { setMode('PATIENT'); setPatientTab('REPORTS'); }} aria-current={mode === 'PATIENT' && patientTab === 'REPORTS' ? 'page' : undefined} className={`hp-nav-link ${mode === 'PATIENT' && patientTab === 'REPORTS' ? 'hp-nav-active' : ''}`}>{ui('My Health')}</button>
              <button type="button" onClick={() => { setMode('PATIENT'); setPatientTab('CONSENT'); }} aria-current={mode === 'PATIENT' && patientTab === 'CONSENT' ? 'page' : undefined} className={`hp-nav-link ${mode === 'PATIENT' && patientTab === 'CONSENT' ? 'hp-nav-active' : ''}`}>{ui('Access Requests')}</button>
            </> : loggedInUser?.role === 'doctor' || mode === 'DOCTOR' ? <>
              <button type="button" onClick={() => { setMode('DOCTOR'); setProviderNavGroup('WORKSPACE'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-current={mode === 'DOCTOR' && providerNavGroup === 'WORKSPACE' ? 'page' : undefined} className={`hp-nav-link ${mode === 'DOCTOR' && providerNavGroup === 'WORKSPACE' ? 'hp-nav-active' : ''}`}>{ui('Dashboard')}</button>
              <button type="button" onClick={() => { setMode('DOCTOR'); window.setTimeout(() => document.getElementById('doctor-patient-search')?.focus(), 0); }} className="hp-nav-link">{ui('Find Patient')}</button>
              <button type="button" onClick={() => { setMode('DOCTOR'); window.setTimeout(() => document.getElementById('doctor-access-request')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0); }} className="hp-nav-link">{ui('Access Requests')}</button>
              <button type="button" onClick={() => { setMode('DOCTOR'); if (doctorRecord) setShowConsultationModal(true); else window.setTimeout(() => document.getElementById('doctor-access-request')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0); }} className="hp-nav-link">{ui('Consultations')}</button>
            </> : <>
              <button type="button" onClick={handleNavigateHome} aria-current={mode === 'LANDING' ? 'page' : undefined} className={`hp-nav-link ${mode === 'LANDING' ? 'hp-nav-active' : ''}`}>{tr('navHome', lang)}</button>
              <button type="button" onClick={handleNavigateHowItWorks} className="hp-nav-link">{tr('howItWorks', lang)}</button>
            </>}
            <button type="button" onClick={() => { setMode('PATIENT'); setPatientTab('HEALTH'); }} aria-current={mode === 'PATIENT' ? 'page' : undefined} className={`hp-nav-link ${mode === 'PATIENT' ? 'hp-nav-active' : ''}`}>{tr('patientPortal', lang)}</button>
            <button type="button" onClick={() => setMode('DOCTOR')} aria-current={mode === 'DOCTOR' ? 'page' : undefined} className={`hp-nav-link ${mode === 'DOCTOR' ? 'hp-nav-active' : ''}`}>{tr('doctorPortal', lang)}</button>
            <button type="button" onClick={() => setMode('EMERGENCY')} aria-current={mode === 'EMERGENCY' ? 'page' : undefined} className={`hp-nav-link hp-emergency-link ${mode === 'EMERGENCY' ? 'hp-emergency-active' : ''}`}>{tr('navEmergencyRecords', lang)}</button>
          </nav>

          <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
            <div className="relative">
              <button type="button" onClick={() => { setShowLanguageDropdown(!showLanguageDropdown); setShowMoreRolesDropdown(false); }} aria-expanded={showLanguageDropdown} aria-haspopup="menu" className="hp-header-control" title={tr('languageSelector', lang)}>
                <Globe className="w-4 h-4 text-[#0E7C86] shrink-0" /><span className="hidden sm:inline">{LANG_META[lang]?.nativeName || 'English'}</span><ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              {showLanguageDropdown && <>
                <button type="button" aria-label="Close language menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setShowLanguageDropdown(false)} />
                <div role="menu" aria-label={tr('languageSelector', lang)} className="absolute top-full right-0 mt-2 w-56 max-h-[70vh] overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50">
                  {PRIMARY_UI_LANGUAGES.map((sl) => { const meta = LANG_META[sl]; const selected = lang === sl; return <button role="menuitemradio" aria-checked={selected} key={sl} type="button" onClick={() => { setLang(sl); setShowLanguageDropdown(false); setMobileMenuOpen(false); }} className={`w-full min-h-11 text-left px-3 py-2 rounded-xl text-sm font-semibold flex items-center justify-between ${selected ? 'bg-[#0E7C86] text-white' : 'text-slate-700 hover:bg-slate-50'}`}><span>{meta.nativeName}</span><span className="text-xs opacity-75">{meta.label}</span></button>; })}
                </div>
              </>}
            </div>
            <div className="relative">
              <button type="button" onClick={() => { setShowMoreRolesDropdown(!showMoreRolesDropdown); setShowLanguageDropdown(false); }} aria-expanded={showMoreRolesDropdown} aria-haspopup="menu" className="hp-header-control"><MoreHorizontal className="w-5 h-5 text-[#0E7C86]" /><span className="hidden sm:inline">{ui('More')}</span><ChevronDown className="w-3 h-3 text-slate-400" /></button>
              {showMoreRolesDropdown && <>
                <button type="button" aria-label="Close more menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setShowMoreRolesDropdown(false)} />
                <div role="menu" aria-label="More options" className="absolute top-full right-0 mt-2 w-64 max-h-[75vh] overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50">
                  {loggedInUser && <div className="px-3 py-2 border-b border-slate-100 mb-1"><div className="text-sm font-bold text-slate-900">{loggedInUser.name}</div><div className="text-xs text-slate-500 truncate">{loggedInUser.email}</div></div>}
                  <button role="menuitem" type="button" onClick={() => { handleNavigateHowItWorks(); setShowMoreRolesDropdown(false); }} className="hp-menu-item">{tr('howItWorks', lang)}</button>
                  <button role="menuitem" type="button" onClick={() => { setMode('SPLIT_DEMO'); setShowMoreRolesDropdown(false); setMobileMenuOpen(false); }} className="hp-menu-item">{tr('splitScreenMode', lang)}</button>
                  <button role="menuitem" type="button" onClick={() => { setShowMoreRolesDropdown(false); void handleResetDemo('CLEAN_LOCKED'); }} className="hp-menu-item text-rose-700"><RefreshCw className="w-4 h-4" /> {ui('Reset demo data')}</button>
                  <div className="px-3 pt-2 pb-1 text-xs font-bold text-slate-400 uppercase">{ui('Other portals')}</div>
                  {([['PHARMACY', 'Jan Aushadhi Pharmacy'], ['LAB', 'Diagnostic Lab'], ['ADMIN', 'Registry Admin']] as const).map(([portal, label]) => <button role="menuitem" key={portal} type="button" onClick={() => { setMode(portal); setShowMoreRolesDropdown(false); setMobileMenuOpen(false); }} className="hp-menu-item">{label}</button>)}
                  {!loggedInUser ? <button role="menuitem" type="button" onClick={() => { setShowLoginModal(true); setShowMoreRolesDropdown(false); }} className="hp-menu-item text-[#0E7C86]">{ui('Sign in')}</button> : <button role="menuitem" type="button" onClick={() => { setShowMoreRolesDropdown(false); void handleLogout(); }} className="hp-menu-item text-rose-700">{<LogOut className="w-4 h-4" />} Sign out</button>}
                </div>
              </>}
            </div>
          </div>
        </div>
        <nav id="mobile-navigation" aria-label="Primary navigation" className="xl:hidden border-t border-slate-200 bg-white px-3 sm:px-6 py-2">
          <div className="flex gap-2 overflow-x-auto">
            {loggedInUser?.role === 'patient' || mode === 'PATIENT' ? <>
              <button type="button" onClick={() => { setMode('PATIENT'); setPatientTab('HEALTH'); setMobileMenuOpen(false); }} className="hp-mobile-link">{ui('Dashboard')}</button>
              <button type="button" onClick={() => { setMode('PATIENT'); setPatientTab('REPORTS'); setMobileMenuOpen(false); }} className="hp-mobile-link">{ui('My Health')}</button>
              <button type="button" onClick={() => { setMode('PATIENT'); setPatientTab('CONSENT'); setMobileMenuOpen(false); }} className="hp-mobile-link">{ui('Access Requests')}</button>
            </> : loggedInUser?.role === 'doctor' || mode === 'DOCTOR' ? <>
              <button type="button" onClick={() => { setMode('DOCTOR'); setProviderNavGroup('WORKSPACE'); setMobileMenuOpen(false); }} className="hp-mobile-link">{ui('Dashboard')}</button>
              <button type="button" onClick={() => { setMode('DOCTOR'); setMobileMenuOpen(false); window.setTimeout(() => document.getElementById('doctor-patient-search')?.focus(), 0); }} className="hp-mobile-link">{ui('Find Patient')}</button>
              <button type="button" onClick={() => { setMode('DOCTOR'); setMobileMenuOpen(false); window.setTimeout(() => document.getElementById('doctor-access-request')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0); }} className="hp-mobile-link">{ui('Access Requests')}</button>
              <button type="button" onClick={() => { setMode('DOCTOR'); setMobileMenuOpen(false); if (doctorRecord) setShowConsultationModal(true); else window.setTimeout(() => document.getElementById('doctor-access-request')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0); }} className="hp-mobile-link">{ui('Consultations')}</button>
            </> : <>
              <button type="button" onClick={() => { handleNavigateHome(); }} className="hp-mobile-link">{tr('navHome', lang)}</button>
              <button type="button" onClick={() => { handleNavigateHowItWorks(); }} className="hp-mobile-link">{tr('howItWorks', lang)}</button>
            </>}
            <button type="button" onClick={() => { setMode('PATIENT'); setPatientTab('HEALTH'); }} aria-current={mode === 'PATIENT' ? 'page' : undefined} className={`hp-mobile-link ${mode === 'PATIENT' ? 'hp-nav-active' : ''}`}>{tr('patientPortal', lang)}</button>
            <button type="button" onClick={() => setMode('DOCTOR')} aria-current={mode === 'DOCTOR' ? 'page' : undefined} className={`hp-mobile-link ${mode === 'DOCTOR' ? 'hp-nav-active' : ''}`}>{tr('doctorPortal', lang)}</button>
            <button type="button" onClick={() => setMode('EMERGENCY')} aria-current={mode === 'EMERGENCY' ? 'page' : undefined} className="hp-mobile-link hp-mobile-emergency">{tr('navEmergencyRecords', lang)}</button>
          </div>
        </nav>
      </header>

      {/* LIVE TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md clay-card border-2 border-[#0E7C86] bg-white p-4 shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#1E8E5A] shrink-0" />
          <div className="text-xs font-bold text-[#1F2D3D]">{toastMessage}</div>
        </div>
      )}

      {/* MAIN WORKSPACE CONTENT */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">
        <div role="note" className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p><strong>Local-only hackathon demo.</strong> Example records and changes stay in this browser. Sign-in and consent are simulated and are not secure identity verification or backend authorization. Do not enter real medical information.</p>
        </div>
        {demoStorageWarning && <div role="alert" className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{demoStorageWarning}</div>}
        {/* MODE 1: LANDING */}
        {mode === 'LANDING' && (
          <div className="mx-auto max-w-6xl space-y-14 py-6 sm:py-12">
            <section className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-[#0E7C86]">
                  <HeartPulse className="h-4 w-4" />
                  <span>Your health information, together</span>
                </div>
                <div className="space-y-3">
                  <h1 className="max-w-xl text-4xl font-extrabold leading-tight tracking-tight text-[#1F2D3D] sm:text-5xl">
                    Your health record. <span className="text-[#0E7C86]">In your hands.</span>
                  </h1>
                  <p className="max-w-xl text-lg leading-relaxed text-[#5B6B7A]">
                    Keep your medical information in one place. Share it with a doctor when you choose.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => { setMode('PATIENT'); setPatientTab('HEALTH'); }}
                    className="min-h-12 rounded-xl clay-btn-primary px-5 py-3 text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Smartphone className="h-4 w-4" />
                    Open my health record
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNavigateHowItWorks}
                    className="min-h-12 rounded-xl border border-[#DDE7EA] bg-white px-5 py-3 text-sm font-bold text-[#1F2D3D] hover:bg-[#F5F9FA] inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4 text-[#0E7C86]" />
                    See how it works
                  </button>
                </div>
                <p className="text-sm text-[#5B6B7A]">You stay in control of when your information is shared.</p>
              </div>

              <div className="relative mx-auto flex min-h-[340px] w-full max-w-lg items-center justify-center overflow-hidden rounded-[2rem] border border-teal-100 bg-gradient-to-br from-[#F0FBFA] via-white to-[#EAF4FC] p-6 sm:min-h-[390px]" aria-label="Animation showing a patient sharing a health record with a doctor">
                <div className="absolute h-64 w-64 rounded-full bg-teal-100/60 blur-3xl" />
                <div className="healthpass-orbit absolute h-64 w-64 rounded-full border border-dashed border-teal-300/80 sm:h-72 sm:w-72" />
                <div className="healthpass-float relative z-10 w-48 rounded-2xl border border-teal-100 bg-white p-4 shadow-xl sm:w-56">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-[#0E7C86]"><HeartPulse className="h-5 w-5" /></div>
                    <div><div className="text-sm font-bold text-[#1F2D3D]">My health record</div><div className="text-xs text-[#5B6B7A]">Saved with me</div></div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="h-2 w-4/5 rounded-full bg-slate-100" />
                    <div className="h-2 w-3/5 rounded-full bg-slate-100" />
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-800"><Lock className="h-3.5 w-3.5" /> Shared with permission</div>
                  </div>
                </div>
                <div className="healthpass-doctor-float absolute bottom-8 right-5 z-20 rounded-2xl border border-blue-100 bg-white p-3 shadow-lg sm:bottom-10 sm:right-8">
                  <div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#1769AA]"><Stethoscope className="h-4 w-4" /></div><div><div className="text-xs font-bold text-[#1F2D3D]">Your doctor</div><div className="text-[11px] text-[#5B6B7A]">Sees shared details</div></div></div>
                </div>
                <div className="healthpass-share absolute left-6 top-9 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white bg-[#0E7C86] text-white shadow-lg sm:left-10 sm:top-12"><ArrowRight className="h-5 w-5" /></div>
                <span className="sr-only">Your record stays with you. You choose to share it, and your doctor sees the information you allow.</span>
              </div>
            </section>

          </div>
        )}
        {mode === 'HOW_IT_WORKS' && (
          <HowItWorksWalkthrough
            lang={lang}
            onTryPatientDemo={() => { setActivePatientId('pat-1'); setMode('PATIENT'); setPatientTab('HEALTH'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            onTryDoctorDemo={() => { setActiveDoctorId('doc-village'); setMode('DOCTOR'); setProviderNavGroup('WORKSPACE'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
        )}
        {/* MODE 2: SPLIT_DEMO */}
        {mode === 'SPLIT_DEMO' && (
          <div className="space-y-5">
            <div className="clay-card p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1E8E5A]" />
                  <h2 className="text-base sm:text-lg font-bold text-[#1F2D3D]">
                    See how sharing works
                  </h2>
                </div>
                <p className="text-xs text-[#5B6B7A]">
                  The patient chooses what to share. The doctor sees only approved information.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleResetDemo('CLEAN_LOCKED')}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F5F9FA] border border-[#DDE7EA] text-xs font-bold text-[#1F2D3D] hover:bg-white inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#0E7C86]" />
                  <span>Reset demo</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleResetDemo('PENDING_REQUEST')}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#FFFBEB] border border-[#E8A317] text-xs font-bold text-[#92400E] cursor-pointer"
                >
                  Show a request
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <div className="xl:col-span-6 space-y-3">
                <div className="px-4 py-2.5 rounded-2xl bg-[#0E7C86] text-white flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <Smartphone className="w-4 h-4" />
                    <span>Patient view</span>
                  </div>
                  <span className="font-mono text-xs">
                    {walletData?.patient?.healthPassId || 'HP-DEMO-0417'}
                  </span>
                </div>
                {renderPatientPane(true)}
              </div>

              <div className="xl:col-span-6 space-y-3">
                <div className="px-4 py-2.5 rounded-2xl bg-[#1769AA] text-white flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <Stethoscope className="w-4 h-4" />
                    <span>
                      Doctor view · {currentDoctorObj.name}
                    </span>
                  </div>
                  <span className="font-mono text-xs">{currentDoctorObj.facilityName}</span>
                </div>
                {renderDoctorPane()}
              </div>
            </div>
          </div>
        )}

        {/* MODE 3: PATIENT DASHBOARD */}
        {mode === 'PATIENT' && (
          <div className="mx-auto max-w-6xl space-y-5">
            <section className="rounded-2xl border border-teal-100 bg-gradient-to-r from-white to-teal-50 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#0E7C86]">{ui('PATIENT')}</p>
                  <h1 className="mt-1 text-2xl font-bold text-[#1F2D3D]">{ui('Your health dashboard')}</h1>
                  <p className="mt-1 text-sm text-[#5B6B7A]">{ui('Your records, medicines, and sharing choices in one place.')}</p>
                </div>
                <button type="button" onClick={() => setPatientTab('CONSENT')} className="min-h-10 rounded-xl border border-teal-200 bg-white px-4 py-2 text-sm font-bold text-[#0E7C86] hover:bg-teal-50 cursor-pointer inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> Manage sharing
                </button>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-white/90 p-3"><div className="text-xs text-[#5B6B7A]">{ui('Visits on record')}</div><div className="mt-1 text-xl font-bold text-[#1F2D3D]">{walletData?.record?.visits?.length || 0}</div></div>
                <div className="rounded-xl bg-white/90 p-3"><div className="text-xs text-[#5B6B7A]">{ui('Current medicines')}</div><div className="mt-1 text-xl font-bold text-[#1F2D3D]">{walletData?.record?.medicines?.filter((medicine: any) => medicine.computedStatus === 'ACTIVE').length || 0}</div></div>
                <div className="rounded-xl bg-white/90 p-3"><div className="text-xs text-[#5B6B7A]">{ui('Requests to review')}</div><div className="mt-1 text-xl font-bold text-[#1F2D3D]">{walletData?.grants?.filter((grant: any) => grant.status === 'PENDING').length || 0}</div></div>
              </div>
            </section>
            {renderPatientPane(false)}
          </div>
        )}

        {/* MODE 4: DOCTOR DASHBOARD */}
        {mode === 'DOCTOR' && (
          <div className="mx-auto max-w-6xl space-y-5">
            <section className="rounded-2xl border border-blue-100 bg-gradient-to-r from-white to-blue-50 p-5 sm:p-6">
              <p className="text-sm font-semibold text-[#1769AA]">{ui('CARE TEAM')}</p>
              <h1 className="mt-1 text-2xl font-bold text-[#1F2D3D]">{ui('Doctor dashboard')}</h1>
              <p className="mt-1 text-sm text-[#5B6B7A]">{ui('Find a patient, request permission, and review the information shared with you.')}</p>
            </section>
            {renderDoctorPane()}
          </div>
        )}

        {/* MODE 4B: EMERGENCY */}
        {mode === 'EMERGENCY' && (
          <div className="max-w-6xl mx-auto">
            <EmergencyRecordsWorkspace
              doctorId={activeDoctorId}
              doctorName={currentDoctorObj.name}
              facilityName={currentDoctorObj.facilityName}
              lang={lang}
              onNotify={showToast}
            />
          </div>
        )}

        {/* MODE 5: PHARMACY */}
        {mode === 'PHARMACY' && (
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="clay-card border-l-4 border-l-[#0E7C86] p-5 space-y-2">
              <span className="text-xs font-extrabold text-[#0E7C86]">PHARMACIST DASHBOARD · DEMO ONLY</span>
              <h2 className="text-xl font-bold text-[#1F2D3D]">{ui('Prescription access')}</h2>
              <p className="text-sm text-[#5B6B7A]">{ui('A HealthPass ID identifies a patient; it does not give access. The patient must approve before prescriptions are shown.')}</p>
              <p className="text-xs font-semibold text-amber-800">The pharmacist demo account is fictional and is not verified for real patient access.</p>
            </div>
            {loggedInUser?.role === 'pharmacy' ? <form onSubmit={handlePharmacyRequestAccess} className="clay-card p-4 sm:p-5 space-y-3">
              <label htmlFor="pharmacy-healthpass-id" className="block text-sm font-bold text-[#1F2D3D]">{ui('Patient HealthPass ID')}</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input id="pharmacy-healthpass-id" value={pharmacyLookupQuery} onChange={(event) => setPharmacyLookupQuery(event.target.value)} placeholder="Example: HP-DEMO-0417" autoComplete="off" required className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#DDE7EA] bg-white px-3 text-sm font-mono" />
                <button type="submit" className="min-h-11 rounded-xl bg-[#0E7C86] px-4 text-sm font-bold text-white hover:bg-[#0A626A]">Find patient &amp; request access</button>
              </div>
              <p className="text-xs text-[#5B6B7A]">{ui('The request is limited to prescriptions. No allergy, lab, or medical-history access is requested.')}</p>
            </form> : <div className="clay-card flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="text-sm text-[#5B6B7A]">Sign in with the existing pharmacist demo account to try this workflow.</p>
              <button type="button" onClick={() => { setLoginEmail('pharmacy@demo.com'); setLoginPassword('Demo@123'); setShowLoginModal(true); }} className="min-h-11 rounded-xl bg-[#0E7C86] px-4 text-sm font-bold text-white hover:bg-[#0A626A]">{ui('Sign in as pharmacist')}</button>
            </div>}
            {pharmacyData?.error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{pharmacyData.error}</div>}
            {pharmacyData?.patient && <section className="space-y-4" aria-live="polite">
              <div className="clay-card flex flex-wrap items-center justify-between gap-2 p-4">
                <div><p className="text-xs font-bold text-[#5B6B7A]">Patient identity · demo record</p><h3 className="mt-1 text-base font-bold text-[#1F2D3D]">{pharmacyData.patient.name}</h3><p className="font-mono text-xs text-[#0E7C86]">{pharmacyData.patient.healthPassId || pharmacyData.grant?.patientId}</p></div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-extrabold text-slate-700">{pharmacyData.accessStatus === 'ACTIVE' ? 'CONSENT ACTIVE' : pharmacyData.accessStatus === 'PENDING' ? 'WAITING FOR PATIENT' : pharmacyData.accessStatus === 'REJECTED' ? 'REQUEST REJECTED' : pharmacyData.accessStatus === 'REVOKED' ? 'ACCESS REVOKED' : pharmacyData.accessStatus === 'EXPIRED' ? 'ACCESS EXPIRED' : 'NO ACTIVE ACCESS'}</span>
              </div>
              {pharmacyData.accessStatus !== 'ACTIVE' ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                {pharmacyData.accessStatus === 'PENDING' ? 'The patient has not decided yet. Prescription details remain hidden.' : pharmacyData.accessStatus === 'REJECTED' ? 'The patient rejected this request. Prescription details remain hidden.' : pharmacyData.accessStatus === 'REVOKED' ? 'The patient revoked access. Prescription details are no longer available.' : pharmacyData.accessStatus === 'EXPIRED' ? 'The consent period ended. Request access again if needed.' : 'Prescription details are unavailable until the patient approves a request.'}
              </div> : <>
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-bold text-[#1F2D3D]">{ui('Prescriptions')}</h3><p className="text-xs font-semibold text-[#5B6B7A]">Consent expires: {pharmacyData.grant?.expiresAt ? new Date(pharmacyData.grant.expiresAt).toLocaleString() : 'Not available'}</p></div>
                {pharmacyData.prescriptions?.length ? pharmacyData.prescriptions.map((rx: any) => <article key={rx.id} className="clay-card p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="text-base font-bold text-[#1F2D3D]">{rx.medicationName || 'Medicine name not recorded'} {rx.strength && <span className="font-mono text-[#0E7C86]">{rx.strength}</span>}</h4><p className="text-xs text-[#5B6B7A]">Prescribed by {rx.prescribingClinician || 'Not recorded'} · {rx.prescriptionDate ? new Date(rx.prescriptionDate).toLocaleDateString() : 'Date not recorded'}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${rx.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800' : rx.status === 'EXPIRED' ? 'bg-amber-50 text-amber-800' : rx.status === 'CANCELLED' || rx.status === 'DISCONTINUED' ? 'bg-slate-100 text-slate-700' : 'bg-rose-50 text-rose-700'}`}>{rx.status}</span></div>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">{([['Dosage', rx.dosage], ['Route', rx.route], ['Frequency', typeof rx.frequency === 'object' && rx.frequency ? Object.entries(rx.frequency).filter(([, count]) => Number(count) > 0).map(([time, count]) => `${time}: ${count}`).join(', ') : rx.frequency], ['Duration', rx.duration], ['Valid until', rx.validUntil ? new Date(rx.validUntil).toLocaleDateString() : 'Not recorded'], ['Instructions', rx.instructions]] as const).map(([label, value]) => <div key={label} className="rounded-lg bg-[#F5F9FA] px-3 py-2"><dt className="text-xs font-bold text-[#5B6B7A]">{label}</dt><dd className="mt-0.5 text-[#1F2D3D]">{value || 'Not recorded'}</dd></div>)}</dl>
                  {!rx.validUntil && <p className="text-xs font-semibold text-amber-800">Expiry information is not recorded for this prescription.</p>}
                </article>) : <div className="clay-card p-4 text-sm text-[#5B6B7A]">{ui('No prescription records are available for this patient.')}</div>}
                <p className="text-xs text-[#5B6B7A]">Viewing a prescription does not record a dispensing event. This dashboard does not change prescriptions.</p>
              </>}
            </section>}
          </div>
        )}

        {/* MODE 6: LAB */}
        {mode === 'LAB' && (
          <div className="max-w-3xl mx-auto space-y-5">
            <div className="clay-card p-5 space-y-2 border-l-4 border-l-[#1769AA]">
              <span className="text-xs font-extrabold text-[#1769AA]">
                LAB
              </span>
              <h2 className="text-xl font-bold text-[#1F2D3D]">
                Add a test result
              </h2>
              <p className="text-sm text-[#5B6B7A]">{ui('Find the patient by HealthPass ID, then add the result to their records. Looking up an ID does not show you their other health information.')}</p>
            </div>
            {loggedInUser?.role !== 'lab' ? <div role="alert" className="clay-card p-4 text-sm font-semibold text-rose-700">Sign in with a diagnostic lab account to add a report.</div> : <>
            <form onSubmit={handleLabPatientLookup} className="clay-card p-5 space-y-3">
              <label htmlFor="lab-patient-id" className="block text-sm font-bold text-[#1F2D3D]">{ui('Patient HealthPass ID')}</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input id="lab-patient-id" type="text" required value={labHealthPassId} onChange={(e) => { setLabHealthPassId(e.target.value); setLabPatientIdentity(null); setLabAccessStatus('NONE'); }} placeholder="For example, HP-DEMO-0417" autoComplete="off" className="w-full min-h-[44px] px-3 rounded-xl border border-[#DDE7EA] text-sm" />
                <button type="submit" disabled={labLookupBusy || !labHealthPassId.trim()} className="min-h-[44px] px-5 rounded-xl bg-[#1769AA] text-white text-sm font-bold disabled:opacity-50">{labLookupBusy ? 'Checking…' : 'Find patient'}</button>
              </div>
              {labPatientIdentity && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><span className="font-bold">Patient identified:</span> {labPatientIdentity.name} · <span className="font-mono">{labPatientIdentity.healthPassId}</span></div>}
              {labPatientIdentity && <div className="rounded-xl border border-[#DDE7EA] bg-white p-3 space-y-2">
                <p className="text-sm font-bold text-[#1F2D3D]">{labAccessStatus === 'PENDING' ? 'Waiting for patient approval' : labAccessStatus === 'GRANTED' ? 'Patient approved laboratory report access' : labAccessStatus === 'DENIED' ? 'Patient declined the request' : labAccessStatus === 'REVOKED' ? 'Patient revoked access' : labAccessStatus === 'EXPIRED' ? 'Patient approval expired' : 'Patient approval is needed before adding a report'}</p>
                {labAccessStatus === 'PENDING' ? <p className="text-xs text-[#5B6B7A]">The request appears in the patient’s Access Requests. This screen checks for their decision automatically.</p> : labAccessStatus === 'GRANTED' ? <p className="text-xs text-[#5B6B7A]">Approval is limited to Laboratory Reports and expires {labPatientIdentity.grant?.expiresAt ? new Date(labPatientIdentity.grant.expiresAt).toLocaleString() : 'according to the consent period'}.</p> : <button type="button" onClick={handleLabRequestAccess} disabled={labLookupBusy} className="min-h-[42px] rounded-xl bg-[#1769AA] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{labLookupBusy ? 'Sending…' : 'Request patient approval'}</button>}
              </div>}
            </form>
            <form
              onSubmit={handleLabReportSubmit}
              className={`clay-card p-5 space-y-4 ${!labPatientIdentity || labAccessStatus !== 'GRANTED' ? 'opacity-60' : ''}`}
            >
              <div>
                <label htmlFor="lab-test-name" className="block text-sm font-bold text-[#1F2D3D] mb-1">
                  Test Name
                </label>
                <input
                  id="lab-test-name"
                  type="text"
                  required
                  maxLength={160}
                  value={labTestName}
                  onChange={(e) => setLabTestName(e.target.value)}
                  disabled={!labPatientIdentity || labAccessStatus !== 'GRANTED' || labSaveBusy}
                  className="w-full min-h-[44px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] text-sm disabled:bg-slate-50"
                />
              </div>
              <div>
                <label htmlFor="lab-result-summary" className="block text-sm font-bold text-[#1F2D3D] mb-1">
                  Result Summary
                </label>
                <textarea
                  id="lab-result-summary"
                  required
                  maxLength={4000}
                  value={labResultSummary}
                  onChange={(e) => setLabResultSummary(e.target.value)}
                  disabled={!labPatientIdentity || labAccessStatus !== 'GRANTED' || labSaveBusy}
                  rows={4}
                  className="w-full min-h-[100px] px-3 py-2 rounded-xl border border-[#DDE7EA] text-sm font-mono disabled:bg-slate-50"
                />
              </div>
              <div>
                <label htmlFor="lab-report-date" className="block text-sm font-bold text-[#1F2D3D] mb-1">Report date</label>
                <input id="lab-report-date" type="date" required value={labReportDate} onChange={(e) => setLabReportDate(e.target.value)} disabled={!labPatientIdentity || labAccessStatus !== 'GRANTED' || labSaveBusy} className="w-full min-h-[44px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] text-sm disabled:bg-slate-50" />
              </div>
              <button
                type="submit"
                disabled={!labPatientIdentity || labAccessStatus !== 'GRANTED' || labSaveBusy || !labTestName.trim() || !labResultSummary.trim()}
                className="min-h-[44px] px-5 py-2.5 clay-btn-primary text-sm font-bold cursor-pointer disabled:opacity-50"
              >
                {labSaveBusy ? 'Saving…' : 'Save test result'}
              </button>
            </form>
            </>}
          </div>
        )}

        {/* MODE 7: ADMIN */}
        {mode === 'ADMIN' && (
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="clay-card p-5 space-y-2">
              <span className="text-xs font-extrabold text-[#0E7C86]">
                ADMIN
              </span>
              <h2 className="text-xl font-bold text-[#1F2D3D]">
                Review healthcare providers
              </h2>
            </div>
            <div className="clay-card p-4 space-y-3">
              <h3 className="text-sm font-bold text-[#1F2D3D]">
                Demo provider directory · professional credentials are not verified by this prototype
              </h3>
              {(adminData?.providers || doctorList.map((p: any) => ({ ...p, verified: true }))).map((p: any) => (
                <div
                  key={p.id}
                  className="p-3.5 rounded-xl bg-[#F5F9FA] border border-[#DDE7EA] flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#1F2D3D]">{p.name}</span>
                      <FacilityBadge level={p.facilityLevel} name={p.facilityName} lang={lang} />
                    </div>
                    <div className="text-xs font-mono text-[#5B6B7A]">{p.email}</div>
                  </div>
                  <button type="button" onClick={() => handleProviderVerification(p.id)} className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${p.verified ? 'bg-[#ECFDF5] text-[#1E8E5A]' : 'bg-[#FEF2F2] text-[#D32F2F]'}`}>
                    {p.verified ? 'DEMO ACTIVE · not credential verified' : 'DEMO INACTIVE · toggle'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ====================================================================
          MODALS
      ==================================================================== */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
          <div className="clay-card max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1F2D3D]">Sign In to HealthPass</h3>
              <button
                type="button"
                onClick={() => setShowLoginModal(false)}
                className="text-[#5B6B7A] hover:text-[#1F2D3D] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#D32F2F] text-xs font-bold text-[#D32F2F]">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-3">
              {isCreatingAccount && <div>
                <label className="block text-xs font-bold text-[#1F2D3D] mb-1">{ui('Your name')}</label>
                <input type="text" required maxLength={200} value={registrationName} onChange={(e) => setRegistrationName(e.target.value)} className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] text-sm" />
              </div>}
              <div>
                <label className="block text-xs font-bold text-[#1F2D3D] mb-1">{ui('Email Address')}</label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1F2D3D] mb-1">{ui('Password')}</label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] text-xs font-mono"
                />
              </div>
              <button
                type="submit"
                className="w-full min-h-[44px] clay-btn-primary text-xs font-bold cursor-pointer"
              >
                {isCreatingAccount ? 'Create Patient Account' : 'Sign In'}
              </button>
            </form>

            {isSupabaseConfigured && <button type="button" onClick={() => { setIsCreatingAccount((value) => !value); setLoginError(null); }} className="mt-2 text-xs font-bold text-[#0E7C86] underline">
              {isCreatingAccount ? 'Already have an account? Sign in' : 'Create a patient account'}
            </button>}

            {!isCreatingAccount && <div className="pt-3 border-t border-[#DDE7EA] space-y-2">
              <div className="text-xs font-bold text-[#5B6B7A]">{ui('Fictional demo profiles (simulated sign-in · password:')} <span className="font-mono">Demo@123</span>)</div>
              <div className="space-y-1.5">
                {DEMO_PATIENTS.map((demoPatient) => <button key={demoPatient.id} type="button" onClick={() => { setLoginEmail(demoPatient.email); setLoginPassword('Demo@123'); }} className="w-full p-2 rounded-xl bg-[#F5F9FA] border border-[#DDE7EA] text-left text-xs hover:bg-white flex items-center justify-between gap-2 cursor-pointer"><span className="font-bold text-[#1F2D3D]">{demoPatient.name}</span><span className="font-mono text-[#0E7C86]">{demoPatient.email}</span></button>)}
                {doctorList.map((demoDoctor, index) => {
                  const email = ['village.doctor@demo.com', 'doctor@demo.com', 'district.doctor@demo.com'][index];
                  return <button key={demoDoctor.id} type="button" onClick={() => { setLoginEmail(email); setLoginPassword('Demo@123'); }} className="w-full p-2 rounded-xl bg-[#F5F9FA] border border-[#DDE7EA] text-left text-xs hover:bg-white flex items-center justify-between gap-2 cursor-pointer"><span className="font-bold text-[#1F2D3D]">{demoDoctor.name}</span><span className="font-mono text-[#1769AA]">{email}</span></button>;
                })}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { email: 'pharmacy@demo.com', label: 'Pharmacy' },
                  { email: 'lab@demo.com', label: 'Diagnostic Lab' },
                  { email: 'admin@demo.com', label: 'Registry Admin' },
                ].map((demoRole) => (
                  <button
                    key={demoRole.email}
                    type="button"
                    onClick={() => { setLoginEmail(demoRole.email); setLoginPassword('Demo@123'); }}
                    className="min-h-[38px] p-2 rounded-xl bg-[#F5F9FA] border border-[#DDE7EA] text-center text-[11px] font-bold text-[#1F2D3D] hover:bg-white cursor-pointer"
                  >
                    {demoRole.label}
                  </button>
                ))}
              </div>
            </div>}
          </div>
        </div>
      )}

      {showScannerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="clay-card max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#0E7C86]">OPTICAL QR SCANNER</span>
                <h3 className="text-lg font-bold text-[#1F2D3D]">{ui('Scan Patient HealthPass QR')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowScannerModal(false)}
                className="text-[#5B6B7A] hover:text-[#1F2D3D] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden bg-black aspect-video relative flex items-center justify-center border-2 border-[#0E7C86]">
              <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
              {cameraError && (
                <div className="absolute inset-0 bg-[#1F2D3D]/90 p-5 flex flex-col items-center justify-center text-center text-white space-y-2">
                  <Camera className="w-8 h-8 text-[#0E7C86]" />
                  <p className="text-xs text-white/90 max-w-sm">{cameraError}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-[#1F2D3D]">
                Or Tap a Demo Patient Shortcut:
              </div>
              {DEMO_PATIENTS.map((dp) => (
                <button
                  key={dp.id}
                  type="button"
                  onClick={() => {
                    setDoctorLookupQuery(dp.healthPassId);
                    setShowScannerModal(false);
                    handleDoctorLookup(dp.healthPassId);
                  }}
                  className="w-full p-3 rounded-xl bg-[#F5F9FA] border border-[#DDE7EA] hover:border-[#0E7C86] text-left flex items-center justify-between cursor-pointer"
                >
                  <div className="text-xs font-bold text-[#1F2D3D]">{dp.name}</div>
                  <span className="font-mono text-xs font-bold text-[#0E7C86]">
                    {dp.healthPassId}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showConsultationModal && (
        <AddConsultationModal
          lang={lang}
          patientId={activePatientId}
          patientName="Demo Patient (Ananya Rao)"
          doctorId={activeDoctorId}
          prefillMed={prefillConsultMed}
          onClose={() => setShowConsultationModal(false)}
          onViewExistingPrescription={(prescription) => {
            const existing = [
              ...(walletData?.record?.prescriptions || []),
              ...(doctorRecord?.prescriptionsSection?.prescriptions || []),
            ].find((item: any) => item.id === prescription.id);
            if (existing) {
              setShowConsultationModal(false);
              setSelectedPrescription(existing);
            } else {
              showToast('Existing prescription found. Refresh the patient record to view its details.');
            }
          }}
          onSaved={(_visit, _prescription, prescriptionWarning) => {
            setShowConsultationModal(false);
            fetchPatientWallet(activePatientId);
            fetchDoctorRecord(activePatientId, activeDoctorId);
            if (prescriptionWarning?.code === 'ACTIVE_PRESCRIPTION_DUPLICATE') {
              const matchedPrescription = [
                ...(walletData?.record?.prescriptions || []),
                ...(doctorRecord?.prescriptionsSection?.prescriptions || []),
              ].find((item: any) => item.id === prescriptionWarning.existingPrescriptionId || item.id === prescriptionWarning.existingPrescription?.prescriptionId);
              setSelectedPrescription(matchedPrescription || {
                ...prescriptionWarning.existingPrescription,
                id: prescriptionWarning.existingPrescriptionId,
                diagnosis: 'Active prescription',
                medicines: [prescriptionWarning.existingPrescription],
              });
              showToast('Consultation recorded. The duplicate prescription was not added; review the existing prescription.');
            } else {
              showToast('Consultation & prescription saved to Patient HealthPass.');
            }
          }}
          onRevoked403={() => {
            setDoctorRecord(null);
            setDoctorConsentError(
              map403ToConsentScreen('ACCESS_REVOKED', 'The patient has withdrawn permission.')
            );
            showToast('🔒 HTTP 403 ACCESS_REVOKED: Save rejected because patient revoked consent.');
          }}
        />
      )}

      {showDoctorReportOcrModal && (
        <MedicalDocumentOcrModal
          patientId={activePatientId}
          patientName={doctorRecord?.patient?.name || 'the selected patient'}
          uploaderRole="doctor"
          doctorId={activeDoctorId}
          lang={lang}
          onClose={() => setShowDoctorReportOcrModal(false)}
          onSaved={(savedReport) => {
            setShowDoctorReportOcrModal(false);
            void fetchDoctorRecord(activePatientId, activeDoctorId);
            void fetchPatientWallet(activePatientId);
            showToast(`Report ${savedReport.title} uploaded to the selected patient's HealthPass.`);
          }}
          onRevoked403={(code, message) => {
            setDoctorRecord(null);
            setDoctorConsentError(map403ToConsentScreen(code, message));
          }}
        />
      )}

      {showPatientOcrModal && (
        <MedicalDocumentOcrModal
          patientId={activePatientId}
          patientName="Demo Patient (Ananya Rao)"
          uploaderRole="patient"
          lang={lang}
          initialReportType={prescriptionUploadMode ? 'Prescription' : undefined}
          onClose={() => { setShowPatientOcrModal(false); setPrescriptionUploadMode(false); }}
          onViewExistingRecord={(recordId) => {
            setShowPatientOcrModal(false);
            setPrescriptionUploadMode(false);
            setMode('PATIENT');
            setPatientTab('REPORTS');
            setSelectedMedicalRecordCategory(null);
            setMedicalRecordSearch('');
            window.setTimeout(() => document.getElementById(`medical-record-${recordId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
          }}
          onSaved={(savedRep) => {
            setShowPatientOcrModal(false);
            setPrescriptionUploadMode(false);
            fetchPatientWallet(activePatientId);
            fetchDoctorRecord(activePatientId, activeDoctorId);
            showToast(`Verified ${savedRep.title} saved to your HealthPass.`);
          }}
        />
      )}

      {selectedPrescription && (
        <PrescriptionDetailModal
          prescription={selectedPrescription}
          lang={lang}
          onClose={() => setSelectedPrescription(null)}
          onAmend={async (_rxId, note) => {
            showToast('Traceable amendment note appended to prescription audit history.');
          }}
        />
      )}

      {showClinicRegModal && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
          <form
            onSubmit={handleClinicRegister}
            className="clay-card max-w-md w-full p-6 space-y-3.5"
          >
            <h3 className="text-lg font-bold text-[#1F2D3D]">
              60-Second Clinic Self-Registration
            </h3>
            <input
              type="text"
              required
              placeholder="Doctor Name (e.g. Dr. Kavitha Nair)"
              value={regDoctorName}
              onChange={(e) => setRegDoctorName(e.target.value)}
              className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] text-xs"
            />
            <input
              type="text"
              required
              placeholder="Facility Name (e.g. Sub-Centre Clinic, Ibrahimpatnam)"
              value={regClinicName}
              onChange={(e) => setRegClinicName(e.target.value)}
              className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-[#DDE7EA] text-xs"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClinicRegModal(false)}
                className="px-4 py-2 text-xs font-bold text-[#5B6B7A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-5 py-2 clay-btn-primary text-xs font-bold cursor-pointer"
              >
                Register Clinic
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
