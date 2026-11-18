import express from 'express';
import { EmergencyRecord } from '../models/EmergencyRecord.js';
import { User } from '../models/User.js';
import { authenticate, requireRole, requireVerifiedDoctor } from '../middleware/auth.js';

export const emergencyRouter = express.Router();

const STATUSES = new Set([
  'IDENTITY_UNKNOWN',
  'VERIFICATION_PENDING',
  'AWAITING_CONSENT',
  'READY_FOR_LINKING',
  'LINKED',
  'LINKING_REJECTED',
  'CLOSED',
]);

const TAGS = new Set(['VERIFIED', 'PATIENT_REPORTED', 'DOCUMENT_EXTRACTED', 'UNKNOWN_UNVERIFIED']);

const IDENTITY_METHODS = new Set([
  'GOVERNMENT_ID_AND_BIOMETRIC',
  'GUARDIAN_ATTESTATION',
  'IN_PERSON_OTP_VERIFIED',
  'MULTI_FACTOR_CLINICAL_CHECK',
]);

const AUTHORIZATION_BASES = new Set([
  'PATIENT_APP_CONSENT',
  'AUTHORIZED_REPRESENTATIVE',
  'LAWFUL_EMERGENCY_PROCESS',
]);

const CONFLICT_MODES = new Set(['KEEP_SEPARATE_PROVENANCE', 'FLAG_FOR_CLINICAL_REVIEW']);

function isAdmin(user) {
  return user.role === 'admin';
}

function isCreator(record, user) {
  return record.createdByDoctorId?.toString() === user._id.toString();
}

function isTargetPatient(record, user) {
  return (
    user.role === 'patient' &&
    record.linkingWorkflow?.targetPatientId &&
    record.linkingWorkflow.targetPatientId.toString() === user._id.toString()
  );
}

function canReadRecord(record, user) {
  return isAdmin(user) || isCreator(record, user) || isTargetPatient(record, user);
}

function audit(record, user, action, details) {
  record.auditTrail.unshift({
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    action,
    actorId: user._id.toString(),
    actorName: user.name,
    actorRole: user.role,
    facilityName: user.facilityName || '',
    details,
  });
}

function normalizeField(value, fallback = { text: '', tag: 'UNKNOWN_UNVERIFIED' }) {
  if (!value || typeof value !== 'object') return fallback;
  return {
    ...fallback,
    ...value,
    text: typeof value.text === 'string' ? value.text : fallback.text,
    tag: TAGS.has(value.tag) ? value.tag : fallback.tag,
  };
}

// GET /api/emergency-records
// A provider may only list records they authored. Patients may only list records
// that name them as the verified linking target. Admin oversight sees all.
emergencyRouter.get('/', authenticate, async (req, res) => {
  try {
    let filter = {};
    if (isAdmin(req.user)) {
      filter = {};
    } else if (req.user.role === 'doctor') {
      filter = { createdByDoctorId: req.user._id };
    } else if (req.user.role === 'patient') {
      filter = { 'linkingWorkflow.targetPatientId': req.user._id };
    } else {
      return res.status(403).json({ error: 'This role cannot access emergency records.' });
    }

    const status = String(req.query.status || 'ALL').toUpperCase();
    if (status !== 'ALL' && STATUSES.has(status)) {
      filter.status = status;
    }

    let records = await EmergencyRecord.find(filter).sort({ createdAt: -1 }).limit(200);
    const query = String(req.query.query || '').trim().toLowerCase();
    if (query) {
      records = records.filter((record) => {
        const haystack = JSON.stringify(record.toSafeObject()).toLowerCase();
        return haystack.includes(query);
      });
    }

    return res.status(200).json({ records: records.map((r) => r.toSafeObject()) });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch emergency records.' });
  }
});

// GET /api/emergency-records/:id
emergencyRouter.get('/:id', authenticate, async (req, res) => {
  try {
    const record = await EmergencyRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Emergency record not found.' });
    if (!canReadRecord(record, req.user)) {
      return res.status(403).json({ error: 'You are not authorized to view this emergency record.' });
    }
    return res.status(200).json({ record: record.toSafeObject() });
  } catch {
    return res.status(404).json({ error: 'Emergency record not found.' });
  }
});

// POST /api/emergency-records
emergencyRouter.post('/', authenticate, requireRole('doctor'), requireVerifiedDoctor, async (req, res) => {
  try {
    const body = req.body || {};
    const patientDetails = body.patientDetails || {};
    if (!patientDetails.apparentName?.text && !body.emergencyObservations?.text) {
      return res.status(400).json({ error: 'Add an identifying description or an emergency observation.' });
    }

    const status = STATUSES.has(body.status) ? body.status : 'IDENTITY_UNKNOWN';

    const record = new EmergencyRecord({
      createdByDoctorId: req.user._id,
      createdByDoctorName: req.user.name,
      facilityName: req.user.facilityName || 'Emergency Centre',
      facilityLevel: req.user.facilityLevel || 'VILLAGE',
      facilityType: req.user.facilityType || 'Emergency Hospital',
      dataSource: body.dataSource || 'CLINICIAN_OBSERVED',
      status,
      patientDetails,
      emergencyObservations: normalizeField(body.emergencyObservations),
      allergies: normalizeField(body.allergies),
      medicines: normalizeField(body.medicines),
      medicalHistory: normalizeField(body.medicalHistory),
      treatmentProvided: normalizeField(body.treatmentProvided),
      documents: [],
      corrections: [],
      auditTrail: [],
      linkingWorkflow: null,
    });

    audit(record, req.user, 'RECORD_CREATED', 'Emergency clinical record created.');
    await record.save();

    return res.status(201).json({ record: record.toSafeObject() });
  } catch {
    return res.status(400).json({ error: 'Failed to create emergency record.' });
  }
});

// PUT /api/emergency-records/:id
emergencyRouter.put(
  '/:id',
  authenticate,
  requireRole('doctor'),
  requireVerifiedDoctor,
  async (req, res) => {
    try {
      const record = await EmergencyRecord.findById(req.params.id);
      if (!record) return res.status(404).json({ error: 'Emergency record not found.' });
      if (!isCreator(record, req.user)) {
        return res.status(403).json({ error: 'Only the authoring doctor can update this emergency record.' });
      }

      const body = req.body || {};
      if (body.status !== undefined) {
        if (!STATUSES.has(body.status)) {
          return res.status(400).json({ error: 'Unsupported emergency record status.' });
        }
        if (record.status === 'LINKED' && body.status !== 'CLOSED') {
          return res.status(409).json({
            error: 'A linked emergency record can only be closed or unlinked through the linking workflow.',
          });
        }
        record.status = body.status;
      }

      if (body.dataSource !== undefined) record.dataSource = String(body.dataSource);
      if (body.patientDetails !== undefined) record.patientDetails = body.patientDetails;
      if (body.emergencyObservations !== undefined) {
        record.emergencyObservations = normalizeField(body.emergencyObservations);
      }
      if (body.allergies !== undefined) record.allergies = normalizeField(body.allergies);
      if (body.medicines !== undefined) record.medicines = normalizeField(body.medicines);
      if (body.medicalHistory !== undefined) record.medicalHistory = normalizeField(body.medicalHistory);
      if (body.treatmentProvided !== undefined) {
        record.treatmentProvided = normalizeField(body.treatmentProvided);
      }

      audit(record, req.user, 'RECORD_UPDATED', 'Emergency clinical record updated.');
      await record.save();
      return res.status(200).json({ record: record.toSafeObject() });
    } catch {
      return res.status(400).json({ error: 'Failed to update emergency record.' });
    }
  }
);

// POST /api/emergency-records/:id/documents
emergencyRouter.post(
  '/:id/documents',
  authenticate,
  requireRole('doctor'),
  requireVerifiedDoctor,
  async (req, res) => {
    try {
      const record = await EmergencyRecord.findById(req.params.id);
      if (!record) return res.status(404).json({ error: 'Emergency record not found.' });
      if (!isCreator(record, req.user)) {
        return res.status(403).json({ error: 'Only the authoring doctor can attach documents to this record.' });
      }

      const title = String(req.body?.title || '').trim();
      if (!title) return res.status(400).json({ error: 'Document title is required.' });
      const tag = TAGS.has(req.body?.tag) ? req.body.tag : 'UNKNOWN_UNVERIFIED';
      const fileDataUrl = String(req.body?.fileDataUrl || '');
      if (fileDataUrl.length > 10_000_000) {
        return res.status(413).json({ error: 'Attached document is too large.' });
      }

      record.documents.unshift({
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: title.slice(0, 200),
        mimeType: String(req.body?.mimeType || 'application/octet-stream'),
        dataUrl: fileDataUrl,
        summaryText: String(req.body?.summaryText || '').trim().slice(0, 4000),
        tag,
        uploadedAt: new Date().toISOString(),
        uploadedByDoctorId: req.user._id.toString(),
        uploadedByDoctorName: req.user.name,
        facilityName: req.user.facilityName || record.facilityName || '',
      });

      audit(record, req.user, 'DOCUMENT_ATTACHED', `Emergency document attached: ${title}`);
      await record.save();
      return res.status(201).json({ record: record.toSafeObject() });
    } catch {
      return res.status(400).json({ error: 'Failed to attach document.' });
    }
  }
);

// POST /api/emergency-records/:id/corrections
emergencyRouter.post(
  '/:id/corrections',
  authenticate,
  requireRole('doctor'),
  requireVerifiedDoctor,
  async (req, res) => {
    try {
      const record = await EmergencyRecord.findById(req.params.id);
      if (!record) return res.status(404).json({ error: 'Emergency record not found.' });
      if (!isCreator(record, req.user)) {
        return res.status(403).json({ error: 'Only the authoring doctor can correct this record.' });
      }

      const note = String(req.body?.note || '').trim();
      if (note.length < 3) return res.status(400).json({ error: 'A correction note is required.' });

      record.corrections.unshift({
        id: `cor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        note: note.slice(0, 4000),
        createdAt: new Date().toISOString(),
        doctorId: req.user._id.toString(),
        doctorName: req.user.name,
      });

      audit(record, req.user, 'CORRECTION_ADDED', `Correction appended: ${note.slice(0, 160)}`);
      await record.save();
      return res.status(201).json({ record: record.toSafeObject() });
    } catch {
      return res.status(400).json({ error: 'Failed to append correction.' });
    }
  }
);

// POST /api/emergency-records/:id/link-initiate
emergencyRouter.post(
  '/:id/link-initiate',
  authenticate,
  requireRole('doctor'),
  requireVerifiedDoctor,
  async (req, res) => {
    try {
      const record = await EmergencyRecord.findById(req.params.id);
      if (!record) return res.status(404).json({ error: 'Emergency record not found.' });
      if (!isCreator(record, req.user)) {
        return res.status(403).json({ error: 'Only the authoring doctor can initiate linking.' });
      }
      if (record.status === 'LINKED') {
        return res.status(409).json({ error: 'This emergency record is already linked.' });
      }

      const body = req.body || {};
      const targetHealthPassId = String(body.targetHealthPassId || '').trim().toUpperCase();
      if (!/^HP-[A-Z0-9-]{3,37}$/.test(targetHealthPassId)) {
        return res.status(400).json({ error: 'A valid target HealthPass ID is required.' });
      }
      if (body.identityVerified !== true) {
        return res.status(400).json({
          code: 'IDENTITY_NOT_VERIFIED',
          error: 'Identity verification must be confirmed before linking a patient record.',
        });
      }
      const method = body.identityVerificationMethod;
      if (!IDENTITY_METHODS.has(method)) {
        return res.status(400).json({ error: 'A valid identity verification method is required.' });
      }
      const basis = body.authorizationBasis;
      if (!AUTHORIZATION_BASES.has(basis)) {
        return res.status(400).json({ error: 'A valid authorization basis is required.' });
      }
      if (basis === 'AUTHORIZED_REPRESENTATIVE') {
        if (!String(body.authorizedRepresentativeName || '').trim()
          || !String(body.authorizedRepresentativeRelation || '').trim()) {
          return res.status(400).json({
            error: 'Representative name and relation are required for representative authorization.',
          });
        }
      }
      if (basis === 'LAWFUL_EMERGENCY_PROCESS'
        && String(body.consentOrAuthReference || '').trim().length < 3) {
        return res.status(400).json({
          error: 'A lawful emergency process reference is required.',
        });
      }

      const targetPatient = await User.findOne({ role: 'patient', healthPassId: targetHealthPassId });
      if (!targetPatient) {
        return res.status(404).json({ error: 'No patient matches that HealthPass ID.' });
      }

      const now = new Date().toISOString();
      record.linkingWorkflow = {
        targetPatientId: targetPatient._id.toString(),
        targetHealthPassId: targetPatient.healthPassId,
        targetPatientName: targetPatient.name,
        initiatedByDoctorId: req.user._id.toString(),
        initiatedByDoctorName: req.user.name,
        initiatedFacilityName: req.user.facilityName || '',
        initiatedAt: now,
        identityVerified: true,
        identityVerificationMethod: method,
        identityVerificationNotes: String(body.identityVerificationNotes || '').trim(),
        authorizationBasis: basis,
        authorizedRepresentativeName: String(body.authorizedRepresentativeName || '').trim(),
        authorizedRepresentativeRelation: String(body.authorizedRepresentativeRelation || '').trim(),
        consentOrAuthReference: String(body.consentOrAuthReference || '').trim(),
        detectedConflicts: Array.isArray(body.detectedConflicts) ? body.detectedConflicts : [],
        conflictResolutionMode: CONFLICT_MODES.has(body.conflictResolutionMode)
          ? body.conflictResolutionMode
          : 'KEEP_SEPARATE_PROVENANCE',
        decisionStatus: 'PENDING_PATIENT_APPROVAL',
      };
      record.status = basis === 'PATIENT_APP_CONSENT' ? 'AWAITING_CONSENT' : 'READY_FOR_LINKING';

      audit(
        record,
        req.user,
        'LINK_REQUESTED',
        basis === 'PATIENT_APP_CONSENT'
          ? `Patient consent requested for ${targetPatient.healthPassId}.`
          : `Linking prepared under ${basis} for ${targetPatient.healthPassId}.`
      );

      await record.save();
      return res.status(200).json({ record: record.toSafeObject() });
    } catch {
      return res.status(400).json({ error: 'Link initiation failed.' });
    }
  }
);

// POST /api/emergency-records/:id/link-complete
// Patient-app consent can only be completed by the named patient. Representative
// or lawful-process links can be finalized by the authoring doctor.
emergencyRouter.post('/:id/link-complete', authenticate, async (req, res) => {
  try {
    const record = await EmergencyRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Emergency record not found.' });
    if (!canReadRecord(record, req.user)) {
      return res.status(403).json({ error: 'You are not authorized to finalize this link.' });
    }

    const workflow = record.linkingWorkflow;
    if (!workflow || workflow.decisionStatus !== 'PENDING_PATIENT_APPROVAL') {
      return res.status(409).json({ error: 'This emergency record has no pending linking request.' });
    }
    if (workflow.identityVerified !== true) {
      return res.status(409).json({ error: 'Identity verification is incomplete for this linking request.' });
    }

    const actorRole = String(req.body?.actorRole || req.user.role).toLowerCase();
    if (workflow.authorizationBasis === 'PATIENT_APP_CONSENT') {
      if (req.user.role !== 'patient' || !isTargetPatient(record, req.user)) {
        return res.status(403).json({
          code: 'PATIENT_APPROVAL_REQUIRED',
          error: 'The named patient must approve this linking request in their HealthPass dashboard.',
        });
      }
    } else if (req.user.role === 'doctor') {
      if (!isCreator(record, req.user)) {
        return res.status(403).json({ error: 'Only the authoring doctor can finalize this link.' });
      }
      if (!req.user.isVerified) {
        return res.status(403).json({ code: 'DOCTOR_UNVERIFIED', error: 'Doctor account is pending verification.' });
      }
    } else if (req.user.role !== 'admin' && !isTargetPatient(record, req.user)) {
      return res.status(403).json({ error: 'You are not authorized to finalize this link.' });
    }

    const now = new Date();
    record.status = 'LINKED';
    workflow.decisionStatus = 'APPROVED_AND_LINKED';
    workflow.decidedAt = now.toISOString();
    workflow.decidedBy = `${req.user.role}:${req.user._id.toString()}`;
    workflow.approvalNotes = String(req.body?.approvalNotes || '').trim();
    record.linkedPatientId = record.linkingWorkflow.targetPatientId;

    audit(
      record,
      req.user,
      'LINK_COMPLETED',
      `Emergency record linked to patient ${workflow.targetHealthPassId} (${actorRole}).`
    );

    await record.save();
    return res.status(200).json({ record: record.toSafeObject() });
  } catch {
    return res.status(400).json({ error: 'Could not finalize linking.' });
  }
});

// POST /api/emergency-records/:id/link-reject
emergencyRouter.post('/:id/link-reject', authenticate, async (req, res) => {
  try {
    const record = await EmergencyRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Emergency record not found.' });
    if (!canReadRecord(record, req.user)) {
      return res.status(403).json({ error: 'You are not authorized to reject this link.' });
    }

    const workflow = record.linkingWorkflow;
    if (!workflow || workflow.decisionStatus !== 'PENDING_PATIENT_APPROVAL') {
      return res.status(409).json({ error: 'This emergency record has no pending linking request.' });
    }

    const reason = String(req.body?.reason || '').trim() || 'Linking rejected.';
    workflow.decisionStatus = 'REJECTED';
    workflow.decidedAt = new Date().toISOString();
    workflow.decidedBy = `${req.user.role}:${req.user._id.toString()}`;
    workflow.rejectionOrUnlinkReason = reason.slice(0, 1000);
    record.status = 'LINKING_REJECTED';
    record.linkedPatientId = undefined;

    audit(record, req.user, 'LINK_REJECTED', `Linking rejected: ${reason.slice(0, 200)}`);
    await record.save();
    return res.status(200).json({ record: record.toSafeObject() });
  } catch {
    return res.status(400).json({ error: 'Could not reject linking.' });
  }
});

// POST /api/emergency-records/:id/unlink
emergencyRouter.post('/:id/unlink', authenticate, async (req, res) => {
  try {
    const record = await EmergencyRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Emergency record not found.' });
    if (!isAdmin(req.user) && !isCreator(record, req.user)) {
      return res.status(403).json({ error: 'Only the authoring doctor can unlink this record.' });
    }
    if (record.status !== 'LINKED' && record.linkingWorkflow?.decisionStatus !== 'APPROVED_AND_LINKED') {
      return res.status(409).json({ error: 'This emergency record is not currently linked.' });
    }

    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 5) {
      return res.status(400).json({ error: 'A reason of at least 5 characters is required to unlink.' });
    }

    record.status = 'CLOSED';
    record.linkingWorkflow.decisionStatus = 'UNLINKED';
    record.linkingWorkflow.decidedAt = new Date().toISOString();
    record.linkingWorkflow.decidedBy = `${req.user.role}:${req.user._id.toString()}`;
    record.linkingWorkflow.rejectionOrUnlinkReason = reason.slice(0, 1000);
    record.linkedPatientId = undefined;

    audit(record, req.user, 'RECORD_UNLINKED', `Emergency record unlinked: ${reason.slice(0, 200)}`);
    await record.save();
    return res.status(200).json({ record: record.toSafeObject() });
  } catch {
    return res.status(400).json({ error: 'Could not unlink emergency record.' });
  }
});
