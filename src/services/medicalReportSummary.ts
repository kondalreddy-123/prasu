export type MedicalReportSummary = {
  facts: string[];
  explanation: string;
  readable: boolean;
};

/** Builds a conservative summary from explicitly stored extracted fields only. */
export function createMedicalReportSummary(report: any): MedicalReportSummary {
  const fields = report?.extractedFields || {};
  const facts: string[] = [];
  const date = fields.reportDate || report.reportDate || report.date;
  const provider = fields.laboratoryName || fields.facilityName || report.facilityName;
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
  if (typeof report.rawOcrText === 'string' && report.rawOcrText.trim()) {
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
