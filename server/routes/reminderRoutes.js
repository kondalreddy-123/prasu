import express from 'express';
import { Reminder } from '../models/Reminder.js';
import { CaregiverRelationship } from '../models/CaregiverRelationship.js';
import { AuditLog } from '../models/AuditLog.js';
import { authenticate } from '../middleware/auth.js';

export const reminderRouter = express.Router();

// GET /api/reminders
// Returns reminders for patient (either patient themselves or authorized caregiver)
reminderRouter.get('/', authenticate, async (req, res) => {
  try {
    let patientId = req.query.patientId;

    if (req.user.role === 'patient') {
      patientId = req.user._id.toString();
    } else if (req.user.role === 'caregiver') {
      if (!patientId) {
        return res.status(400).json({ error: 'patientId is required for caregiver.' });
      }
      const link = await CaregiverRelationship.findOne({
        caregiverId: req.user._id,
        patientId,
        status: 'ACTIVE',
        canManageReminders: true,
      });
      if (!link) {
        return res.status(403).json({ error: 'Not authorised to access reminders for this patient.' });
      }
    } else if (req.user.role !== 'doctor') {
      return res.status(403).json({ error: 'Unauthorised to view reminders.' });
    }

    const reminders = await Reminder.find({ patientId }).sort({ dueDate: 1, scheduledTime: 1 });
    return res.status(200).json({ reminders: reminders.map((r) => r.toSafeObject()) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch reminders.' });
  }
});

// POST /api/reminders
// Create a new reminder (patient, doctor, or authorized caregiver)
reminderRouter.post('/', authenticate, async (req, res) => {
  try {
    let {
      patientId,
      type = 'MEDICINE',
      title,
      description = '',
      dosage = '',
      frequency = 'Daily',
      scheduledTime = '09:00 AM',
      dueDate,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required for a reminder.' });
    }

    if (req.user.role === 'patient') {
      patientId = req.user._id;
    } else if (req.user.role === 'caregiver') {
      if (!patientId) return res.status(400).json({ error: 'patientId is required.' });
      const link = await CaregiverRelationship.findOne({
        caregiverId: req.user._id,
        patientId,
        status: 'ACTIVE',
        canManageReminders: true,
      });
      if (!link) return res.status(403).json({ error: 'Not authorised to manage reminders for this patient.' });
    } else if (req.user.role !== 'doctor') {
      return res.status(403).json({ error: 'Only patients, doctors, or caregivers can schedule reminders.' });
    }

    const reminder = await Reminder.create({
      patientId,
      creatorId: req.user._id,
      creatorRole: req.user.role,
      type,
      title: title.trim(),
      description,
      dosage,
      frequency,
      scheduledTime,
      dueDate: dueDate || new Date().toISOString().split('T')[0],
      status: 'SCHEDULED',
    });

    await AuditLog.create({
      patientId,
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action: 'REMINDER_CREATED',
      plainSummary: `${req.user.role.toUpperCase()} ${req.user.name} created reminder: ${title}.`,
      details: { reminderId: reminder._id, type, dueDate, scheduledTime },
    });

    return res.status(201).json({
      success: true,
      message: 'Reminder scheduled successfully.',
      reminder: reminder.toSafeObject(),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create reminder.' });
  }
});

// PATCH /api/reminders/:id/adherence
// Update adherence status (TAKEN, SNOOZED, MISSED)
reminderRouter.patch('/:id/adherence', authenticate, async (req, res) => {
  try {
    const { status, notes = '' } = req.body;
    if (!['TAKEN', 'SNOOZED', 'MISSED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid adherence status.' });
    }

    const reminder = await Reminder.findById(req.params.id);
    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found.' });
    }

    // Permission check
    const isOwner = req.user.role === 'patient' && String(reminder.patientId) === String(req.user._id);
    let isAuthorizedCaregiver = false;
    if (req.user.role === 'caregiver') {
      const link = await CaregiverRelationship.findOne({
        caregiverId: req.user._id,
        patientId: reminder.patientId,
        status: 'ACTIVE',
        canManageReminders: true,
      });
      isAuthorizedCaregiver = Boolean(link);
    }

    if (!isOwner && !isAuthorizedCaregiver && req.user.role !== 'doctor') {
      return res.status(403).json({ error: 'Not authorised to record adherence for this reminder.' });
    }

    reminder.status = status;
    if (status === 'TAKEN') {
      reminder.lastCompletedAt = new Date();
    }
    reminder.adherenceHistory.push({
      action: status,
      timestamp: new Date(),
      actorRole: req.user.role,
      notes,
    });

    await reminder.save();

    await AuditLog.create({
      patientId: reminder.patientId,
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action: 'REMINDER_STATUS_UPDATED',
      plainSummary: `${req.user.name} marked reminder "${reminder.title}" as ${status}.`,
      details: { reminderId: reminder._id, status },
    });

    return res.status(200).json({
      success: true,
      message: `Reminder marked as ${status}.`,
      reminder: reminder.toSafeObject(),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update reminder status.' });
  }
});
