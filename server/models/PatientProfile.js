import mongoose from 'mongoose';

const patientProfileSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    knownAllergies: {
      type: String,
      default: '',
    },
    currentMedications: {
      type: String,
      default: '',
    },
    existingConditions: {
      type: String,
      default: '',
    },
    pastSurgeries: {
      type: String,
      default: '',
    },
    bloodGroup: {
      type: String,
      default: '',
    },
    age: {
      type: Number,
    },
    dateOfBirth: {
      type: String,
      default: '',
    },
    emergencyContactName: {
      type: String,
      default: '',
    },
    emergencyContactRelation: {
      type: String,
      default: '',
    },
    emergencyContactPhone: {
      type: String,
      default: '',
    },
    vitals: {
      bloodPressure: { type: String, default: '' },
      fastingSugar: { type: String, default: '' },
      weight: { type: String, default: '' },
      immunizationStatus: { type: String, default: '' },
    },
  },
  {
    timestamps: true,
  }
);

patientProfileSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  obj.patientId = obj.patientId.toString();
  // UI aliases kept for compatibility with patient-provided profile fields.
  obj.healthConditions = obj.existingConditions || '';
  obj.source = obj.source || 'Patient-provided';
  obj.verificationStatus = obj.verificationStatus || 'Unverified';
  return obj;
};

export const PatientProfile =
  mongoose.models.PatientProfile || mongoose.model('PatientProfile', patientProfileSchema);
