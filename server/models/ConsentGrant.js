import mongoose from 'mongoose';

const consentGrantSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    providerName: {
      type: String,
      required: true,
    },
    providerRole: {
      type: String,
      enum: ['doctor', 'pharmacy', 'lab'],
      default: 'doctor',
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
    purpose: {
      type: String,
      default: 'Outpatient consultation & medical record review',
    },
    grantedCategories: {
      type: [String],
      default: [],
    },
    requestedCategories: {
      type: [String],
      default: [],
    },
    durationHours: {
      type: Number,
      default: 24,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'GRANTED', 'REVOKED', 'EXPIRED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    otpCode: {
      type: String,
    },
    otpGeneratedAt: {
      type: Date,
    },
    otpAttempts: {
      type: Number,
      default: 0,
    },
    rejectionReason: {
      type: String,
    },
    decidedAt: {
      type: Date,
    },
    revokedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

consentGrantSchema.methods.toSafeObject = function ({ includeOtp = false } = {}) {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  obj.patientId = obj.patientId.toString();
  obj.providerId = obj.providerId.toString();
  // alias for doctor-based UI code
  obj.doctorId = obj.providerId;
  obj.doctorName = obj.providerName;
  obj.providerType = obj.providerRole === 'pharmacy' ? 'pharmacist' : obj.providerRole;
  obj.expiresAt = obj.expiresAt ? obj.expiresAt.toISOString() : null;
  // The in-person OTP is a patient-held secret, never a provider-facing field.
  if (!includeOtp || obj.status !== 'PENDING') delete obj.otpCode;
  return obj;
};

export const ConsentGrant =
  mongoose.models.ConsentGrant || mongoose.model('ConsentGrant', consentGrantSchema);
