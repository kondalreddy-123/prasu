import mongoose from 'mongoose';

const emergencyRecordSchema = new mongoose.Schema(
  {
    createdByDoctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdByDoctorName: {
      type: String,
      required: true,
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
    dataSource: {
      type: String,
      default: 'CLINICIAN_OBSERVED',
    },
    patientDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    emergencyObservations: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ text: '', tag: 'UNKNOWN_UNVERIFIED' }),
    },
    allergies: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ text: '', tag: 'UNKNOWN_UNVERIFIED' }),
    },
    medicines: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ text: '', tag: 'UNKNOWN_UNVERIFIED' }),
    },
    medicalHistory: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ text: '', tag: 'UNKNOWN_UNVERIFIED' }),
    },
    treatmentProvided: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ text: '', tag: 'UNKNOWN_UNVERIFIED' }),
    },
    documents: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    corrections: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    auditTrail: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    linkingWorkflow: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    linkedPatientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    status: {
      type: String,
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

emergencyRecordSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  obj.createdByDoctorId = obj.createdByDoctorId.toString();
  return obj;
};

export const EmergencyRecord =
  mongoose.models.EmergencyRecord || mongoose.model('EmergencyRecord', emergencyRecordSchema);
