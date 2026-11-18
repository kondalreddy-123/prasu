import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { User } from '../models/User.js';
import { PatientProfile } from '../models/PatientProfile.js';
import { HealthRecord } from '../models/HealthRecord.js';
import { Medicine } from '../models/Medicine.js';
import { Allergy } from '../models/Allergy.js';
import { Consultation } from '../models/Consultation.js';
import { ConsentGrant } from '../models/ConsentGrant.js';
import { AuditLog } from '../models/AuditLog.js';
import {
  authenticate,
  requireRole,
  requireVerifiedDoctor,
  requirePatientConsent,
} from '../middleware/auth.js';
import {
  findDuplicateHealthRecord,
  findDuplicateConsultation,
} from '../utils/duplicates.js';
import {
  getMedicalRecordCategory,
  isMedicalCategoryAuthorized,
} from '../utils/categories.js';

export const providerRouter = express.Router();

function generateOtpCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

// GET /api/provider/directory
// Publicly lists verified doctors for patient selection / directory
providerRouter.get('/directory', async (req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor', isVerified: true })
      .select('name facilityName facilityLevel facilityType email')
      .lean();
    return res.status(200).json({
      doctors: doctors.map((d) => ({
        id: d._id.toString(),
        name: d.name,
        email: d.email,
        facilityName: d.facilityName || 'Medical Facility',
        facilityLevel: d.facilityLevel || 'VILLAGE',
        facilityType: d.facilityType || 'Village Health Centre',
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch doctor directory.' });
  }
});

// POST /api/provider/lookup
// Safe lookup: returns patient name and HealthPass ID ONLY. Does NOT expose medical records.
providerRouter.post('/lookup', authenticate, requireRole('doctor'), requireVerifiedDoctor, async (req, res) => {
  try {
    let { query } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Search query is required.' });
    }

    query = query.trim();

    // Check if query is a signed QR token
    if (query.split('.').length === 3) {
      try {
        const decoded = jwt.verify(
          query,
          process.env.JWT_SECRET || 'healthpass-super-secret-jwt-key-2026'
        );
        if (decoded.patientId) {
          const patient = await User.findById(decoded.patientId);
          if (patient) {
            return res.status(200).json({
              lookup: {
                patientId: patient._id.toString(),
                name: patient.name,
                healthPassId: patient.healthPassId,
                gatewayLabel: 'HealthPass Verified QR Token',
              },
            });
          }
        }
      } catch {
        // Fall back to query search
      }
    }

    const patient = await User.findOne({
      role: 'patient',
      $or: [
        { healthPassId: query.toUpperCase() },
        { email: query.toLowerCase() },
      ],
    });

    if (!patient) {
      return res.status(404).json({ error: 'No patient found with this HealthPass ID.' });
    }

    return res.status(200).json({
      lookup: {
        patientId: patient._id.toString(),
        name: patient.name,
        healthPassId: patient.healthPassId,
        gatewayLabel: 'HealthPass Verified Identity',
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Patient lookup failed.', details: err.message });
  }
});

// POST /api/provider/request-access
providerRouter.post(
  '/request-access',
  authenticate,
  requireRole('doctor'),
  requireVerifiedDoctor,
  async (req, res) => {
    try {
      const {
        patientId,
        purpose = 'Outpatient consultation & medication safety review',
        requestedCategories = [],
        durationHours = 24,
      } = req.body;

      if (!patientId) {
        return res.status(400).json({ error: 'Patient ID is required.' });
      }

      const patient = await User.findOne({ _id: patientId, role: 'patient' });
      if (!patient) return res.status(404).json({ error: 'Patient not found.' });

      // Check if active grant already exists
      const existing = await ConsentGrant.findOne({
        patientId,
        providerId: req.user._id,
        status: 'GRANTED',
        expiresAt: { $gt: new Date() },
      });

      if (existing) {
        return res.status(200).json({ grant: existing.toSafeObject() });
      }

      // Do not create duplicate pending requests; the patient already has one.
      const pending = await ConsentGrant.findOne({
        patientId,
        providerId: req.user._id,
        status: 'PENDING',
        expiresAt: { $gt: new Date() },
      }).sort({ createdAt: -1 });
      if (pending) {
        return res.status(200).json({ grant: pending.toSafeObject() });
      }

      const hours = Math.max(1, Math.min(168, Number(durationHours) || 24));
      const grant = new ConsentGrant({
        patientId,
        providerId: req.user._id,
        providerName: req.user.name,
        providerRole: 'doctor',
        facilityName: req.user.facilityName || 'Clinic / Hospital',
        facilityLevel: req.user.facilityLevel || 'VILLAGE',
        facilityType: req.user.facilityType || 'Health Centre',
        purpose,
        requestedCategories,
        durationHours: hours,
        expiresAt: new Date(Date.now() + hours * 3600000),
        status: 'PENDING',
        otpCode: generateOtpCode(),
        otpGeneratedAt: new Date(),
      });

      await grant.save();

      await AuditLog.create({
        patientId,
        actorId: req.user._id,
        actorName: req.user.name,
        actorRole: 'doctor',
        action: 'ACCESS_REQUESTED',
        plainSummary: `Dr. ${req.user.name} requested clinical access for ${hours} hours.`,
        details: { grantId: grant._id, requestedCategories },
      });

      return res.status(201).json({ grant: grant.toSafeObject() });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to request access.', details: err.message });
    }
  }
);

// POST /api/provider/approve-in-person-otp
// In-person approval: the patient reads the one-time code from their own
// wallet to the clinician. The code is never returned to the provider by any
// read endpoint.
providerRouter.post('/approve-in-person-otp', authenticate, requireRole('doctor'), requireVerifiedDoctor, async (req, res) => {
  try {
    const { grantId, otp, selectedCategories } = req.body || {};
    if (!grantId || !otp) {
      return res.status(400).json({ error: 'Grant ID and one-time code are required.' });
    }

    const grant = await ConsentGrant.findOne({ _id: grantId, providerId: req.user._id });
    if (!grant) return res.status(404).json({ error: 'Consent request not found for this provider.' });
    if (grant.status !== 'PENDING') {
      return res.status(409).json({ code: 'CONSENT_NOT_PENDING', error: 'This consent request is no longer pending.' });
    }
    if (grant.expiresAt && grant.expiresAt <= new Date()) {
      return res.status(403).json({ code: 'ACCESS_EXPIRED', error: 'This consent request has expired. Request access again.' });
    }
    if ((grant.otpAttempts || 0) >= 5) {
      return res.status(429).json({ code: 'OTP_LOCKED', error: 'Too many incorrect codes. Ask the patient to approve from their wallet.' });
    }

    const submitted = String(otp).replace(/\s+/g, '');
    const expected = String(grant.otpCode || '');
    const matches = expected.length === submitted.length && submitted.length > 0
      && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(submitted));

    if (!matches) {
      grant.otpAttempts = (grant.otpAttempts || 0) + 1;
      if (grant.otpAttempts >= 5) grant.otpCode = undefined;
      await grant.save();
      return res.status(403).json({ code: 'INVALID_OTP', error: 'The one-time code is incorrect.' });
    }

    const requested = Array.isArray(selectedCategories) && selectedCategories.length > 0
      ? selectedCategories
      : grant.requestedCategories;
    grant.status = 'GRANTED';
    grant.grantedCategories = requested.length > 0 ? requested : ['General Medical History', 'Medications & Prescriptions', 'Laboratory Reports'];
    grant.decidedAt = new Date();
    grant.expiresAt = new Date(Date.now() + Math.min(168, Number(grant.durationHours) || 24) * 3600000);
    grant.otpCode = undefined;
    await grant.save();

    await AuditLog.create({
      patientId: grant.patientId,
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: 'doctor',
      action: 'CONSENT_GRANTED_IN_PERSON',
      plainSummary: `${req.user.name} confirmed in-person consent with a patient-held one-time code.`,
      details: { grantId: grant._id, grantedCategories: grant.grantedCategories },
    });

    return res.status(200).json({ success: true, grant: grant.toSafeObject() });
  } catch (err) {
    return res.status(400).json({ error: 'Could not verify the in-person code.' });
  }
});

// GET /api/provider/:doctorId/authorized-patients
providerRouter.get(
  '/:doctorId/authorized-patients',
  authenticate,
  requireRole('doctor', 'admin'),
  async (req, res) => {
    try {
      const { doctorId } = req.params;
      if (req.user.role !== 'admin' && req.user._id.toString() !== doctorId) {
        return res.status(403).json({ error: 'You can only view your own authorized patient list.' });
      }
      const now = new Date();

      const grants = await ConsentGrant.find({
        providerId: doctorId,
        status: 'GRANTED',
        expiresAt: { $gt: now },
      }).sort({ createdAt: -1 });

      const patientIds = grants.map((g) => g.patientId);
      const patients = await User.find({ _id: { $in: patientIds } });
      const patientMap = new Map(patients.map((p) => [p._id.toString(), p]));

      const authorizedGrants = grants.map((g) => {
        const p = patientMap.get(g.patientId.toString());
        return {
          ...g.toSafeObject(),
          patientName: p?.name || 'Patient',
          healthPassId: p?.healthPassId || '',
        };
      });

      return res.status(200).json({ authorizedGrants });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch authorized patients.' });
    }
  }
);

// GET /api/provider/patient/:patientId/record
// Strictly guarded by server-side consent check
providerRouter.get(
  '/patient/:patientId/record',
  authenticate,
  requireRole('doctor'),
  requireVerifiedDoctor,
  requirePatientConsent(),
  async (req, res) => {
    try {
      const { patientId } = req.params;
      const grant = req.consentGrant;

      const patientUser = await User.findById(patientId);
      if (!patientUser) return res.status(404).json({ error: 'Patient not found.' });

      const profile = await PatientProfile.findOne({ patientId });
      const can = (category) => isMedicalCategoryAuthorized(grant, category);

      // Query records based on granted categories
      const [allMedicines, allAllergies, allVisits, allReports] = await Promise.all([
        Medicine.find({ patientId, isActive: true }).sort({ createdAt: -1 }),
        Allergy.find({ patientId, isActive: true }).sort({ createdAt: -1 }),
        Consultation.find({ patientId }).sort({ createdAt: -1 }),
        HealthRecord.find({ patientId, isActive: true }).sort({ createdAt: -1 }),
      ]);

      const canAccessMedicationData = can('Medications & Prescriptions');
      const canAccessConsultations = can('Consultation History');
      const canAccessAllergies = can('Allergies');
      const canAccessGeneralHistory = can('General Medical History');
      const canAccessSurgeries = can('Surgeries & Procedures');

      const medicines = canAccessMedicationData ? allMedicines.map((m) => m.toSafeObject()) : [];
      const allergies = canAccessAllergies ? allAllergies.map((a) => a.toSafeObject()) : [];
      const visits = canAccessConsultations ? allVisits.map((v) => v.toSafeObject()) : [];
      const reports = allReports
        .filter((record) => {
          const category = getMedicalRecordCategory(record);
          return isMedicalCategoryAuthorized(grant, category);
        })
        .map((r) => r.toSafeObject());
      const prescriptions = canAccessMedicationData
        ? allVisits
          .filter((visit) => Array.isArray(visit.prescribedMedicines) && visit.prescribedMedicines.length > 0)
          .map((visit) => ({
            id: `rx-${visit._id}`,
            patientId,
            doctorId: visit.doctorId.toString(),
            doctorName: visit.doctorName,
            facilityName: visit.facilityName || '',
            diagnosis: visit.diagnosis,
            date: visit.date,
            encounterDate: visit.encounterDate,
            createdAt: visit.createdAt,
            status: 'ACTIVE',
            consultationId: visit._id.toString(),
            medicines: visit.prescribedMedicines,
          }))
        : [];

      const profileFields = {
        knownAllergies: canAccessAllergies ? profile?.knownAllergies || '' : undefined,
        currentMedications: canAccessMedicationData ? profile?.currentMedications || '' : undefined,
        healthConditions: canAccessGeneralHistory ? profile?.existingConditions || '' : undefined,
        existingConditions: canAccessGeneralHistory ? profile?.existingConditions || '' : undefined,
        pastSurgeries: canAccessSurgeries ? profile?.pastSurgeries || '' : undefined,
        bloodGroup: canAccessGeneralHistory ? profile?.bloodGroup || undefined : undefined,
        // Emergency contacts are patient-only and have no consent scope.
      };
      const hasAuthorizedProfileData = Object.values(profileFields).some(Boolean);
      const authorizedHealthProfile = hasAuthorizedProfileData
        ? {
          ...profileFields,
          source: profile?.source || 'Patient-provided',
          verificationStatus: profile?.verificationStatus || 'Unverified',
          updatedAt: profile?.updatedAt,
        }
        : {};

      const chronicConditions = canAccessGeneralHistory && profile?.existingConditions
        ? String(profile.existingConditions).split(/[,;\n]+/).map((value) => value.trim()).filter(Boolean).map((value, index) => ({
          id: `condition-${index}`,
          simpleLabel: value,
          name: value,
          since: '',
        }))
        : [];

      const labReports = reports.filter((record) => getMedicalRecordCategory(record) === 'Laboratory Reports');

      return res.status(200).json({
        patient: patientUser.toSafeObject(),
        patientHealthProfile: profile ? profile.toSafeObject() : null,
        grant: grant.toSafeObject(),
        healthProfileSection: { shared: hasAuthorizedProfileData, profile: authorizedHealthProfile },
        allergiesSection: { shared: canAccessAllergies, allergies },
        medicinesSection: {
          shared: canAccessMedicationData,
          activeMedicines: medicines.filter((medicine) => medicine.computedStatus === 'ACTIVE'),
          pastMedicines: medicines.filter((medicine) => medicine.computedStatus !== 'ACTIVE'),
        },
        prescriptionsSection: { shared: canAccessMedicationData, prescriptions },
        historySection: { shared: canAccessConsultations || (canAccessGeneralHistory && chronicConditions.length > 0), visits, chronicConditions },
        labReportsSection: { shared: labReports.length > 0, reports: labReports },
        medicalRecordsSection: { shared: reports.length > 0, records: reports },
        // Legacy flat arrays retained for existing API clients.
        medicines,
        allergies,
        visits,
        reports,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to load patient record.', details: err.message });
    }
  }
);

// POST /api/provider/patient/:patientId/consultation
providerRouter.post(
  ['/patient/:patientId/consultation', '/patient/:patientId/consultations'],
  authenticate,
  requireRole('doctor'),
  requireVerifiedDoctor,
  requirePatientConsent('Consultation History'),
  async (req, res) => {
    try {
      const { patientId } = req.params;
      const {
        diagnosis,
        chiefComplaint,
        clinicalNotes,
        prescribedMedicines = [],
        medicines,
        orderedTests = [],
        idempotencyKey,
      } = req.body;

      const candidateMedicines = Array.isArray(medicines) && medicines.length > 0
        ? medicines
        : prescribedMedicines;

      if (!diagnosis || !diagnosis.trim()) {
        return res.status(400).json({ error: 'Diagnosis is required.' });
      }

      // Check idempotency & duplicate consultation
      const existing = await findDuplicateConsultation(patientId, {
        diagnosis,
        chiefComplaint,
        clinicalNotes,
        idempotencyKey,
      });

      if (existing) {
        if (existing.isIdempotentReplay) {
          return res.status(200).json({
            success: true,
            consultationRecorded: true,
            visit: existing.consultation.toSafeObject(),
            idempotentReplay: true,
          });
        }
        return res.status(409).json({
          code: 'DUPLICATE_MEDICAL_RECORD',
          error: 'A matching active consultation record already exists for this encounter.',
          existingRecordId: existing.consultation._id.toString(),
        });
      }

      const consultation = new Consultation({
        patientId,
        doctorId: req.user._id,
        doctorName: req.user.name,
        facilityName: req.user.facilityName || 'Clinic / Hospital',
        facilityLevel: req.user.facilityLevel || 'VILLAGE',
        facilityType: req.user.facilityType || 'Health Centre',
        diagnosis: diagnosis.trim(),
        chiefComplaint: chiefComplaint ? chiefComplaint.trim() : '',
        clinicalNotes: clinicalNotes ? clinicalNotes.trim() : '',
        prescribedMedicines: candidateMedicines,
        orderedTests,
        idempotencyKey,
      });

      await consultation.save();

      // Add prescribed medicines to patient's active medication list
      for (const med of candidateMedicines) {
        if (med.name && med.name.trim()) {
          const newMed = new Medicine({
            patientId,
            name: med.name.trim(),
            strength: med.strength ? med.strength.trim() : '',
            dosage: med.dosage || '1 tablet',
            route: med.route || 'Oral',
            foodInstruction: med.foodInstruction || 'After food',
            notes: med.notes || '',
            prescriberName: req.user.name,
            facilityName: req.user.facilityName || '',
            facilityLevel: req.user.facilityLevel || '',
            facilityType: req.user.facilityType || '',
            consultationId: consultation._id,
            source: 'CLINICAL_PRESCRIPTION',
            computedStatus: 'ACTIVE',
            durationDays: Number(med.durationDays) || 5,
            daysRemaining: Number(med.durationDays) || 5,
          });
          await newMed.save();
        }
      }

      await AuditLog.create({
        patientId,
        actorId: req.user._id,
        actorName: req.user.name,
        actorRole: 'doctor',
        action: 'CONSULTATION_CREATED',
        plainSummary: `Dr. ${req.user.name} recorded consultation: ${consultation.diagnosis}`,
        details: { consultationId: consultation._id },
      });

      return res.status(201).json({
        success: true,
        consultationRecorded: true,
        visit: consultation.toSafeObject(),
      });
    } catch (err) {
      return res.status(400).json({ error: 'Failed to record consultation.', details: err.message });
    }
  }
);

// POST /api/provider/patient/:patientId/reports
providerRouter.post(
  '/patient/:patientId/reports',
  authenticate,
  requireRole('doctor'),
  requireVerifiedDoctor,
  requirePatientConsent(),
  async (req, res) => {
    try {
      const { patientId } = req.params;
      const body = req.body;
      if (!body.title || !body.title.trim()) {
        return res.status(400).json({ error: 'Report title is required.' });
      }

      const category = body.category || body.medicalCategory || 'Lab reports';
      const reportDate = body.reportDate || body.extractedFields?.reportDate || new Date().toISOString().slice(0, 10);

      const duplicate = await findDuplicateHealthRecord(patientId, {
        category,
        title: body.title,
        reportDate,
        documentFingerprint: body.documentFingerprint,
        idempotencyKey: body.idempotencyKey,
      });

      if (duplicate) {
        return res.status(409).json({
          code: 'DUPLICATE_MEDICAL_RECORD',
          error: 'A matching active medical record already exists.',
          existingRecordId: duplicate._id.toString(),
        });
      }

      const report = new HealthRecord({
        patientId,
        category,
        medicalCategory: body.medicalCategory || category,
        title: body.title.trim(),
        resultSummary: body.resultSummary || '',
        plainExplanation: body.plainExplanation || '',
        statusColor: body.statusColor || 'NORMAL',
        reportDate,
        facilityName: req.user.facilityName || body.facilityName || 'Medical Facility',
        facilityLevel: req.user.facilityLevel || body.facilityLevel || '',
        facilityType: req.user.facilityType || body.facilityType || '',
        source: 'DOCTOR_UPLOAD',
        uploaderId: req.user._id,
        uploaderRole: 'doctor',
        verificationStatus: 'CLINICIAN_CONFIRMED',
        extractedFields: body.extractedFields || {},
        fileDataUrl: body.fileDataUrl || '',
      });

      await report.save();

      await AuditLog.create({
        patientId,
        actorId: req.user._id,
        actorName: req.user.name,
        actorRole: 'doctor',
        action: 'REPORT_UPLOADED',
        plainSummary: `Dr. ${req.user.name} uploaded report: ${report.title}`,
        details: { reportId: report._id },
      });

      return res.status(201).json({ success: true, report: report.toSafeObject() });
    } catch (err) {
      return res.status(400).json({ error: 'Failed to upload report.', details: err.message });
    }
  }
);
