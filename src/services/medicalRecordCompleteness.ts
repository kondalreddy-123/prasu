import { getMedicalRecordCategory } from '../medicalRecordCategories.ts';

export type CompletenessSection = {
  id: 'allergies' | 'medications' | 'history' | 'prescriptions' | 'laboratory' | 'emergency';
  label: string;
  count: number;
  lastUpdated: string;
};

export type CompletenessReviewItem = {
  id: string;
  title: string;
  missing: string[];
};

export function buildMedicalRecordCompleteness(patient: any, record: any, profile: any) {
  const forPatient = (items: any[] = []) => items.filter((item: any) => !item.patientId || item.patientId === patient?.id);
  const allergies = forPatient(record?.allergies || []);
  const medicines = forPatient(record?.medicines || []);
  const conditions = forPatient(record?.chronicConditions || []);
  const visits = forPatient(record?.visits || []);
  const reports = forPatient(record?.reports || []);
  const prescriptionRecords = forPatient(record?.prescriptions || []).concat(reports.filter((item: any) =>
    item.extractedFields?.reportType === 'Prescription' || /prescription/i.test(item.category || '')
  ));
  const labReports = reports.filter((item: any) => getMedicalRecordCategory(item) === 'Laboratory Reports');
  const dated = (items: any[]) => items.map((item) => item.updatedAt || item.createdAt || item.uploadedAt || item.startDate).filter(Boolean);
  const latest = (items: any[], extra?: string) => {
    const dates = [...dated(items), ...(extra ? [extra] : [])].map((value) => new Date(value).getTime()).filter(Number.isFinite);
    return dates.length ? new Date(Math.max(...dates)).toLocaleDateString() : 'Unknown';
  };
  const historyCount = conditions.length + visits.length + (profile?.healthConditions ? 1 : 0) + (profile?.pastSurgeries ? 1 : 0);
  const emergencyCount = patient?.emergencyContact?.name || profile?.emergencyContactName ? 1 : 0;
  const sections: CompletenessSection[] = [
    { id: 'allergies', label: 'Allergies', count: allergies.length || (profile?.knownAllergies ? 1 : 0), lastUpdated: latest(allergies, profile?.knownAllergies ? profile.updatedAt : undefined) },
    { id: 'medications', label: 'Medications', count: medicines.length || (profile?.currentMedications ? 1 : 0), lastUpdated: latest(medicines, profile?.currentMedications ? profile.updatedAt : undefined) },
    { id: 'history', label: 'Medical history', count: historyCount, lastUpdated: latest([...conditions, ...visits], (profile?.healthConditions || profile?.pastSurgeries) ? profile.updatedAt : undefined) },
    { id: 'prescriptions', label: 'Prescriptions', count: prescriptionRecords.length, lastUpdated: latest(prescriptionRecords) },
    { id: 'laboratory', label: 'Laboratory reports', count: labReports.length, lastUpdated: latest(labReports) },
    { id: 'emergency', label: 'Emergency contacts', count: emergencyCount, lastUpdated: latest([], profile?.emergencyContactName ? profile.updatedAt : undefined) },
  ];
  const reviewItems: CompletenessReviewItem[] = reports
    .filter((item: any) => getMedicalRecordCategory(item) === 'Laboratory Reports' || item.extractedFields?.reportType === 'Prescription' || /prescription/i.test(item.category || ''))
    .map((item: any) => {
      const missing: string[] = [];
      const dateValue = item.prescriptionMetadataCorrections?.reportDate || item.extractedFields?.reportDate || item.reportDate || item.date;
      if (!dateValue || !Number.isFinite(new Date(dateValue).getTime())) missing.push('record date');
      const sourceValue = item.source || item.uploadSource;
      if (!sourceValue || /^(unknown|not provided|n\/a)$/i.test(String(sourceValue).trim())) missing.push('document source');
      return { id: item.id, title: item.title || 'Untitled record', missing };
    }).filter((item: CompletenessReviewItem) => item.missing.length > 0);
  return { sections, reviewItems };
}
