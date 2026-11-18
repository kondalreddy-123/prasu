import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    creatorRole: {
      type: String,
      default: 'patient', // 'patient', 'doctor', 'caregiver'
    },
    type: {
      type: String,
      enum: ['MEDICINE', 'APPOINTMENT', 'LAB_TEST', 'VACCINATION', 'FOLLOW_UP', 'PREVENTIVE_CARE'],
      default: 'MEDICINE',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    dosage: {
      type: String,
      default: '',
    },
    frequency: {
      type: String,
      default: 'Daily', // Daily, BID, TID, Weekly, Once
    },
    scheduledTime: {
      type: String, // e.g., "09:00 AM", "20:00"
      default: '09:00 AM',
    },
    dueDate: {
      type: String, // YYYY-MM-DD
      default: () => new Date().toISOString().split('T')[0],
      index: true,
    },
    status: {
      type: String,
      enum: ['SCHEDULED', 'TAKEN', 'MISSED', 'SNOOZED', 'CANCELLED'],
      default: 'SCHEDULED',
      index: true,
    },
    lastCompletedAt: {
      type: Date,
    },
    sourcePrescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HealthRecord',
    },
    adherenceHistory: [
      {
        action: { type: String, enum: ['TAKEN', 'MISSED', 'SNOOZED'] },
        timestamp: { type: Date, default: Date.now },
        actorRole: { type: String, default: 'patient' },
        notes: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

reminderSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  obj.patientId = obj.patientId ? obj.patientId.toString() : '';
  obj.creatorId = obj.creatorId ? obj.creatorId.toString() : '';
  return obj;
};

export const Reminder = mongoose.models.Reminder || mongoose.model('Reminder', reminderSchema);
