import express from 'express';
import { User } from '../models/User.js';
import { HealthRecord } from '../models/HealthRecord.js';
import { Consultation } from '../models/Consultation.js';
import { AuditLog, computeAuditEntryHash } from '../models/AuditLog.js';
import { authenticate, requireRole } from '../middleware/auth.js';

export const adminRouter = express.Router();

// GET /api/admin/overview
adminRouter.get('/overview', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const [patientCount, doctorCount, unverifiedCount, reportCount, consultationCount, unverifiedDoctors, providers] =
      await Promise.all([
        User.countDocuments({ role: 'patient' }),
        User.countDocuments({ role: 'doctor' }),
        User.countDocuments({ role: 'doctor', isVerified: false }),
        HealthRecord.countDocuments({ isActive: true }),
        Consultation.countDocuments(),
        User.find({ role: 'doctor', isVerified: false }).select('-password'),
        User.find({ role: { $in: ['doctor', 'pharmacy', 'lab'] } })
          .select('-password')
          .sort({ createdAt: -1 })
          .limit(200),
      ]);

    return res.status(200).json({
      stats: {
        totalPatients: patientCount,
        totalDoctors: doctorCount,
        pendingApprovals: unverifiedCount,
        totalHealthRecords: reportCount,
        totalConsultations: consultationCount,
      },
      unverifiedDoctors: unverifiedDoctors.map((d) => {
        const safe = d.toSafeObject();
        safe.verified = d.isVerified;
        return safe;
      }),
      providers: providers.map((provider) => {
        const safe = provider.toSafeObject();
        safe.verified = provider.isVerified;
        return safe;
      }),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch admin overview.' });
  }
});

// GET /api/admin/audit-logs/verify-chain
// Verifies SHA-256 hash-chain integrity across stored audit log entries
adminRouter.get('/audit-logs/verify-chain', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const patientId = req.query.patientId;
    const filter = patientId ? { patientId } : {};
    const logs = await AuditLog.find(filter).sort({ timestamp: 1, _id: 1 });

    let isValid = true;
    let checkedCount = 0;
    let brokenIndex = -1;
    let expectedHash = null;

    for (let i = 0; i < logs.length; i++) {
      const entry = logs[i];
      checkedCount++;
      const computed = computeAuditEntryHash({
        previousHash: entry.previousHash,
        timestamp: entry.timestamp,
        patientId: entry.patientId,
        actorId: entry.actorId,
        action: entry.action,
        plainSummary: entry.plainSummary,
        details: entry.details,
      });

      if (entry.hash && entry.hash !== computed) {
        isValid = false;
        brokenIndex = i;
        expectedHash = computed;
        break;
      }

      if (i > 0 && entry.previousHash) {
        const prevEntry = logs[i - 1];
        if (prevEntry.hash && entry.previousHash !== prevEntry.hash) {
          isValid = false;
          brokenIndex = i;
          break;
        }
      }
    }

    return res.status(200).json({
      verified: isValid,
      totalEntriesChecked: checkedCount,
      brokenAtSequence: brokenIndex >= 0 ? brokenIndex + 1 : null,
      message: isValid
        ? `Audit log SHA-256 hash chain verified successfully (${checkedCount} entries verified).`
        : `Hash chain verification failed at entry ${brokenIndex + 1}.`,
      verifiedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify audit log integrity.' });
  }
});

async function verifyProviderHandler(req, res) {
  try {
    const { id } = req.params;
    const provider = await User.findById(id);
    if (!provider) return res.status(404).json({ error: 'Provider account not found.' });

    provider.isVerified = true;
    provider.verifiedAt = new Date();
    provider.verifiedBy = req.user._id;
    await provider.save();

    await AuditLog.create({
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: 'admin',
      action: 'DOCTOR_VERIFIED',
      plainSummary: `Administrator verified provider account: ${provider.name} (${provider.email})`,
      details: { providerId: provider._id },
    });

    return res.status(200).json({
      success: true,
      message: `Provider ${provider.name} has been verified successfully.`,
      provider: { ...provider.toSafeObject(), verified: provider.isVerified },
    });
  } catch {
    return res.status(400).json({ error: 'Failed to verify provider.' });
  }
}

adminRouter.post('/providers/:id/verify', authenticate, requireRole('admin'), verifyProviderHandler);
// Frontend-compatible alias.
adminRouter.post('/providers/:id/verification', authenticate, requireRole('admin'), verifyProviderHandler);

// POST /api/admin/verify-doctor
adminRouter.post('/verify-doctor', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const doctorId = req.body.doctorId || req.body.id;
    const provider = await User.findById(doctorId);
    if (!provider) return res.status(404).json({ error: 'Doctor account not found.' });

    provider.isVerified = true;
    provider.verifiedAt = new Date();
    provider.verifiedBy = req.user._id;
    await provider.save();

    await AuditLog.create({
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: 'admin',
      action: 'DOCTOR_VERIFIED',
      plainSummary: `Administrator verified doctor: ${provider.name} (${provider.email})`,
      details: { doctorId: provider._id },
    });

    return res.status(200).json({
      success: true,
      message: `Doctor ${provider.name} has been verified successfully.`,
      provider: provider.toSafeObject(),
    });
  } catch (err) {
    return res.status(400).json({ error: 'Failed to verify doctor.' });
  }
});

adminRouter.post('/providers', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, role, facilityName, facilityLevel, facilityType, licenseNumber } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const provider = new User({
      name: name.trim(),
      email: cleanEmail,
      password,
      role,
      facilityName,
      facilityLevel: facilityLevel || 'VILLAGE',
      facilityType,
      licenseNumber,
      isVerified: true,
      verifiedAt: new Date(),
      verifiedBy: req.user._id,
    });

    await provider.save();

    return res.status(201).json({ success: true, provider: provider.toSafeObject() });
  } catch (err) {
    return res.status(400).json({ error: 'Failed to create provider.', details: err.message });
  }
});
