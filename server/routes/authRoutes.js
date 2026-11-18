import express from 'express';
import { User } from '../models/User.js';
import { PatientProfile } from '../models/PatientProfile.js';
import { AuditLog } from '../models/AuditLog.js';
import { authenticate, signToken, setAuthCookie, clearAuthCookie } from '../middleware/auth.js';

export const authRouter = express.Router();

function generateHealthPassId() {
  const segment1 = Math.floor(1000 + Math.random() * 9000);
  const segment2 = Math.floor(1000 + Math.random() * 9000);
  return `HP-${segment1}-${segment2}`;
}

// POST /api/auth/register
authRouter.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role = 'patient',
      phone,
      facilityName,
      facilityLevel,
      facilityType,
      licenseNumber,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(409).json({
        code: 'DUPLICATE_EMAIL',
        error: 'An account with this email address already exists. Please sign in instead.',
      });
    }

    // Role check: public users can register as patient, doctor, caregiver, pharmacy, or lab
    const allowedRoles = ['patient', 'doctor', 'caregiver', 'pharmacy', 'lab'];
    const assignedRole = allowedRoles.includes(role) ? role : 'patient';
    const healthPassId = (assignedRole === 'patient' || assignedRole === 'caregiver') ? generateHealthPassId() : undefined;

    // Determine verification server-side. Client-supplied isVerified is never trusted.
    // - Patients, caregivers, pharmacists, and diagnostic labs are active immediately
    // - Doctors must be verified by an administrator before access is enabled
    const isVerified = assignedRole === 'patient' || assignedRole === 'caregiver' || assignedRole === 'pharmacy' || assignedRole === 'lab';

    const user = new User({
      name: name.trim(),
      email: cleanEmail,
      password,
      role: assignedRole,
      phone: phone ? phone.trim() : undefined,
      dateOfBirth: req.body.dateOfBirth ? String(req.body.dateOfBirth).trim() : undefined,
      healthPassId,
      facilityName: facilityName ? facilityName.trim() : undefined,
      facilityLevel: facilityLevel || (assignedRole === 'pharmacy' ? 'PHARMACY' : assignedRole === 'lab' ? 'LAB' : ''),
      facilityType: facilityType ? facilityType.trim() : undefined,
      licenseNumber: licenseNumber ? licenseNumber.trim() : undefined,
      isVerified,
    });

    await user.save();

    // Create patient profile for patients
    if (user.role === 'patient') {
      await PatientProfile.create({
        patientId: user._id,
        bloodGroup: req.body.bloodGroup || '',
        gender: req.body.gender || '',
        age: req.body.age ? Number(req.body.age) : undefined,
        dateOfBirth: req.body.dateOfBirth ? String(req.body.dateOfBirth).trim() : '',
      });
    }

    await AuditLog.create({
      patientId: user.role === 'patient' ? user._id : undefined,
      actorId: user._id,
      actorName: user.name,
      actorRole: user.role,
      action: 'USER_REGISTERED',
      plainSummary: `${user.name} registered as a ${user.role} at ${user.facilityName || 'HealthPass'}.`,
    });

    if (!user.isVerified) {
      return res.status(201).json({
        success: true,
        user: user.toSafeObject(),
        verificationRequired: true,
        message: 'Account created. A hospital administrator must verify your credentials before access is enabled.',
      });
    }

    const token = signToken(user);
    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      token,
      user: user.toSafeObject(),
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        code: 'DUPLICATE_EMAIL',
        error: 'An account with this email address already exists.',
      });
    }
    return res.status(400).json({ error: err.message || 'Registration failed.' });
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.role !== 'patient' && !user.isVerified) {
      return res.status(403).json({
        code: 'PROVIDER_UNVERIFIED',
        error: `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} account is pending administrator verification.`,
      });
    }

    const token = signToken(user);
    setAuthCookie(res, token);

    await AuditLog.create({
      patientId: user.role === 'patient' ? user._id : undefined,
      actorId: user._id,
      actorName: user.name,
      actorRole: user.role,
      action: 'USER_LOGIN',
      plainSummary: `${user.name} signed in successfully.`,
    });

    return res.status(200).json({
      success: true,
      token,
      user: user.toSafeObject(),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Sign-in failed.', details: err.message });
  }
});

// GET /api/auth/me
authRouter.get('/me', authenticate, async (req, res) => {
  try {
    return res.status(200).json({
      user: req.user.toSafeObject(),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to restore session.' });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', (req, res) => {
  clearAuthCookie(res);
  return res.status(200).json({ success: true, message: 'Signed out successfully.' });
});
