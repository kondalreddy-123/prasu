import express from 'express';
import crypto from 'node:crypto';
import { User } from '../models/User.js';
import { HealthRecord } from '../models/HealthRecord.js';
import { ConsentGrant } from '../models/ConsentGrant.js';
import { AuditLog } from '../models/AuditLog.js';
import { authenticate, requireVerifiedProvider } from '../middleware/auth.js';
import { findDuplicateHealthRecord } from '../utils/duplicates.js';
import { isMedicalCategoryAuthorized, LAB_CATEGORY } from '../utils/categories.js';

export const labRouter = express.Router();

function generateOtpCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

// POST /api/lab/patient-lookup
labRouter.post('/patient-lookup', authenticate, requireVerifiedProvider('lab', 'admin'), async (req, res) => {
  try {
    const { healthPassId } = req.body;
    if (!healthPassId) return res.status(400).json({ error: 'HealthPass ID is required.' });

    const patient = await User.findOne({
      role: 'patient',
      healthPassId: healthPassId.toUpperCase().trim(),
    });
    if (!patient) return res.status(404).json({ error: 'No patient matches that HealthPass ID.' });

    const grant = await ConsentGrant.findOne({
      patientId: patient._id,
      providerId: req.user._id,
    }).sort({ createdAt: -1 });

    const now = new Date();
    let accessStatus = 'NONE';
    if (grant) {
      if (grant.status === 'PENDING') accessStatus = 'PENDING';
      else if (grant.status === 'REJECTED' || grant.status === 'DENIED') accessStatus = 'REJECTED';
      else if (grant.status === 'REVOKED') accessStatus = 'REVOKED';
      else if (grant.status === 'EXPIRED' || (grant.expiresAt && grant.expiresAt <= now)) {
        accessStatus = 'EXPIRED';
        if (grant.status !== 'EXPIRED') {
          grant.status = 'EXPIRED';
          await grant.save();
        }
      } else if (grant.status === 'GRANTED' && isMedicalCategoryAuthorized(grant, LAB_CATEGORY)) {
        accessStatus = 'GRANTED';
      } else if (grant.status === 'GRANTED') {
        accessStatus = 'CATEGORY_NOT_SHARED';
      }
    }

    return res.status(200).json({
      patient: {
        id: patient._id.toString(),
        name: patient.name,
        healthPassId: patient.healthPassId,
      },
      grant: grant ? grant.toSafeObject() : null,
      accessStatus,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Lookup failed.', details: err.message });
  }
});

// POST /api/lab/request-access
labRouter.post('/request-access', authenticate, requireVerifiedProvider('lab', 'admin'), async (req, res) => {
  try {
    const { healthPassId, durationHours = 24 } = req.body;
    if (!healthPassId) return res.status(400).json({ error: 'HealthPass ID is required.' });
    const patient = await User.findOne({
      role: 'patient',
      healthPassId: String(healthPassId).toUpperCase().trim(),
    });
    if (!patient) return res.status(404).json({ error: 'Patient not found.' });

    const latest = await ConsentGrant.findOne({
      patientId: patient._id,
      providerId: req.user._id,
    }).sort({ createdAt: -1 });
    if (latest?.status === 'GRANTED' && latest.expiresAt > new Date() && isMedicalCategoryAuthorized(latest, LAB_CATEGORY)) {
      return res.status(200).json({ grant: latest.toSafeObject() });
    }
    if (latest?.status === 'PENDING' && latest.expiresAt > new Date()) {
      return res.status(200).json({ grant: latest.toSafeObject() });
    }

    const hours = Math.max(1, Math.min(168, Number(durationHours) || 24));
    const grant = new ConsentGrant({
      patientId: patient._id,
      providerId: req.user._id,
      providerName: req.user.name,
      providerRole: 'lab',
      facilityName: req.user.facilityName || 'Diagnostic Lab',
      facilityLevel: 'DISTRICT',
      facilityType: 'Diagnostic Lab',
      purpose: 'Lab test result processing and upload',
      requestedCategories: [LAB_CATEGORY],
      grantedCategories: [],
      durationHours: hours,
      expiresAt: new Date(Date.now() + hours * 3600000),
      status: 'PENDING',
      otpCode: generateOtpCode(),
      otpGeneratedAt: new Date(),
    });

    await grant.save();

    await AuditLog.create({
      patientId: patient._id,
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: 'lab',
      action: 'ACCESS_REQUESTED',
      plainSummary: `${req.user.name} requested lab report access.`,
    });

    return res.status(201).json({ grant: grant.toSafeObject() });
  } catch (err) {
    return res.status(500).json({ error: 'Request failed.' });
  }
});

// POST /api/lab/reports
labRouter.post('/reports', authenticate, requireVerifiedProvider('lab', 'admin'), async (req, res) => {
  try {
    const { healthPassId, title, resultSummary, reportDate, recordPayload = {} } = req.body;
    if (!healthPassId) return res.status(400).json({ error: 'HealthPass ID is required.' });
    if (!title || !String(title).trim()) return res.status(400).json({ error: 'Report title is required.' });
    const patient = await User.findOne({
      role: 'patient',
      healthPassId: String(healthPassId).toUpperCase().trim(),
    });
    if (!patient) return res.status(404).json({ error: 'Patient not found.' });

    const grant = await ConsentGrant.findOne({
      patientId: patient._id,
      providerId: req.user._id,
      status: 'GRANTED',
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!grant) {
      return res.status(403).json({ code: 'NO_CONSENT', error: 'An active patient consent grant is required before uploading a lab report.' });
    }
    if (!isMedicalCategoryAuthorized(grant, LAB_CATEGORY)) {
      return res.status(403).json({ code: 'CATEGORY_NOT_SHARED', error: 'The patient has not shared laboratory reports with this lab.' });
    }

    const date = reportDate || new Date().toISOString().slice(0, 10);
    const duplicate = await findDuplicateHealthRecord(patient._id, {
      category: LAB_CATEGORY,
      title,
      reportDate: date,
    });

    if (duplicate) {
      return res.status(409).json({
        code: 'DUPLICATE_MEDICAL_RECORD',
        error: 'A matching active lab record already exists.',
        existingRecordId: duplicate._id.toString(),
      });
    }

    const report = new HealthRecord({
      patientId: patient._id,
      category: LAB_CATEGORY,
      medicalCategory: LAB_CATEGORY,
      title: title || 'Laboratory Report',
      resultSummary: resultSummary || '',
      reportDate: date,
      facilityName: req.user.facilityName || 'Diagnostic Lab',
      facilityLevel: 'DISTRICT',
      facilityType: 'Diagnostic Lab',
      source: 'LAB_UPLOAD',
      uploaderId: req.user._id,
      uploaderRole: 'lab',
      verificationStatus: 'LAB_UPLOADED',
      extractedFields: recordPayload.extractedFields || {},
      fileDataUrl: recordPayload.fileDataUrl || '',
    });

    await report.save();

    await AuditLog.create({
      patientId: patient._id,
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: 'lab',
      action: 'LAB_REPORT_UPLOADED',
      plainSummary: `${req.user.name} uploaded lab report: ${report.title}`,
    });

    return res.status(201).json({ success: true, report: report.toSafeObject() });
  } catch (err) {
    return res.status(400).json({ error: 'Failed to upload lab report.' });
  }
});
