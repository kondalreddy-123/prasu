export const REPORT_EXPLANATION_LANGUAGES = ['en', 'te', 'hi'];
export const MAX_REPORT_TEXT_CHARS = 8000;

/** Conservative, facts-only summary built from explicitly stored fields. */
export function createMedicalReportSummary(report) {
  const fields = report?.extractedFields || {};
  const facts = [];
  const date = fields.reportDate || report?.reportDate || report?.date;
  const provider = fields.laboratoryName || fields.facilityName || report?.facilityName;
  if (date && !/^unverified/i.test(String(date))) facts.push(`Report date: ${date}`);
  if (provider && !/^unverified/i.test(String(provider))) facts.push(`Issuing provider: ${provider}`);
  const labValues = Array.isArray(fields.labValues) ? fields.labValues : [];
  for (const item of labValues) {
    if (!item || !item.testName || item.value == null || item.value === '') continue;
    const parts = [`${item.testName}: ${item.value}`];
    if (item.unit) parts.push(String(item.unit));
    const value = parts.join(' ');
    facts.push(item.referenceRange ? `${value} (reference range recorded: ${item.referenceRange})` : value);
  }
  if (typeof report?.rawOcrText === 'string' && report.rawOcrText.trim()) {
    facts.push(`Extracted document text: ${report.rawOcrText.trim().slice(0, 3000)}`);
  }
  if (!facts.length) {
    return { facts: [], explanation: '', readable: false };
  }
  return {
    facts,
    explanation: 'This is a facts-only summary from information saved during upload. AI-generated explanation is unavailable in this app setup, so the values are not interpreted here.',
    readable: true,
  };
}

export function sanitizeReportText(value) {
  if (typeof value !== 'string') return '';
  const plainText = value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '\n');
  const lines = plainText.split('\n').map((line) => line.trim()).filter(Boolean)
    .filter((line) => !/^\s*(patient\s*(name|id|no\.?|number)|name|dob|date of birth|age|address|phone|mobile|email|e-mail|mrn|uhid|abha|healthpass|aadhaar|aadhar)\s*[:#=-]/i.test(line));
  return lines.join('\n')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted email]')
    .replace(/\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/g, '[redacted phone]')
    .replace(/\b(?:HP|ABHA|UHID|MRN)[-\s:]?[A-Z0-9-]{4,}\b/gi, '[redacted identifier]')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_REPORT_TEXT_CHARS);
}

export function getReportTextForExplanation(report) {
  const candidates = [report?.rawOcrText, report?.resultSummary];
  const text = candidates.find((value) => typeof value === 'string' && value.trim()) || '';
  return sanitizeReportText(text);
}

export function canExplainDoctorReport({ requestingPatientId, report, externalAiConsent, language }) {
  if (!requestingPatientId || String(report?.patientId) !== String(requestingPatientId)) {
    return { ok: false, code: 'PATIENT_OWNERSHIP_REQUIRED' };
  }
  if (!(report?.uploaderRole === 'doctor' || ['DOCTOR_UPLOAD', 'PROVIDER_UPLOAD'].includes(report?.source))) {
    return { ok: false, code: 'DOCTOR_REPORT_REQUIRED' };
  }
  if (!externalAiConsent) {
    return { ok: false, code: 'EXTERNAL_AI_CONSENT_REQUIRED' };
  }
  if (!REPORT_EXPLANATION_LANGUAGES.includes(language)) {
    return { ok: false, code: 'UNSUPPORTED_LANGUAGE' };
  }
  const reportText = getReportTextForExplanation(report);
  if (!reportText) {
    return { ok: false, code: 'REPORT_TEXT_UNAVAILABLE' };
  }
  return { ok: true, reportText };
}
