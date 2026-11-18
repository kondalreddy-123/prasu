import express from 'express';
import crypto from 'node:crypto';
import { User } from '../models/User.js';
import { Medicine } from '../models/Medicine.js';
import { ConsentGrant } from '../models/ConsentGrant.js';
import { AuditLog } from '../models/AuditLog.js';
import { authenticate, requireVerifiedProvider } from '../middleware/auth.js';
import { isMedicalCategoryAuthorized, PHARMACY_CATEGORY } from '../utils/categories.js';

export const pharmacyRouter = express.Router();

function generateOtpCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

// POST /api/pharmacy/request-access
pharmacyRouter.post('/request-access', authenticate, requireVerifiedProvider('pharmacy', 'admin'), async (req, res) => {
  try {
    const { healthPassId, durationHours = 24 } = req.body;
    if (!healthPassId) return res.status(400).json({ error: 'HealthPass ID is required.' });

    const patient = await User.findOne({
      role: 'patient',
      healthPassId: healthPassId.toUpperCase().trim(),
    });
    if (!patient) return res.status(404).json({ error: 'No patient matches that HealthPass ID.' });

    const latest = await ConsentGrant.findOne({
      patientId: patient._id,
      providerId: req.user._id,
    }).sort({ createdAt: -1 });

    if (latest?.status === 'GRANTED' && latest.expiresAt > new Date()) {
      return res.status(200).json({ grant: latest.toSafeObject(), canRead: isMedicalCategoryAuthorized(latest, PHARMACY_CATEGORY) });
    }
    if (latest?.status === 'PENDING' && latest.expiresAt > new Date()) {
      return res.status(200).json({ grant: latest.toSafeObject() });
    }

    const hours = Math.max(1, Math.min(168, Number(durationHours) || 24));
    const grant = new ConsentGrant({
      patientId: patient._id,
      providerId: req.user._id,
      providerName: req.user.name,
      providerRole: 'pharmacy',
      facilityName: req.user.facilityName || 'Pharmacy',
      facilityLevel: 'PHARMACY',
      facilityType: 'Pharmacy',
      purpose: 'Prescription review for dispensing',
      requestedCategories: [PHARMACY_CATEGORY],
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
      actorRole: 'pharmacy',
      action: 'ACCESS_REQUESTED',
      plainSummary: `${req.user.name} requested prescription-only access.`,
    });

    return res.status(201).json({ grant: grant.toSafeObject() });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to request prescription access.', details: err.message });
  }
});

// GET /api/pharmacy/patient/:query
pharmacyRouter.get('/patient/:query', authenticate, requireVerifiedProvider('pharmacy', 'admin'), async (req, res) => {
  try {
    const query = decodeURIComponent(req.params.query || '').trim();
    const patient = await User.findOne({
      role: 'patient',
      $or: [
        { healthPassId: query.toUpperCase() },
        { _id: query.match(/^[0-9a-fA-F]{24}$/) ? query : undefined },
      ].filter(Boolean),
    });

    if (!patient) return res.status(404).json({ error: 'No patient matches that HealthPass ID.' });

    const grant = await ConsentGrant.findOne({
      patientId: patient._id,
      providerId: req.user._id,
    }).sort({ createdAt: -1 });

    const now = new Date();
    let accessStatus = 'NONE';
    let canRead = false;

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
      } else if (grant.status === 'GRANTED') {
        accessStatus = 'ACTIVE';
        canRead = isMedicalCategoryAuthorized(grant, PHARMACY_CATEGORY);
      }
    }

    let prescriptions = [];
    if (canRead) {
      const medicines = await Medicine.find({ patientId: patient._id, isActive: true }).sort({ createdAt: -1 });
      prescriptions = medicines.map((m) => m.toSafeObject());

      await AuditLog.create({
        patientId: patient._id,
        actorId: req.user._id,
        actorName: req.user.name,
        actorRole: 'pharmacy',
        action: 'PRESCRIPTIONS_VIEWED',
        plainSummary: `${req.user.name} reviewed prescriptions under active consent.`,
      });
    }

    return res.status(200).json({
      patient: {
        id: patient._id.toString(),
        name: patient.name,
        healthPassId: patient.healthPassId,
      },
      grant: grant ? grant.toSafeObject() : null,
      accessStatus,
      canRead,
      prescriptions,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch pharmacy view.', details: err.message });
  }
});
