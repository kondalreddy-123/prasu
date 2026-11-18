import mongoose from 'mongoose';

const allergySchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    allergen: {
      type: String,
      required: true,
      trim: true,
    },
    severity: {
      type: String,
      enum: ['MILD', 'MODERATE', 'SEVERE / BLOCKING'],
      default: 'MODERATE',
    },
    reaction: {
      type: String,
      default: '',
    },
    drugClassMatches: {
      type: [String],
      default: [],
    },
    verificationStatus: {
      type: String,
      default: 'Patient reported; unverified',
    },
    source: {
      type: String,
      default: 'PATIENT_REPORTED',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

allergySchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  obj.patientId = obj.patientId.toString();
  return obj;
};

export const Allergy = mongoose.models.Allergy || mongoose.model('Allergy', allergySchema);
