export const MEDICAL_RECORD_CATEGORIES = [
  'Cardiac Care',
  'Diabetes & Metabolic Health',
  'Respiratory Health',
  'Neurological Health',
  'Kidney Health',
  'Allergies',
  'Medications & Prescriptions',
  'Laboratory Reports',
  'Surgeries & Procedures',
  'Vaccinations',
  'Consultation History',
  'General Medical History',
  'Other Medical Records',
] as const;

export type MedicalRecordCategory = (typeof MEDICAL_RECORD_CATEGORIES)[number];

const VALID_CATEGORIES = new Set<string>(MEDICAL_RECORD_CATEGORIES);

export function getMedicalRecordCategory(record: any): MedicalRecordCategory {
  if (record?.medicalCategory && VALID_CATEGORIES.has(record.medicalCategory)) {
    return record.medicalCategory as MedicalRecordCategory;
  }

  const text = `${record?.title || ''} ${record?.name || ''} ${record?.simpleLabel || ''} ${record?.testName || ''} ${record?.category || ''} ${record?.resultSummary || ''} ${record?.reportType || ''}`.toLowerCase();
  if (/allerg|hypersensitiv/.test(text)) return 'Allergies';
  if (/prescription|\bmedication\b|\bmedicine\b|\bdrug\b|\btablet\b|\bcapsule\b|\brx\b/.test(text)) return 'Medications & Prescriptions';
  if (/cardiac|cardiology|heart|ecg|e?kg|coronary|myocard/.test(text)) return 'Cardiac Care';
  if (/respirat|pulmonary|asthma|copd|pneumonia|lung|chest x.?ray/.test(text)) return 'Respiratory Health';
  if (/neurolog|brain|seizure|stroke|epilep|migraine/.test(text)) return 'Neurological Health';
  if (/kidney|renal|nephro|dialysis/.test(text)) return 'Kidney Health';
  if (/surger|procedure|operative|operation/.test(text)) return 'Surgeries & Procedures';
  if (/vaccin|immuni[sz]ation|booster/.test(text)) return 'Vaccinations';
  if (/lab reports?|blood test|cbc|laboratory|\bhba1c\b|\bglucose\b|\bcreatinine\b|\bplatelet\b|\bcholesterol\b/.test(text)) {
    if (/\bdiabet|\bmetabolic|\bhba1c\b|\bglucose\b|\blipid\b/.test(text)) return 'Diabetes & Metabolic Health';
    return 'Laboratory Reports';
  }
  if (/diabet|metabolic|hba1c|glucose|insulin/.test(text)) return 'Diabetes & Metabolic Health';
  if (/consult|visit|follow.?up|clinical note/.test(text)) return 'Consultation History';
  if (/medical history|discharge summary|history/.test(text)) return 'General Medical History';
  return 'Other Medical Records';
}

export function isMedicalCategoryAuthorized(grant: any, category: MedicalRecordCategory): boolean {
  const granted = new Set<string>(grant?.grantedCategories || []);
  if (granted.has(category)) return true;

  // Support grants created before categorized records were introduced.
  switch (category) {
    case 'Allergies': return granted.has('Allergies');
    case 'Medications & Prescriptions': return granted.has('Medicines') || granted.has('Prescriptions');
    case 'Laboratory Reports': return granted.has('Lab reports');
    case 'Consultation History': return granted.has('Consultations') || granted.has('Medical history');
    case 'General Medical History': return granted.has('Medical history');
    case 'Other Medical Records': return granted.has('Other documents');
    default: return false;
  }
}

export function isMedicalRecordAuthorized(grant: any, record: any): boolean {
  const category = getMedicalRecordCategory(record);
  const granted = new Set<string>(grant?.grantedCategories || []);
  if (granted.has(category)) return true;
  if (category === 'Medications & Prescriptions') {
    if (record?.category === 'Medicines') return granted.has('Medicines');
    if (record?.category === 'Prescriptions') return granted.has('Prescriptions');
    return false;
  }
  return isMedicalCategoryAuthorized(grant, category);
}
