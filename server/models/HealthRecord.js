import mongoose from 'mongoose';

const healthRecordSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    medicalCategory: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    resultSummary: {
      type: String,
      default: '',
    },
    plainExplanation: {
      type: String,
      default: '',
    },
    statusColor: {
      type: String,
      enum: ['NORMAL', 'ATTENTION', 'CRITICAL', 'UNVERIFIED'],
      default: 'NORMAL',
    },
    reportDate: {
      type: String,
      default: () => new Date().toISOString().slice(0, 10),
    },
    facilityName: {
      type: String,
      default: '',
    },
    facilityLevel: {
      type: String,
      default: '',
    },
    facilityType: {
      type: String,
      default: '',
    },
    source: {
      type: String,
      default: 'MANUAL_UPLOAD',
    },
    uploaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    uploaderRole: {
      type: String,
      default: 'patient',
    },
    verificationStatus: {
      type: String,
      default: 'UNVERIFIED',
    },
    extractedFields: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    fileDataUrl: {
      type: String,
      default: '',
    },
    documentFingerprint: {
      type: String,
      default: '',
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      index: true,
    },
    prescriptionPeriod: {
      type: String,
    },
    prescriptionMetadataCorrections: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

healthRecordSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  obj.patientId = obj.patientId.toString();
  if (obj.uploaderId) obj.uploaderId = obj.uploaderId.toString();
  return obj;
};

export const HealthRecord =
  mongoose.models.HealthRecord || mongoose.model('HealthRecord', healthRecordSchema);
