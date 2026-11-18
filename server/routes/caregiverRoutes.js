import express from 'express';
import { User } from '../models/User.js';
import { CaregiverRelationship } from '../models/CaregiverRelationship.js';
import { getMedicalRecordCategory } from '../utils/categories.js';
import { HealthRecord } from '../models/HealthRecord.js';
import { Medicine } from '../models/Medicine.js';
import { Reminder } from '../models/Reminder.js';
import { AuditLog } from '../models/AuditLog.js';
import { authenticate, requireRole } from '../middleware/auth.js';

export const caregiverRouter = express.Router();

// GET /api/caregiver/patients
// Returns patients linked to this caregiver with active consent
caregiverRouter.get('/patients', authenticate, requireRole('caregiver'), async (req, res) => {
  try {
    const relationships = await CaregiverRelationship.find({
      caregiverId: req.user._id,
      status: 'ACTIVE',
      expiresAt: { $gt: new Date() },
    }).populate('patientId', 'name healthPassId email phone dateOfBirth gender bloodGroup');

    const result = relationships
      .filter((rel) => rel.patientId)
      .map((rel) => ({
        relationshipId: rel._id.toString(),
        relationship: rel.relationship,
        grantedCategories: rel.grantedCategories,
        canManageReminders: rel.canManageReminders,
        canUploadRecords: rel.canUploadRecords,
        patient: {
          id: rel.patientId._id.toString(),
          name: rel.patientId.name,
          healthPassId: rel.patientId.healthPassId,
          email: rel.patientId.email,
          phone: rel.patientId.phone,
          dateOfBirth: rel.patientId.dateOfBirth,
          gender: rel.patientId.gender,
          bloodGroup: rel.patientId.bloodGroup,
        },
      }));

    return res.status(200).json({ patients: result });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch linked patients.' });
  }
});

// POST /api/caregiver/link-patient
// Link patient by HealthPass ID (creates active or pending link with audit logging)
caregiverRouter.post('/link-patient', authenticate, requireRole('caregiver'), async (req, res) => {
  try {
    const { healthPassId, relationship = 'Family Member', notes = '' } = req.body;
    if (!healthPassId) {
      return res.status(400).json({ error: 'Patient HealthPass ID is required.' });
    }

    const patient = await User.findOne({
      healthPassId: String(healthPassId).trim().toUpperCase(),
      role: 'patient',
    });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found with the provided HealthPass ID.' });
    }

    let link = await CaregiverRelationship.findOne({
      caregiverId: req.user._id,
      patientId: patient._id,
    });

    if (link) {
      link.status = 'ACTIVE';
      link.relationship = relationship;
      link.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      await link.save();
    } else {
      link = await CaregiverRelationship.create({
        patientId: patient._id,
        caregiverId: req.user._id,
        relationship,
        notes,
        status: 'ACTIVE',
      });
    }

    await AuditLog.create({
      patientId: patient._id,
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: 'caregiver',
      action: 'CAREGIVER_LINKED',
      plainSummary: `Caregiver ${req.user.name} linked to patient ${patient.name} (${relationship}).`,
      details: { relationship, caregiverEmail: req.user.email },
    });

    return res.status(200).json({
      success: true,
      message: `Successfully linked to patient ${patient.name}.`,
      relationship: link.toSafeObject(),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to link caregiver to patient.' });
  }
});

// GET /api/caregiver/patient/:patientId/records
// Retrieve category-scoped records authorised for this caregiver
caregiverRouter.get('/patient/:patientId/records', authenticate, requireRole('caregiver'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const link = await CaregiverRelationship.findOne({
      caregiverId: req.user._id,
      patientId,
      status: 'ACTIVE',
      expiresAt: { $gt: new Date() },
    });

    if (!link) {
      return res.status(403).json({ error: 'No active caregiver authorisation for this patient.' });
    }

    const granted = link.grantedCategories || [];
    const filter = { patientId, isActive: true };

    const records = await HealthRecord.find(filter).sort({ reportDate: -1, createdAt: -1 });
    const medicines = granted.includes('Medications & Prescriptions')
      ? await Medicine.find({ patientId, isActive: true })
      : [];

    await AuditLog.create({
      patientId,
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: 'caregiver',
      action: 'CAREGIVER_VIEWED_RECORDS',
      plainSummary: `Caregiver ${req.user.name} reviewed authorized records for assisted care.`,
      details: { grantedCategories: granted },
    });

    return res.status(200).json({
      records: records.map((r) => r.toSafeObject()),
      medicines: medicines.map((m) => m.toSafeObject()),
      grantedCategories: granted,
      canManageReminders: link.canManageReminders,
      canUploadRecords: link.canUploadRecords,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve patient records.' });
  }
});

// POST /api/caregiver/patient/:patientId/upload
// Assisted document upload by authorized caregiver
caregiverRouter.post('/patient/:patientId/upload', authenticate, requireRole('caregiver'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const link = await CaregiverRelationship.findOne({
      caregiverId: req.user._id,
      patientId,
      status: 'ACTIVE',
      expiresAt: { $gt: new Date() },
    });

    if (!link || !link.canUploadRecords) {
      return res.status(403).json({ error: 'Caregiver is not authorised to upload records for this patient.' });
    }

    const { title, category, reportDate, fileData, facilityName, resultSummary } = req.body;
    if (!title || !category) {
      return res.status(400).json({ error: 'Title and category are required.' });
    }

    const medicalCategory = getMedicalRecordCategory({ title, category });
    const record = await HealthRecord.create({
      patientId,
      uploaderId: req.user._id,
      uploaderRole: 'caregiver',
      title,
      category,
      medicalCategory,
      reportDate: reportDate || new Date().toISOString().split('T')[0],
      fileDataUrl: fileData || '',
      facilityName: facilityName || 'Caregiver Assisted Upload',
      resultSummary: resultSummary || '',
      source: 'CAREGIVER_ASSISTED_UPLOAD',
    });

    await AuditLog.create({
      patientId,
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: 'caregiver',
      action: 'CAREGIVER_UPLOADED_RECORD',
      plainSummary: `Caregiver ${req.user.name} uploaded ${title} (${category}) for patient.`,
      details: { recordId: record._id, title, category },
    });

    return res.status(201).json({
      success: true,
      message: 'Document uploaded successfully by caregiver.',
      record: record.toSafeObject(),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to upload assisted document.' });
  }
});
