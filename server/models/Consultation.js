import mongoose from 'mongoose';

const consultationSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    doctorName: {
      type: String,
      required: true,
      trim: true,
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
    encounterDate: {
      type: String,
      required: true,
      default: () => new Date().toISOString().slice(0, 10),
    },
    date: {
      type: String,
      default: () =>
        new Date().toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
    },
    diagnosis: {
      type: String,
      required: true,
      trim: true,
    },
    chiefComplaint: {
      type: String,
      default: '',
      trim: true,
    },
    clinicalNotes: {
      type: String,
      default: '',
      trim: true,
    },
    prescribedMedicines: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    orderedTests: {
      type: [String],
      default: [],
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      index: true,
    },
    confirmedByClinician: {
      type: Boolean,
      default: true,
    },
    source: {
      type: String,
      default: 'HealthPass clinical consultation record',
    },
  },
  {
    timestamps: true,
  }
);

consultationSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  obj.patientId = obj.patientId.toString();
  obj.doctorId = obj.doctorId.toString();
  return obj;
};

export const Consultation =
  mongoose.models.Consultation || mongoose.model('Consultation', consultationSchema);
