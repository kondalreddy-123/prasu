import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    genericName: {
      type: String,
      default: '',
    },
    strength: {
      type: String,
      default: '',
    },
    dosage: {
      type: String,
      default: '1 tablet',
    },
    route: {
      type: String,
      default: 'Oral',
    },
    startDate: {
      type: String,
      default: () => new Date().toISOString().slice(0, 10),
    },
    endDate: {
      type: String,
    },
    frequency: {
      morning: { type: Number, default: 0 },
      noon: { type: Number, default: 0 },
      night: { type: Number, default: 0 },
    },
    durationDays: {
      type: Number,
      default: 0,
    },
    daysRemaining: {
      type: Number,
      default: 0,
    },
    computedStatus: {
      type: String,
      enum: ['ACTIVE', 'COMPLETED', 'DISCONTINUED', 'CANCELLED', 'EXPIRED', 'SELF_REPORTED'],
      default: 'ACTIVE',
      index: true,
    },
    foodInstruction: {
      type: String,
      default: 'After food',
    },
    notes: {
      type: String,
      default: '',
    },
    prescriberName: {
      type: String,
      default: 'Self-reported',
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
    consultationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Consultation',
    },
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HealthRecord',
    },
    source: {
      type: String,
      default: 'SELF_REPORTED',
    },
    lastTakenAt: {
      type: Date,
    },
    refillRequestedAt: {
      type: Date,
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

medicineSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  obj.patientId = obj.patientId.toString();
  if (obj.consultationId) obj.consultationId = obj.consultationId.toString();
  if (obj.prescriptionId) obj.prescriptionId = obj.prescriptionId.toString();
  return obj;
};

export const Medicine = mongoose.models.Medicine || mongoose.model('Medicine', medicineSchema);
