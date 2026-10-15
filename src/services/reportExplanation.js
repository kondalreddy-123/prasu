export const REPORT_EXPLANATION_LANGUAGES = Object.freeze(['en', 'te', 'hi']);
export const MAX_REPORT_TEXT_CHARS = 8000;
export const REPORT_EXPLANATION_SAFETY_NOTICE = 'This AI-generated explanation is for understanding your report. It may contain mistakes and is not a diagnosis or treatment recommendation. Please consult a qualified healthcare professional for medical decisions.';

const SECTION_LABELS = {
  en: { what: 'What is this report?', findings: 'Main findings', values: 'Important values', terms: 'Medical terms', limits: 'What this report does not establish', questions: 'Questions for your doctor' },
  te: { what: 'ఈ నివేదిక ఏమిటి?', findings: 'ముఖ్యమైన విషయాలు', values: 'ముఖ్యమైన విలువలు', terms: 'వైద్య పదాలు', limits: 'ఈ నివేదిక నిర్ధారించనివి', questions: 'వైద్యుడిని అడగాల్సిన ప్రశ్నలు' },
  hi: { what: 'यह रिपोर्ट क्या है?', findings: 'मुख्य बातें', values: 'महत्वपूर्ण मान', terms: 'चिकित्सा शब्द', limits: 'यह रिपोर्ट क्या साबित नहीं करती', questions: 'डॉक्टर से पूछने के प्रश्न' },
};

export function getReportExplanationSections(explanation) {
  const language = explanation?.language || 'en';
  const labels = SECTION_LABELS[language] || SECTION_LABELS.en;
  const list = (items) => Array.isArray(items) && items.length ? items.map((item) => `• ${item}`).join('\n') : (language === 'te' ? 'ఈ నివేదికలో ఈ సమాచారం లేదు.' : language === 'hi' ? 'इस रिपोर्ट में यह जानकारी नहीं है।' : 'This information is not stated in the report.');
  const values = Array.isArray(explanation?.importantValues) ? explanation.importantValues.map((item) => `${item.name}: ${item.value}${item.referenceRange ? ` (${language === 'te' ? 'సూచన పరిధి' : language === 'hi' ? 'संदर्भ सीमा' : 'reference range'}: ${item.referenceRange})` : ''}. ${item.plainMeaning}`).join('\n') : '';
  const terms = Array.isArray(explanation?.medicalTerms) ? explanation.medicalTerms.map((item) => `${item.term}: ${item.meaning}`).join('\n') : '';
  return [
    { key: 'what', label: labels.what, text: explanation?.whatIsThisReport || '' },
    { key: 'findings', label: labels.findings, text: list(explanation?.mainFindings) },
    { key: 'values', label: labels.values, text: values || list([]) },
    { key: 'terms', label: labels.terms, text: terms || list([]) },
    { key: 'limits', label: labels.limits, text: explanation?.whatThisDoesNotEstablish || '' },
    { key: 'questions', label: labels.questions, text: list(explanation?.questionsForDoctor) },
  ].filter((section) => section.text);
}

export function formatReportExplanation(explanation) {
  return getReportExplanationSections(explanation).map((section) => `${section.label}\n${section.text}`).join('\n\n');
}

export function getReportTextForExplanation(report) {
  // Never construct AI input from guessed OCR fields or generated interpretations.
  const candidates = [report?.rawOcrText, report?.resultSummary];
  const text = candidates.find((value) => typeof value === 'string' && value.trim()) || '';
  return sanitizeReportText(text);
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

export function canExplainDoctorReport({ requestingPatientId, report, externalAiConsent, language }) {
  if (!requestingPatientId || report?.patientId !== requestingPatientId) return { ok: false, code: 'PATIENT_OWNERSHIP_REQUIRED' };
  if (!(report?.uploaderRole === 'doctor' || ['DOCTOR_UPLOAD', 'PROVIDER_UPLOAD'].includes(report?.source))) return { ok: false, code: 'DOCTOR_REPORT_REQUIRED' };
  if (!externalAiConsent) return { ok: false, code: 'EXTERNAL_AI_CONSENT_REQUIRED' };
  if (!REPORT_EXPLANATION_LANGUAGES.includes(language)) return { ok: false, code: 'UNSUPPORTED_LANGUAGE' };
  const reportText = getReportTextForExplanation(report);
  if (!reportText) return { ok: false, code: 'REPORT_TEXT_UNAVAILABLE' };
  return { ok: true, reportText };
}

const isText = (value, max = 2000) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

export function validateReportExplanation(value, expectedLanguage, sourceText) {
  if (!value || typeof value !== 'object' || value.language !== expectedLanguage || !REPORT_EXPLANATION_LANGUAGES.includes(value.language)) return false;
  if (!isText(value.whatIsThisReport) || !isText(value.whatThisDoesNotEstablish) || !Array.isArray(value.mainFindings) || !Array.isArray(value.importantValues) || !Array.isArray(value.medicalTerms) || !Array.isArray(value.questionsForDoctor)) return false;
  if (value.mainFindings.length > 12 || value.importantValues.length > 30 || value.medicalTerms.length > 20 || value.questionsForDoctor.length > 10) return false;
  if (!value.mainFindings.every((item) => isText(item, 500))) return false;
  if (!value.importantValues.every((item) => item && isText(item.name, 120) && isText(item.value, 120) && (item.referenceRange === null || item.referenceRange === undefined || typeof item.referenceRange === 'string') && isText(item.plainMeaning, 500))) return false;
  if (!value.medicalTerms.every((item) => item && isText(item.term, 120) && isText(item.meaning, 500))) return false;
  if (!value.questionsForDoctor.every((item) => isText(item, 400))) return false;
  if (typeof sourceText === 'string') {
    const sourceNumbers = new Set(sourceText.match(/\d+(?:[.,]\d+)*/g) || []);
    const outputText = [value.whatIsThisReport, ...value.mainFindings, ...value.importantValues.flatMap((item) => [item.value, item.referenceRange || '', item.plainMeaning]), ...value.medicalTerms.flatMap((item) => [item.term, item.meaning]), value.whatThisDoesNotEstablish, ...value.questionsForDoctor].join(' ');
    const outputNumbers = outputText.match(/\d+(?:[.,]\d+)*/g) || [];
    if (outputNumbers.some((number) => !sourceNumbers.has(number))) return false;
    const normalizedSource = sourceText.toLowerCase().replace(/\s+/g, ' ').trim();
    const explicitlyQuotedValues = value.importantValues.flatMap((item) => [item.value, item.referenceRange].filter(Boolean));
    if (explicitlyQuotedValues.some((part) => !normalizedSource.includes(String(part).toLowerCase().replace(/\s+/g, ' ').trim()))) return false;
  }
  return true;
}

export function labelReportExplanation(value) {
  return { ...value, aiGenerated: true, readable: true, label: 'AI-generated explanation, not a diagnosis', medicalSafetyNotice: REPORT_EXPLANATION_SAFETY_NOTICE };
}
