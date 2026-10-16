import { normalizePrescriptionText } from './prescriptionDuplicates.js';

const normalizeRecordText = (value) => normalizePrescriptionText(value).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const inactiveStatuses = new Set(['revoked', 'archived', 'cancelled', 'canceled', 'inactive', 'deleted', 'rejected']);

function recordDate(record) {
  const value = record?.prescriptionMetadataCorrections?.reportDate || record?.extractedFields?.reportDate || record?.reportDate || record?.date || record?.recordDate;
  if (!value) return '';
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : normalizeRecordText(text);
}

function isRecordActive(record) {
  if (record?.active === false || record?.archivedAt || record?.revokedAt || record?.deletedAt) return false;
  const status = normalizeRecordText(record?.status);
  return !inactiveStatuses.has(status);
}

function sourceId(record) {
  return String(record?.idempotencyKey || record?.sourceRecordId || record?.documentId || record?.reportId || record?.accessionNumber ||
    record?.extractedFields?.sourceRecordId || record?.extractedFields?.documentId || record?.extractedFields?.reportId ||
    record?.extractedFields?.accessionNumber || '').trim().toLocaleLowerCase('en');
}

function fingerprint(record) {
  return String(record?.documentFingerprint || record?.sourceFingerprint || record?.extractedFields?.documentFingerprint ||
    record?.extractedFields?.sourceFingerprint || '').trim().toLocaleLowerCase('en');
}

function issuer(record) {
  return normalizeRecordText(record?.facilityName || record?.hospitalName || record?.laboratoryName ||
    record?.extractedFields?.facilityName || record?.extractedFields?.hospitalName || record?.extractedFields?.laboratoryName);
}

/** Match one logical document/event, without treating a category or title alone as a duplicate. */
export function findMedicalRecordDuplicate(patientId, candidate, records) {
  const category = normalizeRecordText(candidate?.medicalCategory || candidate?.category);
  const title = normalizeRecordText(candidate?.title);
  const summary = normalizeRecordText(candidate?.resultSummary || candidate?.summary);
  const date = recordDate(candidate);
  const candidateSourceId = sourceId(candidate);
  const candidateFingerprint = fingerprint(candidate);
  const candidateIssuer = issuer(candidate);
  if (!category || !title) return null;

  return records.find((record) => {
    if (record?.patientId !== patientId || !isRecordActive(record)) return false;
    const recordCategory = normalizeRecordText(record?.medicalCategory || record?.category);
    const recordTitle = normalizeRecordText(record?.title);
    const recordSummary = normalizeRecordText(record?.resultSummary || record?.summary);
    const recordSourceId = sourceId(record);
    const recordFingerprint = fingerprint(record);
    if (recordCategory !== category) return false;
    if (candidateSourceId && recordSourceId && candidateSourceId === recordSourceId) return true;
    if (candidateFingerprint && recordFingerprint && candidateFingerprint === recordFingerprint) return true;
    if (candidate?.fileDataUrl && record?.fileDataUrl && candidate.fileDataUrl === record.fileDataUrl) return true;
    return Boolean(date && summary && recordTitle === title && recordDate(record) === date &&
      recordSummary === summary && issuer(record) === candidateIssuer);
  }) || null;
}
