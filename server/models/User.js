import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
    },
    role: {
      type: String,
      enum: ['patient', 'doctor', 'caregiver', 'pharmacy', 'lab', 'admin'],
      default: 'patient',
      index: true,
    },
    healthPassId: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    dateOfBirth: {
      type: String,
    },
    gender: {
      type: String,
    },
    bloodGroup: {
      type: String,
    },
    facilityName: {
      type: String,
      trim: true,
    },
    facilityLevel: {
      type: String,
      enum: ['VILLAGE', 'MANDAL', 'DISTRICT', 'STATE', 'PHARMACY', 'LAB', ''],
      default: '',
    },
    facilityType: {
      type: String,
      trim: true,
    },
    licenseNumber: {
      type: String,
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: function () {
        // Patients are active immediately; doctors/providers require verification
        return this.role === 'patient';
      },
    },
    verifiedAt: {
      type: Date,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving if modified
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate auth token method
userSchema.methods.generateAuthToken = function () {
  const secret = process.env.JWT_SECRET || 'healthpass-super-secret-jwt-key-2026';
  return jwt.sign(
    {
      id: this._id.toString(),
      email: this.email,
      role: this.role,
      name: this.name,
      healthPassId: this.healthPassId,
      facilityName: this.facilityName,
      facilityLevel: this.facilityLevel,
    },
    secret,
    { expiresIn: '24h' }
  );
};

// Safe JSON serialization: remove password hash
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  obj.id = obj._id.toString();
  return obj;
};

export const User = mongoose.models.User || mongoose.model('User', userSchema);
