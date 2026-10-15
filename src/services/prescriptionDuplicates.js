/** Normalize names and clinical instructions before comparing prescriptions. */
export const normalizePrescriptionText = (value) =>
  String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');

const inactiveStatuses = new Set(['cancelled', 'canceled', 'discontinued', 'stopped', 'expired', 'completed', 'revoked']);

export function isActivePrescription(record, now = new Date()) {
  const status = normalizePrescriptionText(record?.status || record?.computedStatus);
  if (inactiveStatuses.has(status)) return false;
  if (status !== 'active') return false;
  const end = record?.endDate || record?.validUntil || record?.expiresAt;
  if (!end) return true; // An active record without an end date remains active.
  const endText = String(end);
  const endDate = new Date(endText);
  if (!Number.isFinite(endDate.getTime())) return true; // Fail closed on malformed validity data.
  if (/^\d{4}-\d{2}-\d{2}$/.test(endText)) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const finalValidDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    return today <= finalValidDay;
  }
  return endDate.getTime() > now.getTime();
}

const medicationName = (med) => normalizePrescriptionText(med?.medicationId || med?.name || med?.genericName);
const frequencyText = (med) => typeof med?.frequency === 'object'
  ? Object.keys(med.frequency).sort().map((key) => `${key}:${med.frequency[key]}`).join('|')
  : med?.frequencyLabel || med?.frequency;

export function samePrescriptionRegimen(a, b) {
  if (!medicationName(a) || medicationName(a) !== medicationName(b)) return false;
  const fieldsMatch = ['strength', 'dosage', 'route', 'formulation', 'frequency', 'duration', 'foodInstruction']
    .every((key) => normalizePrescriptionText(key === 'frequency' ? frequencyText(a) : a?.[key]) === normalizePrescriptionText(key === 'frequency' ? frequencyText(b) : b?.[key]));
  const instructionsA = a?.instructions ?? a?.notes;
  const instructionsB = b?.instructions ?? b?.notes;
  return fieldsMatch && normalizePrescriptionText(instructionsA) === normalizePrescriptionText(instructionsB);
}

export function findActivePrescriptionDuplicate(patientId, candidates, records, now = new Date()) {
  for (const candidate of candidates) {
    for (const record of records) {
      if (record?.patientId !== patientId || !isActivePrescription(record, now)) continue;
      const medicines = Array.isArray(record.medicines) ? record.medicines : [record];
      const existingMedicine = medicines.find((med) => samePrescriptionRegimen(med, candidate));
      if (existingMedicine) return { prescription: record, medicine: existingMedicine, candidate };
    }
  }
  return null;
}
