import express from 'express';
import { User } from '../models/User.js';
import { PatientProfile } from '../models/PatientProfile.js';
import { HealthRecord } from '../models/HealthRecord.js';
import { Medicine } from '../models/Medicine.js';
import { Allergy } from '../models/Allergy.js';
import { AuditLog } from '../models/AuditLog.js';
import { authenticate, requireRole, requireVerifiedDoctor } from '../middleware/auth.js';
import { getMedicalRecordCategory, LAB_CATEGORY } from '../utils/categories.js';

export const emergencyPatientRouter = express.Router();

const GENERIC_VERIFICATION_ERROR =
  'Emergency access could not be verified. Check the details and authorized provider account, or create a new emergency record.';

function isoDateOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeHealthPassId(value) {
  return String(value || '').trim().replace(/\s+/g, '').toUpperCase();
}

function safeText(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function recordSummary(record) {
  return safeText(record.resultSummary || record.plainExplanation || '', 700);
}

// POST /api/emergency/find-patient
// Break-glass emergency lookup. Only a verified doctor may use it, and only with
// the HealthPass ID, an exact date-of-birth match, a documented reason and an
// explicit patient-incapacity attestation. Every successful lookup is audited.
emergencyPatientRouter.post(
  '/find-patient',
  authenticate,
  requireRole('doctor'),
  requireVerifiedDoctor,
  async (req, res) => {
    try {
      const body = req.body || {};
      const healthPassId = normalizeHealthPassId(body.healthPassId);
      const reason = safeText(body.reason, 1000);
      const submittedDob = isoDateOnly(body.dateOfBirth);

      if (!/^HP-[A-Z0-9-]{3,37}$/.test(healthPassId) || !submittedDob) {
        return res.status(400).json({ error: GENERIC_VERIFICATION_ERROR });
      }
      if (reason.length < 10 || body.patientUnableToConsent !== true) {
        return res.status(400).json({
          error: 'A documented reason and confirmation that the patient cannot consent are required.',
        });
      }

      const patient = await User.findOne({ role: 'patient', healthPassId });
      if (!patient) {
        return res.status(404).json({ error: GENERIC_VERIFICATION_ERROR });
      }

      const [profile, activeMedicines, allergies, records] = await Promise.all([
        PatientProfile.findOne({ patientId: patient._id }),
        Medicine.find({ patientId: patient._id, isActive: true })
          .sort({ createdAt: -1 })
          .limit(20),
        Allergy.find({ patientId: patient._id, isActive: true }).limit(20),
        HealthRecord.find({ patientId: patient._id, isActive: true })
          .sort({ reportDate: -1, createdAt: -1 })
          .limit(60),
      ]);

      const storedDob = isoDateOnly(patient.dateOfBirth || profile?.dateOfBirth || '');
      // DOB must be on file and match exactly. Missing DOB is never treated as a pass.
      if (!storedDob || storedDob !== submittedDob) {
        return res.status(403).json({ error: GENERIC_VERIFICATION_ERROR });
      }
      if (profile?.verificationStatus === 'Rejected') {
        return res.status(403).json({ error: GENERIC_VERIFICATION_ERROR });
      }

      const labReports = records
        .filter((record) => getMedicalRecordCategory(record) === LAB_CATEGORY)
        .slice(0, 10);
      const accessibleRecords = records
        .filter((record) => getMedicalRecordCategory(record) !== LAB_CATEGORY)
        .slice(0, 20);

      const currentMedicationNames = activeMedicines.map((medicine) => medicine.name).filter(Boolean);

      const auditEntry = await AuditLog.create({
        patientId: patient._id,
        actorId: req.user._id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'EMERGENCY_ACCESS',
        plainSummary: `Emergency access by ${req.user.name} (${req.user.facilityName || 'Provider'}) — patient unable to consent.`,
        details: {
          reason,
          patientUnableToConsent: true,
          healthPassId,
          facilityName: req.user.facilityName || '',
          address: req.ip || '',
        },
      });

      const accessedAt = new Date();
      const summary = {
        accessEventId: auditEntry._id.toString(),
        accessedAt: accessedAt.toISOString(),
        expiresAt: new Date(accessedAt.getTime() + 5 * 60 * 1000).toISOString(),
        reason,
        patient: {
          name: patient.name,
          healthPassId: patient.healthPassId,
          age: patient.age ?? profile?.age ?? null,
          bloodGroup: patient.bloodGroup || profile?.bloodGroup || '',
          knownAllergies: [
            profile?.knownAllergies || '',
            ...allergies.map((allergy) => allergy.allergen).filter(Boolean),
          ]
            .filter(Boolean)
            .join(', '),
          adverseDrugReactions: allergies
            .map((allergy) => [allergy.allergen, allergy.reaction].filter(Boolean).join(' — '))
            .filter(Boolean)
            .join('; '),
          currentMedications:
            profile?.currentMedications || currentMedicationNames.join(', '),
          medicalConditions: profile?.existingConditions || '',
          pastSurgeries: profile?.pastSurgeries || '',
          emergencyContact: profile
            ? {
                name: profile.emergencyContactName || '',
                relation: profile.emergencyContactRelation || '',
                phone: profile.emergencyContactPhone || '',
              }
            : null,
        },
        records: accessibleRecords.map((record) => ({
          id: record._id.toString(),
          category: record.medicalCategory || record.category,
          title: record.title,
          date: record.reportDate || record.createdAt?.toISOString().slice(0, 10) || '',
          summary: recordSummary(record),
          verificationStatus: record.verificationStatus || 'UNKNOWN_UNVERIFIED',
        })),
        prescriptions: activeMedicines.map((medicine) => ({
          medicationName: medicine.name,
          genericName: medicine.genericName || '',
          strength: medicine.strength || '',
          dosage: medicine.dosage || '',
          frequency: medicine.frequency || '',
          validUntil: medicine.endDate || '',
          prescriberName: medicine.prescriberName || '',
        })),
        labFindings: labReports.map((record) => ({
          id: record._id.toString(),
          title: record.title,
          date: record.reportDate || record.createdAt?.toISOString().slice(0, 10) || '',
          summary: recordSummary(record),
          verificationStatus: record.verificationStatus || 'UNKNOWN_UNVERIFIED',
        })),
      };

      return res.status(200).json({ summary });
    } catch {
      return res.status(500).json({ error: 'Emergency access could not be completed.' });
    }
  }
);
