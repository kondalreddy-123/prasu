import mongoose from 'mongoose';
import crypto from 'node:crypto';

const auditLogSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    actorName: {
      type: String,
      default: 'System',
    },
    actorRole: {
      type: String,
      default: 'system',
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    plainSummary: {
      type: String,
      default: '',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    previousHash: {
      type: String,
      default: '0000000000000000000000000000000000000000000000000000000000000000',
      index: true,
    },
    hash: {
      type: String,
      index: true,
    },
    sequenceNumber: {
      type: Number,
      default: 1,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export function computeAuditEntryHash({ previousHash, timestamp, patientId, actorId, action, plainSummary, details }) {
  const content = JSON.stringify({
    previousHash: previousHash || '0000000000000000000000000000000000000000000000000000000000000000',
    timestamp: timestamp instanceof Date ? timestamp.toISOString() : String(timestamp),
    patientId: patientId ? String(patientId) : null,
    actorId: actorId ? String(actorId) : null,
    action: String(action || ''),
    plainSummary: String(plainSummary || ''),
    details: details || {},
  });
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

// Automatically link and hash entries before saving if not already hashed
auditLogSchema.pre('save', async function () {
  if (!this.hash) {
    if (!this.previousHash || this.previousHash === '0000000000000000000000000000000000000000000000000000000000000000') {
      const lastEntry = await this.constructor.findOne().sort({ timestamp: -1, _id: -1 }).select('hash sequenceNumber').lean();
      if (lastEntry && lastEntry.hash) {
        this.previousHash = lastEntry.hash;
        this.sequenceNumber = (lastEntry.sequenceNumber || 1) + 1;
      }
    }
    this.hash = computeAuditEntryHash({
      previousHash: this.previousHash,
      timestamp: this.timestamp || new Date(),
      patientId: this.patientId,
      actorId: this.actorId,
      action: this.action,
      plainSummary: this.plainSummary,
      details: this.details,
    });
  }
});

auditLogSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  if (obj.patientId) obj.patientId = obj.patientId.toString();
  if (obj.actorId) obj.actorId = obj.actorId.toString();
  obj.timestamp = obj.timestamp ? obj.timestamp.toISOString() : new Date().toISOString();
  obj.hash = this.hash || computeAuditEntryHash({
    previousHash: this.previousHash,
    timestamp: this.timestamp,
    patientId: this.patientId,
    actorId: this.actorId,
    action: this.action,
    plainSummary: this.plainSummary,
    details: this.details,
  });
  obj.previousHash = this.previousHash || '0000000000000000000000000000000000000000000000000000000000000000';
  obj.sequenceNumber = this.sequenceNumber || 1;
  return obj;
};

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
