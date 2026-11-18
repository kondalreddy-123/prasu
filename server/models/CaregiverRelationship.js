import mongoose from 'mongoose';

const caregiverRelationshipSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    caregiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    relationship: {
      type: String,
      default: 'Family Member', // Family Member, Guardian, Community Health Worker, Spouse, Child, Parent
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED'],
      default: 'ACTIVE',
      index: true,
    },
    grantedCategories: {
      type: [String],
      default: [
        'Medications & Prescriptions',
        'Laboratory Reports',
        'General Medical History',
        'Allergies & Reactions',
      ],
    },
    canManageReminders: {
      type: Boolean,
      default: true,
    },
    canUploadRecords: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      default: '',
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year default
    },
  },
  {
    timestamps: true,
  }
);

caregiverRelationshipSchema.index({ patientId: 1, caregiverId: 1 }, { unique: true });

caregiverRelationshipSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  obj.patientId = obj.patientId ? obj.patientId.toString() : '';
  obj.caregiverId = obj.caregiverId ? obj.caregiverId.toString() : '';
  return obj;
};

export const CaregiverRelationship =
  mongoose.models.CaregiverRelationship ||
  mongoose.model('CaregiverRelationship', caregiverRelationshipSchema);
