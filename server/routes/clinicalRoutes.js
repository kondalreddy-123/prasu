import express from 'express';
import { Medicine } from '../models/Medicine.js';
import { Allergy } from '../models/Allergy.js';
import { HealthRecord } from '../models/HealthRecord.js';
import {
  authenticate,
  requireRole,
  requireVerifiedDoctor,
  requirePatientConsent,
} from '../middleware/auth.js';

export const clinicalRouter = express.Router();

const INTERACTION_RULES = [
  {
    a: /warfarin/i,
    b: /aspirin|ibuprofen|diclofenac|naproxen/i,
    severity: 'HIGH',
    warning: 'Combined anticoagulant and antiplatelet/NSAID use increases serious bleeding risk.',
  },
  {
    a: /(?:lisinopril|enalapril|ramipril|perindopril)/i,
    b: /(?:spironolactone|potassium)/i,
    severity: 'HIGH',
    warning: 'ACE inhibitor with potassium-sparing diuretic or potassium supplement may cause hyperkalaemia.',
  },
  {
    a: /(?:simvastatin|atorvastatin|rosuvastatin)/i,
    b: /(?:clarithromycin|erythromycin|itraconazole)/i,
    severity: 'HIGH',
    warning: 'Statin with a strong CYP3A4 inhibitor increases rhabdomyolysis risk.',
  },
  {
    a: /(?:metformin)/i,
    b: /(?:alcohol)/i,
    severity: 'MODERATE',
    warning: 'Metformin with heavy alcohol use increases the risk of lactic acidosis.',
  },
  {
    a: /(?:sertraline|fluoxetine|citalopram|escitalopram|paroxetine)/i,
    b: /(?:tramadol|sumatriptan|linezolid)/i,
    severity: 'HIGH',
    warning: 'Serotonergic medicines together increase the risk of serotonin syndrome.',
  },
];

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

// Reports within the last 60 days (or without an exact date) are considered recent for repeat-test clinical alerts.
const REPEAT_TEST_LOOKBACK_DAYS = 60;

function daysBetween(isoDate, now = new Date()) {
  const time = Date.parse(isoDate);
  if (!Number.isFinite(time)) return null;
  return Math.floor((now.getTime() - time) / 86_400_000);
}

// POST /api/clinical/check-safety
// Decision support only. Never returns patient identity and never mutates records.
clinicalRouter.post(
  '/check-safety',
  authenticate,
  requireRole('doctor'),
  requireVerifiedDoctor,
  requirePatientConsent('Medications & Prescriptions'),
  async (req, res) => {
    try {
      const patientId = req.params.patientId || req.body.patientId;
      if (!patientId) return res.status(400).json({ error: 'Patient ID is required.' });

      const candidates = Array.isArray(req.body.candidateMedicines) ? req.body.candidateMedicines : [];
      const candidateTests = Array.isArray(req.body.candidateTests)
        ? req.body.candidateTests
        : Array.isArray(req.body.orderedTests) ? req.body.orderedTests : [];

      const [activeMedicines, allergies, reports] = await Promise.all([
        Medicine.find({ patientId, isActive: true, computedStatus: 'ACTIVE' }),
        Allergy.find({ patientId, isActive: true }),
        HealthRecord.find({ patientId, isActive: true }),
      ]);

      const allergyAlerts = [];
      for (const candidate of candidates) {
        const candidateText = normalize(`${candidate?.name || ''} ${candidate?.genericName || ''}`);
        if (!candidateText) continue;
        for (const allergy of allergies) {
          const allergen = normalize(allergy.allergen);
          const matches = (allergen && candidateText.includes(allergen))
            || (allergy.drugClassMatches || []).some((match) => normalize(match) && candidateText.includes(normalize(match)));
          if (!matches) continue;
          allergyAlerts.push({
            medicineName: candidate.name,
            allergen: allergy.allergen,
            reaction: allergy.reaction || 'Reaction not recorded',
            severity: allergy.severity || 'MODERATE',
          });
        }
      }

      const duplicateAlerts = [];
      for (const candidate of candidates) {
        const name = normalize(candidate?.name);
        if (!name) continue;
        for (const existing of activeMedicines) {
          const existingName = normalize(existing.name);
          const generic = normalize(existing.genericName);
          const isMatch = name === existingName || (generic && (name === generic || name.includes(generic) || existingName.includes(name)));
          if (!isMatch) continue;
          duplicateAlerts.push({
            candidateName: candidate.name,
            normalizedGeneric: existing.genericName || existing.name,
            existingMed: {
              id: existing._id.toString(),
              name: existing.name,
              strength: existing.strength || '',
              facilityName: existing.facilityName || '',
              prescriberName: existing.prescriberName || '',
            },
            daysRemaining: Number(existing.daysRemaining) || 0,
          });
          break;
        }
      }

      const interactionAlerts = [];
      const allMedicineNames = [
        ...activeMedicines.map((medicine) => medicine.name),
        ...candidates.map((candidate) => candidate?.name),
      ].filter(Boolean);
      for (const rule of INTERACTION_RULES) {
        const matchesA = allMedicineNames.filter((name) => rule.a.test(name));
        const matchesB = allMedicineNames.filter((name) => rule.b.test(name));
        for (const first of matchesA) {
          for (const second of matchesB) {
            if (first === second) continue;
            interactionAlerts.push({
              pair: `${first} + ${second}`,
              severity: rule.severity,
              warning: rule.warning,
            });
          }
        }
      }

      const repeatTestAlerts = [];
      for (const rawTest of candidateTests) {
        const test = typeof rawTest === 'string' ? rawTest : rawTest?.name;
        const normalizedTest = normalize(test);
        if (!normalizedTest) continue;
        for (const report of reports) {
          const reportText = normalize(`${report.title} ${report.resultSummary} ${(report.extractedFields?.labValues || []).map((value) => value?.testName).join(' ')}`);
          if (!reportText.includes(normalizedTest)) continue;
          const age = daysBetween(report.reportDate || report.createdAt);
          if (age != null && (age < 0 || age > REPEAT_TEST_LOOKBACK_DAYS)) continue;
          const displayAge = age == null ? 0 : age;
          repeatTestAlerts.push({
            orderedTest: test,
            existingReportTitle: report.title,
            daysAgo: displayAge,
            date: report.reportDate || '',
            facilityName: report.facilityName || '',
            message: `${test} was already recorded ${displayAge} day${displayAge === 1 ? '' : 's'} ago. Confirm the repeat test is clinically necessary.`,
          });
          break;
        }
      }

      return res.status(200).json({
        allergyAlerts,
        duplicateAlerts,
        interactionAlerts,
        repeatTestAlerts,
      });
    } catch {
      return res.status(500).json({ error: 'Clinical safety review could not be completed.' });
    }
  }
);
