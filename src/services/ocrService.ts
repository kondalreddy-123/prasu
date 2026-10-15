export type OcrSupportedLang = 'eng' | 'eng+tel' | 'eng+hin';

export interface ExtractedLabValue {
  id?: string;
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  status?: 'NORMAL' | 'HIGH' | 'LOW';
  confidence?: 'HIGH' | 'LOW';
}

export interface ExtractedMedicineItem {
  id?: string;
  name: string;
  strength: string;
  dosage?: string;
  route?: string;
  morning: number;
  noon: number;
  night: number;
  durationDays: number;
  foodInstruction?: string;
  instructions?: string;
  confidence?: 'HIGH' | 'LOW';
  confirmed?: boolean;
}

export interface OcrExtractionResult {
  success: boolean;
  rawText: string;
  overallConfidence: number;
  reportType:
    | 'Blood Test'
    | 'X-Ray / Imaging'
    | 'Prescription'
    | 'Discharge Summary'
    | 'Consultation Document'
    | 'Other';
  consentCategory: string;
  suggestedTitle: string;
  reportDate: string;
  facilityName: string;
  laboratoryName: string;
  doctorName: string;
  diagnosis: string;
  dischargeSummaryNotes: string;
  fieldConfidence: Record<string, 'HIGH' | 'LOW'>;
  labValues: ExtractedLabValue[];
  extractedMedicines: ExtractedMedicineItem[];
  strippedFileDataUrl?: string;
  mimeType: string;
  fileName: string;
}

export async function verifyClientFileSignature(file: File): Promise<{ valid: boolean; reason?: string }> {
  if (file.size > 5 * 1024 * 1024) {
    return { valid: false, reason: 'File exceeds 5MB size limit.' };
  }
  const allowed = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
  ];
  if (!allowed.includes(file.type) && !file.name.endsWith('.svg')) {
    return { valid: false, reason: 'Unsupported file type. Use PNG, JPG, WEBP, SVG, or PDF.' };
  }
  return { valid: true };
}

export function parseOcrClinicalText(rawText: string, confidence = 85): Omit<OcrExtractionResult, 'success' | 'rawText' | 'overallConfidence' | 'mimeType' | 'fileName'> {
  const text = rawText || '';
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let reportType: OcrExtractionResult['reportType'] = 'Other';
  let consentCategory = 'Other documents';

  const lower = text.toLowerCase();
  if (lower.includes('blood') || lower.includes('haemoglobin') || lower.includes('hemoglobin') || lower.includes('sugar') || lower.includes('cbc') || lower.includes('lipid')) {
    reportType = 'Blood Test';
    consentCategory = 'Lab reports';
  } else if (lower.includes('rx') || lower.includes('prescription') || lower.includes('tab') || lower.includes('capsule')) {
    reportType = 'Prescription';
    consentCategory = 'Prescriptions';
  } else if (lower.includes('discharge') || lower.includes('admission') || lower.includes('hospital course')) {
    reportType = 'Discharge Summary';
    consentCategory = 'Medical history';
  } else if (lower.includes('consultation') || lower.includes('opd') || lower.includes('clinic')) {
    reportType = 'Consultation Document';
    consentCategory = 'Consultations';
  }

  // Extract date
  const dateMatch = text.match(/(\d{1,2}[\/\-.][A-Za-z0-9]{3,}[\/\-.]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,}\s+\d{2,4})/);
  const reportDate = dateMatch ? dateMatch[0] : '';

  // Extract facility / doctor
  let facilityName = '';
  let doctorName = '';
  for (const line of lines) {
    if (!facilityName && (line.includes('Hospital') || line.includes('Clinic') || line.includes('Centre') || line.includes('PHC') || line.includes('Diagnostic'))) {
      facilityName = line;
    }
    if (!doctorName && (line.startsWith('Dr.') || line.includes('Dr '))) {
      doctorName = line;
    }
  }
  // Extract Lab values
  const labValues: ExtractedLabValue[] = [];
  const labPatterns = [
    'Haemoglobin', 'Total WBC Count', 'Platelet Count', 'Fasting Blood Sugar',
    'Post-Prandial Sugar', 'HbA1c', 'Serum Creatinine', 'Total Cholesterol', 'Serum Bilirubin',
  ];

  for (const testName of labPatterns) {
    const escapedName = testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(`${escapedName}[^\\n\\d]{0,30}([0-9][0-9.,]*)`, 'i');
    const m = rx.exec(text);
    if (m) {
      const context = text.slice(m.index, m.index + 240);
      const unitMatch = context.match(new RegExp(`${m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(mg\\s*\\/\\s*dL|g\\s*\\/\\s*dL|lakhs\\s*\\/\\s*cumm|\\/cumm|mmol\\/L|mEq\\/L|%|µmol\\/L)`, 'i'));
      const referenceMatch = context.match(/(?:reference(?:\s+range|\s+interval)?|ref\.?\s*(?:range|interval))\s*[:=]?\s*([<>≤≥]?\s*\d[\d,.]*(?:\s*[-–]\s*\d[\d,.]*)?)/i);
      labValues.push({
        id: `lv-${Math.random().toString(36).slice(2, 7)}`,
        testName,
        value: m[1],
        unit: unitMatch?.[1]?.replace(/\s+/g, '') || '',
        referenceRange: referenceMatch?.[1]?.trim() || '',
        confidence: 'LOW',
      });
    }
  }

  // Extract medicines
  const extractedMedicines: ExtractedMedicineItem[] = [];
  const medNames = ['Paracetamol', 'Metformin', 'Amlodipine', 'Pantoprazole', 'Amoxicillin', 'Azithromycin', 'Cetirizine', 'Telmisartan'];
  for (const mn of medNames) {
    if (new RegExp(mn, 'i').test(text)) {
      extractedMedicines.push({
        id: `rx-${Math.random().toString(36).slice(2, 7)}`,
        name: mn,
        strength: '',
        dosage: '',
        route: '',
        morning: 0,
        noon: 0,
        night: 0,
        durationDays: 0,
        foodInstruction: '',
        instructions: '',
        confidence: 'LOW',
        confirmed: false,
      });
    }
  }

  return {
    reportType,
    consentCategory,
    suggestedTitle: `${reportType} (${facilityName}) — ${reportDate}`,
    reportDate,
    facilityName,
    laboratoryName: facilityName,
    doctorName,
    diagnosis: '',
    dischargeSummaryNotes: '',
    fieldConfidence: {
      reportDate: 'LOW',
      facilityName: 'LOW',
      doctorName: 'LOW',
      diagnosisSummary: 'LOW',
    },
    labValues,
    extractedMedicines,
  };
}

export const ocrService = {
  async extract(
    file: File,
    lang: OcrSupportedLang = 'eng',
    onProgress?: (pct: number) => void
  ): Promise<OcrExtractionResult> {
    onProgress?.(30);

    // If text file / svg, read directly
    let fileText = '';
    let fileDataUrl = '';
    const reader = new FileReader();

    const dataUrlPromise = new Promise<string>((resolve) => {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    fileDataUrl = await dataUrlPromise;

    onProgress?.(60);

    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      fileText = await file.text();
    } else {
      throw new Error('OCR for image and PDF documents is not configured in this demo. No report findings were inferred.');
    }

    onProgress?.(90);

    const parsed = parseOcrClinicalText(fileText, 90);

    return {
      success: true,
      rawText: fileText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 800) || fileText,
      overallConfidence: 92,
      ...parsed,
      strippedFileDataUrl: fileDataUrl,
      mimeType: file.type || 'image/png',
      fileName: file.name,
    };
  },
};
