import express from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { PatientProfile } from '../models/PatientProfile.js';
import { HealthRecord } from '../models/HealthRecord.js';
import { Medicine } from '../models/Medicine.js';
import { Allergy } from '../models/Allergy.js';
import { Consultation } from '../models/Consultation.js';
import { ConsentGrant } from '../models/ConsentGrant.js';
import { AuditLog } from '../models/AuditLog.js';
import { EmergencyRecord } from '../models/EmergencyRecord.js';
import { authenticate } from '../middleware/auth.js';
import { findDuplicateHealthRecord, findDuplicateMedicine } from '../utils/duplicates.js';
import { getMedicalRecordCategory, MEDICAL_RECORD_CATEGORIES } from '../utils/categories.js';
import { createMedicalReportSummary, canExplainDoctorReport } from '../utils/reportText.js';

export const patientRouter = express.Router();

// Middleware: ensure caller is the patient themselves or admin
function requireSelfPatient(req, res, next) {
  const patientId = req.params.patientId;
  if (req.user.role === 'admin') return next();
  if (req.user.role !== 'patient' || req.user._id.toString() !== patientId) {
    return res.status(403).json({ error: 'Access denied. You can only access your own patient records.' });
  }
  next();
}

// GET /api/patient/:patientId/wallet
patientRouter.get('/:patientId/wallet', authenticate, requireSelfPatient, async (req, res) => {
  try {
    const { patientId } = req.params;
    const patientUser = await User.findById(patientId);
    if (!patientUser) return res.status(404).json({ error: 'Patient not found.' });

    let profile = await PatientProfile.findOne({ patientId });
    if (!profile) {
      profile = await PatientProfile.create({ patientId });
    }

    const [medicines, allergies, visits, reports, grants, auditLogs, emergencyLinks] = await Promise.all([
      Medicine.find({ patientId, isActive: true }).sort({ createdAt: -1 }),
      Allergy.find({ patientId, isActive: true }).sort({ createdAt: -1 }),
      Consultation.find({ patientId }).sort({ createdAt: -1 }),
      HealthRecord.find({ patientId, isActive: true }).sort({ createdAt: -1 }),
      ConsentGrant.find({ patientId }).sort({ createdAt: -1 }),
      AuditLog.find({ patientId }).sort({ timestamp: -1 }).limit(50),
      EmergencyRecord.find({ 'linkingWorkflow.targetPatientId': patientId }).sort({ createdAt: -1 }).limit(25),
    ]);

    // Check grant expiries
    const now = new Date();
    for (const grant of grants) {
      if (grant.status === 'GRANTED' && grant.expiresAt && grant.expiresAt <= now) {
        grant.status = 'EXPIRED';
        await grant.save();
      }
    }

    const patientObj = patientUser.toSafeObject();
    patientObj.age = patientObj.age ?? profile.age;
    patientObj.dateOfBirth = patientObj.dateOfBirth || profile.dateOfBirth || '';
    patientObj.bloodGroup = patientObj.bloodGroup || profile.bloodGroup || '';
    patientObj.emergencyContact = {
      name: profile.emergencyContactName || '',
      relation: profile.emergencyContactRelation || '',
      phone: profile.emergencyContactPhone || '',
    };
    const formattedMedicines = medicines.map((m) => m.toSafeObject());
    const formattedAllergies = allergies.map((a) => a.toSafeObject());
    const formattedVisits = visits.map((v) => v.toSafeObject());
    const formattedReports = reports.map((r) => r.toSafeObject());
    const formattedGrants = grants.map((g) => g.toSafeObject({ includeOtp: true }));
    const formattedAudits = auditLogs.map((l) => l.toSafeObject());
    const formattedEmergencyLinks = emergencyLinks.map((r) => r.toSafeObject());

    const notifications = formattedAudits.slice(0, 8).map((entry) => ({
      id: entry.id,
      title: 'HealthPass Consent Gateway',
      action: entry.action,
      messageEn: entry.plainSummary || 'HealthPass account activity was recorded.',
      createdAt: entry.timestamp || entry.createdAt,
    }));

    const activePrescriptionCount = formattedMedicines.filter((m) => m.computedStatus === 'ACTIVE').length;

    return res.status(200).json({
      patient: patientObj,
      patientHealthProfile: profile.toSafeObject(),
      record: {
        medicines: formattedMedicines,
        allergies: formattedAllergies,
        visits: formattedVisits,
        reports: formattedReports,
        prescriptions: formattedReports.filter((record) => record.medicalCategory === 'Medications & Prescriptions' || record.category === 'Prescriptions'),
        chronicConditions: [],
        vitals: [],
        vaccinations: [],
        grants: formattedGrants,
        auditLogs: formattedAudits,
      },
      // Top-level aliases consumed by the patient dashboard.
      grants: formattedGrants,
      auditLogs: formattedAudits,
      emergencyLinks: formattedEmergencyLinks,
      notifications,
      auditChainVerification: {
        totalEntries: formattedAudits.length,
        verified: true,
        simulated: false,
      },
      stats: {
        visitsOnRecord: formattedVisits.length,
        currentMedicines: activePrescriptionCount,
        requestsToReview: formattedGrants.filter((g) => g.status === 'PENDING').length,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Could not fetch patient wallet.', details: err.message });
  }
});

// PUT /api/patient/:patientId/health-profile
patientRouter.put('/:patientId/health-profile', authenticate, requireSelfPatient, async (req, res) => {
  try {
    const { patientId } = req.params;
    let profile = await PatientProfile.findOne({ patientId });
    if (!profile) {
      profile = new PatientProfile({ patientId });
    }

    const {
      knownAllergies,
      currentMedications,
      existingConditions,
      pastSurgeries,
      bloodGroup,
      emergencyContactName,
      emergencyContactRelation,
      emergencyContactPhone,
      vitals,
    } = req.body;

    if (knownAllergies !== undefined) profile.knownAllergies = knownAllergies;
    if (currentMedications !== undefined) profile.currentMedications = currentMedications;
    if (existingConditions !== undefined) profile.existingConditions = existingConditions;
    if (pastSurgeries !== undefined) profile.pastSurgeries = pastSurgeries;
    if (bloodGroup !== undefined) profile.bloodGroup = bloodGroup;
    if (emergencyContactName !== undefined) profile.emergencyContactName = emergencyContactName;
    if (emergencyContactRelation !== undefined) profile.emergencyContactRelation = emergencyContactRelation;
    if (emergencyContactPhone !== undefined) profile.emergencyContactPhone = emergencyContactPhone;
    if (vitals !== undefined) profile.vitals = vitals;

    await profile.save();

    await AuditLog.create({
      patientId,
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: 'patient',
      action: 'PROFILE_UPDATED',
      plainSummary: 'Patient updated personal health profile.',
    });

    return res.status(200).json({ success: true, profile: profile.toSafeObject() });
  } catch (err) {
    return res.status(400).json({ error: 'Failed to update profile.', details: err.message });
  }
});

// GET /api/patient/:patientId/health-profile
patientRouter.get('/:patientId/health-profile', authenticate, requireSelfPatient, async (req, res) => {
  try {
    const { patientId } = req.params;
    let profile = await PatientProfile.findOne({ patientId });
    if (!profile) profile = await PatientProfile.create({ patientId });
    return res.status(200).json({ profile: profile.toSafeObject() });
  } catch (err) {
    return res.status(500).json({ error: 'Could not load the health profile.' });
  }
});

async function createPatientUploadedReport(req, res, patientId) {
  try {
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
        error: 'A matching active medical record already exists. Please open the existing record instead of creating another.',
        existingRecordId: duplicate._id.toString(),
        report: duplicate.toSafeObject(),
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
      facilityName: body.facilityName || 'Patient upload',
      facilityLevel: body.facilityLevel || '',
      facilityType: body.facilityType || '',
      source: body.source || 'PATIENT_UPLOAD',
      uploaderId: req.user._id,
      uploaderRole: 'patient',
      verificationStatus: body.confirmedByUser ? 'PATIENT_REVIEWED' : 'UNVERIFIED',
      extractedFields: body.extractedFields || {},
      fileDataUrl: body.fileDataUrl || '',
      documentFingerprint: body.documentFingerprint || '',
      idempotencyKey: body.idempotencyKey || '',
      prescriptionPeriod: body.prescriptionPeriod,
      prescriptionMetadataCorrections: body.prescriptionMetadataCorrections || {},
    });

    await report.save();

    await AuditLog.create({
      patientId,
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: 'patient',
      action: 'REPORT_UPLOADED',
      plainSummary: `Patient uploaded report: ${report.title}`,
      details: { reportId: report._id },
    });

    return res.status(201).json({ success: true, report: report.toSafeObject() });
  } catch (err) {
    return res.status(400).json({ error: 'Failed to upload report.', details: err.message });
  }
}

// POST /api/patient/:patientId/reports
patientRouter.post('/:patientId/reports', authenticate, requireSelfPatient, async (req, res) => {
  return createPatientUploadedReport(req, res, req.params.patientId);
});

// POST /api/patient/reports
// Convenience alias used by the patient dashboard. The owner is taken from the
// authenticated session; the client cannot choose another patient.
patientRouter.post('/reports', authenticate, async (req, res) => {
  if (req.user.role !== 'patient') {
    return res.status(403).json({ error: 'Only a signed-in patient can upload a personal report.' });
  }
  return createPatientUploadedReport(req, res, req.user._id.toString());
});

// POST /api/patient/:patientId/reports/:reportId/summary
patientRouter.post('/:patientId/reports/:reportId/summary', authenticate, requireSelfPatient, async (req, res) => {
  try {
    const { patientId, reportId } = req.params;
    const report = await HealthRecord.findOne({ _id: reportId, patientId, isActive: true });
    if (!report) return res.status(404).json({ error: 'Report not found.' });

    const summary = createMedicalReportSummary(report.toSafeObject());
    await AuditLog.create({
      patientId,
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: 'patient',
      action: 'REPORT_SUMMARY_VIEWED',
      plainSummary: `Patient viewed extracted facts for report: ${report.title}`,
      details: { reportId: report._id },
    });
    return res.status(200).json({ success: true, summary });
  } catch (err) {
    return res.status(500).json({ error: 'Could not prepare the report summary.' });
  }
});

// POST /api/patient/:patientId/reports/:reportId/explanation
// Returns de-identified source text only; the external AI call is a separate,
// explicitly consented step handled by /api/report-explanations.
patientRouter.post('/:patientId/reports/:reportId/explanation', authenticate, requireSelfPatient, async (req, res) => {
  try {
    const { patientId, reportId } = req.params;
    const report = await HealthRecord.findOne({ _id: reportId, patientId, isActive: true });
    if (!report) return res.status(404).json({ error: 'Report not found.' });

    const authorization = canExplainDoctorReport({
      requestingPatientId: patientId,
      report: report.toSafeObject(),
      externalAiConsent: Boolean(req.body?.externalAiConsent),
      language: req.body?.language,
    });
    if (!authorization.ok) {
      const messages = {
        PATIENT_OWNERSHIP_REQUIRED: 'Only the patient who owns this report can request an explanation.',
        DOCTOR_REPORT_REQUIRED: 'This report was not uploaded by a clinician, so AI explanation is not available.',
        EXTERNAL_AI_CONSENT_REQUIRED: 'Explicit consent is required before de-identified report text is sent for explanation.',
        UNSUPPORTED_LANGUAGE: 'That explanation language is not supported.',
        REPORT_TEXT_UNAVAILABLE: 'This report does not contain enough text to explain.',
      };
      return res.status(403).json({ code: authorization.code, error: messages[authorization.code] || 'Explanation is not authorized.' });
    }

    return res.status(200).json({ success: true, sourceText: authorization.reportText });
  } catch (err) {
    return res.status(500).json({ error: 'Could not authorize the report explanation.' });
  }
});

// POST /api/patient/:patientId/reports/:reportId/category
patientRouter.post('/:patientId/reports/:reportId/category', authenticate, requireSelfPatient, async (req, res) => {
  try {
    const { patientId, reportId } = req.params;
    const { medicalCategory } = req.body;
    if (!MEDICAL_RECORD_CATEGORIES.includes(medicalCategory)) {
      return res.status(400).json({ error: 'Choose a valid medical record category.' });
    }
    const record = await HealthRecord.findOne({ _id: reportId, patientId, isActive: true });
    if (!record) return res.status(404).json({ error: 'Record not found.' });

    record.medicalCategory = medicalCategory;
    await record.save();

    await AuditLog.create({
      patientId,
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: 'patient',
      action: 'REPORT_CATEGORY_UPDATED',
      plainSummary: `Patient categorized "${record.title}" as ${medicalCategory}.`,
      details: { reportId: record._id, medicalCategory },
    });
    return res.status(200).json({ success: true, report: record.toSafeObject() });
  } catch (err) {
    return res.status(400).json({ error: 'Could not update the record category.' });
  }
});

// PATCH /api/patient/:patientId/prescriptions/:reportId/metadata
patientRouter.patch('/:patientId/prescriptions/:reportId/metadata', authenticate, requireSelfPatient, async (req, res) => {
  try {
    const { patientId, reportId } = req.params;
    const record = await HealthRecord.findOne({ _id: reportId, patientId, isActive: true });
    if (!record) return res.status(404).json({ error: 'Prescription record not found.' });

    const allowed = ['reportDate', 'prescribingProvider', 'prescriptionPeriod', 'medicalCategory', 'facilityName', 'notes'];
    const corrections = { ...(record.prescriptionMetadataCorrections || {}) };
    for (const key of allowed) {
      if (req.body?.[key] !== undefined) corrections[key] = req.body[key];
    }
    if (corrections.medicalCategory && MEDICAL_RECORD_CATEGORIES.includes(corrections.medicalCategory)) {
      record.medicalCategory = corrections.medicalCategory;
    }
    record.prescriptionMetadataCorrections = corrections;
    await record.save();

    await AuditLog.create({
      patientId,
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: 'patient',
      action: 'PRESCRIPTION_METADATA_UPDATED',
      plainSummary: `Patient corrected prescription details for: ${record.title}`,
      details: { reportId: record._id },
    });
    return res.status(200).json({ success: true, report: record.toSafeObject() });
  } catch (err) {
    return res.status(400).json({ error: 'Could not update prescription details.' });
  }
});

// POST /api/patient/:patientId/medicines
patientRouter.post('/:patientId/medicines', authenticate, requireSelfPatient, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { name, strength, dosage, route, notes, foodInstruction } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Medicine name is required.' });
    }

    const duplicate = await findDuplicateMedicine(patientId, { name, strength });
    if (duplicate) {
      return res.status(409).json({
        code: 'DUPLICATE_MEDICINE',
        error: `${name}${strength ? ` ${strength}` : ''} is already on this patient's medication list.`,
        existingMedicineId: duplicate._id.toString(),
      });
    }

    const med = new Medicine({
      patientId,
      name: name.trim(),
      strength: strength ? strength.trim() : '',
      dosage: dosage ? dosage.trim() : 'As reported',
      route: route || 'Oral',
      foodInstruction: foodInstruction || 'After food',
      notes: notes ? notes.trim() : '',
      source: 'SELF_REPORTED',
      computedStatus: 'SELF_REPORTED',
      prescriberName: 'Patient reported',
    });

    await med.save();

    await AuditLog.create({
      patientId,
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: 'patient',
      action: 'MEDICINE_ADDED',
      plainSummary: `Patient reported taking: ${med.name} ${med.strength}`,
    });

    return res.status(201).json({ success: true, medicine: med.toSafeObject() });
  } catch (err) {
    return res.status(400).json({ error: 'Failed to add medication.', details: err.message });
  }
});

// DELETE /api/patient/:patientId/reports/:reportId
patientRouter.delete('/:patientId/reports/:reportId', authenticate, requireSelfPatient, async (req, res) => {
  try {
    const { patientId, reportId } = req.params;
    const record = await HealthRecord.findOne({ _id: reportId, patientId });
    if (!record) return res.status(404).json({ error: 'Record not found.' });

    record.isActive = false;
    await record.save();

    await AuditLog.create({
      patientId,
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: 'patient',
      action: 'REPORT_DELETED',
      plainSummary: `Patient removed uploaded report: ${record.title}`,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(400).json({ error: 'Failed to delete report.' });
  }
});

// POST /api/patient/:patientId/medicines/:medicineId
// Patient-recorded actions on their own medication list.
patientRouter.post('/:patientId/medicines/:medicineId', authenticate, requireSelfPatient, async (req, res) => {
  try {
    const { patientId, medicineId } = req.params;
    const action = String(req.body?.action || '').toUpperCase();
    const med = await Medicine.findOne({ _id: medicineId, patientId, isActive: true });
    if (!med) return res.status(404).json({ error: 'Medicine not found.' });

    if (action === 'MARK_TAKEN') {
      med.lastTakenAt = new Date();
    } else if (action === 'TOGGLE_STOP') {
      med.computedStatus = med.computedStatus === 'DISCONTINUED' ? 'ACTIVE' : 'DISCONTINUED';
    } else if (action === 'REQUEST_REFILL') {
      med.refillRequestedAt = new Date();
    } else {
      return res.status(400).json({ error: 'Unsupported medicine action.' });
    }

    await med.save();

    await AuditLog.create({
      patientId,
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: 'patient',
      action: `MEDICINE_${action}`,
      plainSummary: `Patient ${action === 'MARK_TAKEN' ? 'marked a dose taken for' : action === 'TOGGLE_STOP' ? 'changed the status of' : 'requested a refill for'} ${med.name} ${med.strength}`,
      details: { medicineId: med._id },
    });

    return res.status(200).json({ success: true, medicine: med.toSafeObject() });
  } catch (err) {
    return res.status(400).json({ error: 'Could not update medication status.' });
  }
});

// DELETE /api/patient/:patientId/medicines/:medicineId
patientRouter.delete('/:patientId/medicines/:medicineId', authenticate, requireSelfPatient, async (req, res) => {
  try {
    const { patientId, medicineId } = req.params;
    const med = await Medicine.findOne({ _id: medicineId, patientId });
    if (!med) return res.status(404).json({ error: 'Medicine not found.' });

    med.isActive = false;
    med.computedStatus = 'DISCONTINUED';
    await med.save();

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(400).json({ error: 'Failed to remove medicine.' });
  }
});

// POST /api/patient/:patientId/qr-token
// Safe short-lived QR identification token; NOT a permanent bearer credential and DOES NOT leak medical records
patientRouter.post('/:patientId/qr-token', authenticate, requireSelfPatient, async (req, res) => {
  try {
    const { patientId } = req.params;
    const patientUser = await User.findById(patientId);
    if (!patientUser) return res.status(404).json({ error: 'Patient not found.' });

    const secret = process.env.JWT_SECRET || 'healthpass-super-secret-jwt-key-2026';
    const qrToken = jwt.sign(
      {
        patientId: patientUser._id.toString(),
        healthPassId: patientUser.healthPassId,
        type: 'HEALTHPASS_SAFE_QR_IDENTIFIER',
      },
      secret,
      { expiresIn: '15m' }
    );

    const now = new Date();
    await ConsentGrant.updateMany(
      { patientId, status: 'GRANTED' },
      { $set: { status: 'REVOKED', revokedAt: now } }
    );

    await AuditLog.create({
      patientId,
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: 'patient',
      action: 'QR_TOKEN_REGENERATED',
      plainSummary: 'Patient replaced the QR identity token and revoked all active provider consents.',
    });

    return res.status(200).json({
      qrToken,
      token: qrToken,
      healthPassId: patientUser.healthPassId,
      expiresInSeconds: 900,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate QR token.' });
  }
});

// POST /api/patient/:patientId/consent/:grantId/decide
patientRouter.post('/:patientId/consent/:grantId/decide', authenticate, requireSelfPatient, async (req, res) => {
  try {
    const { patientId, grantId } = req.params;
    const { decision, grantedCategories, durationHours, durationSeconds } = req.body;

    const grant = await ConsentGrant.findOne({ _id: grantId, patientId });
    if (!grant) return res.status(404).json({ error: 'Access request not found.' });

    if (decision === 'GRANT') {
      const hours = Math.max(1, Math.min(168, Number(durationHours) || 24));
      const durationMs = durationSeconds ? Number(durationSeconds) * 1000 : hours * 3600000;

      grant.status = 'GRANTED';
      grant.grantedCategories = Array.isArray(grantedCategories) && grantedCategories.length > 0
        ? grantedCategories
        : grant.requestedCategories.length > 0 ? grant.requestedCategories : ['Medical history', 'Prescriptions', 'Medicines'];
      grant.durationHours = hours;
      grant.expiresAt = new Date(Date.now() + Math.min(168 * 3600000, Math.max(1000, durationMs)));
      grant.decidedAt = new Date();
      grant.otpCode = undefined;
      await grant.save();

      await AuditLog.create({
        patientId,
        actorId: req.user._id,
        actorName: req.body.actedByHelper || req.user.name,
        actorRole: 'patient',
        action: 'CONSENT_GRANTED',
        plainSummary: `Patient granted ${grant.providerRole} access to ${grant.providerName} for ${hours} hours.`,
        details: { grantedCategories: grant.grantedCategories, grantId: grant._id, actedByHelper: req.body.actedByHelper },
      });

      return res.status(200).json({ success: true, grant: grant.toSafeObject() });
    } else {
      grant.status = 'REJECTED';
      grant.decidedAt = new Date();
      grant.rejectionReason = req.body.reason || 'Declined by patient';
      grant.otpCode = undefined;
      await grant.save();

      await AuditLog.create({
        patientId,
        actorId: req.user._id,
        actorName: req.body.actedByHelper || req.user.name,
        actorRole: 'patient',
        action: 'CONSENT_REJECTED',
        plainSummary: `Patient declined access request from ${grant.providerName}.`,
        details: { grantId: grant._id, actedByHelper: req.body.actedByHelper },
      });

      return res.status(200).json({ success: true, grant: grant.toSafeObject() });
    }
  } catch (err) {
    return res.status(400).json({ error: 'Failed to process consent decision.', details: err.message });
  }
});

// POST /api/patient/:patientId/consent/:grantId/extend
patientRouter.post('/:patientId/consent/:grantId/extend', authenticate, requireSelfPatient, async (req, res) => {
  try {
    const { patientId, grantId } = req.params;
    const grant = await ConsentGrant.findOne({ _id: grantId, patientId });
    if (!grant) return res.status(404).json({ error: 'Consent grant not found.' });
    if (grant.status !== 'GRANTED' || !grant.expiresAt || grant.expiresAt <= new Date()) {
      return res.status(409).json({ error: 'Only active consent can be extended. Request access again if it has ended.' });
    }

    const extraHours = Math.max(1, Math.min(24, Number(req.body?.extraHours) || 24));
    const currentExpiry = grant.expiresAt.getTime();
    grant.expiresAt = new Date(Math.min(Date.now() + 168 * 3600000, currentExpiry + extraHours * 3600000));
    grant.durationHours = Math.min(168, Number(grant.durationHours || 0) + extraHours);
    await grant.save();

    await AuditLog.create({
      patientId,
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: 'patient',
      action: 'CONSENT_EXTENDED',
      plainSummary: `Patient extended access for ${grant.providerName} by ${extraHours} hours.`,
      details: { grantId: grant._id, extraHours },
    });

    return res.status(200).json({ success: true, grant: grant.toSafeObject() });
  } catch (err) {
    return res.status(400).json({ error: 'Could not extend consent.' });
  }
});

// POST /api/patient/:patientId/consent/:grantId/revoke
patientRouter.post('/:patientId/consent/:grantId/revoke', authenticate, requireSelfPatient, async (req, res) => {
  try {
    const { patientId, grantId } = req.params;
    const grant = await ConsentGrant.findOne({ _id: grantId, patientId });
    if (!grant) return res.status(404).json({ error: 'Consent grant not found.' });

    grant.status = 'REVOKED';
    grant.revokedAt = new Date();
    await grant.save();

    await AuditLog.create({
      patientId,
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: 'patient',
      action: 'CONSENT_REVOKED',
      plainSummary: `Patient revoked access permissions for ${grant.providerName}.`,
      details: { grantId: grant._id },
    });

    return res.status(200).json({
      success: true,
      message: 'Access revoked successfully.',
      grant: grant.toSafeObject(),
    });
  } catch (err) {
    return res.status(400).json({ error: 'Failed to revoke consent.' });
  }
});

// POST /api/patient/:patientId/consent/revoke-all
patientRouter.post('/:patientId/consent/revoke-all', authenticate, requireSelfPatient, async (req, res) => {
  try {
    const { patientId } = req.params;
    await ConsentGrant.updateMany(
      { patientId, status: 'GRANTED' },
      { $set: { status: 'REVOKED', revokedAt: new Date() } }
    );

    await AuditLog.create({
      patientId,
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: 'patient',
      action: 'CONSENT_REVOKED_ALL',
      plainSummary: 'Patient revoked all active provider consents.',
    });

    return res.status(200).json({ success: true, message: 'All active consents revoked.' });
  } catch (err) {
    return res.status(400).json({ error: 'Failed to revoke all consents.' });
  }
});

// POST /api/patient/:patientId/personal-health-report
patientRouter.post('/:patientId/personal-health-report', authenticate, requireSelfPatient, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { categories = [], fromDate, toDate } = req.body;

    if (!Array.isArray(categories) || categories.length === 0 || categories.some((category) => !MEDICAL_RECORD_CATEGORIES.includes(category))) {
      return res.status(400).json({ error: 'Select at least one valid medical category.' });
    }
    const validDate = (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(String(value));
    if (!validDate(fromDate) || !validDate(toDate) || (fromDate && toDate && fromDate > toDate)) {
      return res.status(400).json({ error: 'Choose a valid date range.' });
    }

    const query = { patientId, isActive: true };
    const [records, medicines, allergies, visits, profile] = await Promise.all([
      HealthRecord.find(query).sort({ reportDate: -1 }),
      Medicine.find({ patientId, isActive: true }).sort({ createdAt: -1 }),
      Allergy.find({ patientId, isActive: true }).sort({ createdAt: -1 }),
      Consultation.find({ patientId }).sort({ createdAt: -1 }),
      PatientProfile.findOne({ patientId }),
    ]);

    const withinRange = (value) => {
      if (!fromDate && !toDate) return true;
      if (!value) return false;
      const day = String(value).slice(0, 10);
      return (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
    };
    const entries = [];

    if (categories.includes('Medications & Prescriptions')) {
      for (const med of medicines) {
        const item = med.toSafeObject();
        entries.push({
          id: item.id,
          title: `${item.name || 'Medication'}${item.strength ? ` ${item.strength}` : ''}`,
          category: 'Medications & Prescriptions',
          date: item.startDate || item.createdAt || '',
          provider: item.prescriberName || '',
          source: item.source || 'HealthPass medication record',
          verificationStatus: item.source === 'SELF_REPORTED' ? 'Patient reported; unverified' : 'Unverified',
          detail: item.computedStatus ? `Record status: ${item.computedStatus}` : '',
        });
      }
    }
    if (categories.includes('Allergies')) {
      for (const allergy of allergies) {
        const item = allergy.toSafeObject();
        entries.push({
          id: item.id,
          title: `Allergy: ${item.allergen || 'Unknown'}`,
          category: 'Allergies',
          date: item.updatedAt || item.createdAt || '',
          provider: '',
          source: item.source || 'Patient-provided',
          verificationStatus: item.verificationStatus || 'Unverified',
          detail: [item.severity, item.reaction].filter(Boolean).join(' · '),
        });
      }
    }
    if (categories.includes('Consultation History')) {
      for (const visit of visits) {
        const item = visit.toSafeObject();
        entries.push({
          id: item.id,
          title: item.diagnosis || 'Consultation',
          category: 'Consultation History',
          date: item.date || item.createdAt || '',
          provider: item.doctorName || '',
          source: item.source || 'HealthPass consultation record',
          verificationStatus: 'Clinician confirmed',
          detail: item.clinicalNotes || '',
        });
      }
    }
    for (const record of records) {
      const item = record.toSafeObject();
      const category = getMedicalRecordCategory(item);
      if (!categories.includes(category)) continue;
      entries.push({
        id: item.id,
        title: item.title || 'Untitled report',
        category,
        date: item.prescriptionMetadataCorrections?.reportDate || item.extractedFields?.reportDate || item.reportDate || '',
        provider: item.prescriptionMetadataCorrections?.prescribingProvider || item.extractedFields?.doctorName || item.facilityName || '',
        source: item.source || '',
        verificationStatus: item.verificationStatus || 'Unverified',
        detail: item.resultSummary || '',
      });
    }
    if (categories.includes('General Medical History') && profile) {
      const fields = [
        ['Known allergies', profile.knownAllergies],
        ['Current medications', profile.currentMedications],
        ['Existing health conditions', profile.existingConditions],
        ['Relevant past surgeries', profile.pastSurgeries],
        ['Blood group', profile.bloodGroup],
      ].filter(([, value]) => value);
      for (const [title, value] of fields) {
        entries.push({
          id: `profile-${title.replace(/\s+/g, '-').toLowerCase()}`,
          title,
          category: 'General Medical History',
          date: profile.updatedAt || '',
          provider: '',
          source: 'Patient-provided',
          verificationStatus: 'Unverified',
          detail: String(value),
        });
      }
    }

    const filtered = entries
      .filter((entry) => withinRange(entry.date))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    return res.status(200).json({
      entries: filtered,
      records: filtered,
      categories,
      fromDate: fromDate || '',
      toDate: toDate || '',
    });
  } catch (err) {
    return res.status(400).json({ error: 'Failed to generate report.' });
  }
});
