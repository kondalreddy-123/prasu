import { HealthRecord } from '../models/HealthRecord.js';
import { Medicine } from '../models/Medicine.js';
import { Consultation } from '../models/Consultation.js';

export function normalizeText(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export async function findDuplicateHealthRecord(patientId, { category, title, reportDate, documentFingerprint, idempotencyKey }) {
  if (idempotencyKey) {
    const byKey = await HealthRecord.findOne({
      patientId,
      idempotencyKey,
      isActive: true,
    });
    if (byKey) return byKey;
  }

  if (documentFingerprint) {
    const byFingerprint = await HealthRecord.findOne({
      patientId,
      documentFingerprint,
      isActive: true,
    });
    if (byFingerprint) return byFingerprint;
  }

  const normalizedTitle = normalizeText(title);
  const records = await HealthRecord.find({
    patientId,
    category,
    reportDate: reportDate || new Date().toISOString().slice(0, 10),
    isActive: true,
  });

  for (const record of records) {
    if (normalizeText(record.title) === normalizedTitle) {
      return record;
    }
  }

  return null;
}

export async function findDuplicateMedicine(patientId, { name, strength }) {
  const normName = normalizeText(name);
  const normStrength = normalizeText(strength);

  const activeMedicines = await Medicine.find({
    patientId,
    computedStatus: { $in: ['ACTIVE', 'SELF_REPORTED'] },
    isActive: true,
  });

  for (const med of activeMedicines) {
    if (normalizeText(med.name) === normName && normalizeText(med.strength) === normStrength) {
      return med;
    }
  }

  return null;
}

export async function findDuplicateConsultation(patientId, { diagnosis, encounterDate, idempotencyKey, chiefComplaint, clinicalNotes }) {
  if (idempotencyKey) {
    const byKey = await Consultation.findOne({
      patientId,
      idempotencyKey,
    });
    if (byKey) return { consultation: byKey, isIdempotentReplay: true };
  }

  const normDiagnosis = normalizeText(diagnosis);
  const normComplaint = normalizeText(chiefComplaint);
  const normNotes = normalizeText(clinicalNotes);

  const consultations = await Consultation.find({
    patientId,
    encounterDate: encounterDate || new Date().toISOString().slice(0, 10),
  });

  for (const c of consultations) {
    if (
      normalizeText(c.diagnosis) === normDiagnosis &&
      normalizeText(c.chiefComplaint) === normComplaint &&
      normalizeText(c.clinicalNotes) === normNotes
    ) {
      return { consultation: c, isIdempotentReplay: false };
    }
  }

  return null;
}
