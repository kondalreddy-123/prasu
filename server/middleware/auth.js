import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { ConsentGrant } from '../models/ConsentGrant.js';
import { AuditLog } from '../models/AuditLog.js';
import { isMedicalCategoryAuthorized } from '../utils/categories.js';

// In production a real secret is mandatory. Never fall back to a known key.
const JWT_SECRET = process.env.JWT_SECRET
  || (process.env.NODE_ENV === 'production' ? '' : 'healthpass-dev-only-insecure-secret');
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured before starting in production.');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export function signToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
      healthPassId: user.healthPassId,
      facilityName: user.facilityName,
      facilityLevel: user.facilityLevel,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res) {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
}

export async function authenticate(req, res, next) {
  try {
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User account not found. Please sign in again.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]`,
      });
    }
    next();
  };
}

export function requireVerifiedDoctor(req, res, next) {
  if (!req.user || req.user.role !== 'doctor') {
    return res.status(403).json({ error: 'Only doctors can access this resource.' });
  }
  if (!req.user.isVerified) {
    return res.status(403).json({
      code: 'DOCTOR_UNVERIFIED',
      error: 'Doctor account is pending administrator verification. Please contact your hospital administrator.',
    });
  }
  next();
}

export function requireVerifiedProvider(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'This provider role cannot access this resource.' });
    }
    if (req.user.role !== 'patient' && req.user.role !== 'admin' && !req.user.isVerified) {
      return res.status(403).json({
        code: 'PROVIDER_UNVERIFIED',
        error: 'Provider account is pending administrator verification.',
      });
    }
    next();
  };
}

/**
 * Checks that the caller is either the patient themselves OR has an active,
 * time-bound consent grant from the most recent patient decision.
 */
export function requirePatientConsent(category = null) {
  return async (req, res, next) => {
    try {
      const patientId = req.params.patientId || req.body.patientId || req.query.patientId;
      if (!patientId) {
        return res.status(400).json({ error: 'Patient ID is required.' });
      }

      // If the caller is the patient themselves, access is always granted
      if (req.user.role === 'patient' && req.user._id.toString() === patientId.toString()) {
        return next();
      }

      // Admins may have oversight
      if (req.user.role === 'admin') {
        return next();
      }

      const now = new Date();
      const grant = await ConsentGrant.findOne({
        patientId,
        providerId: req.user._id,
      }).sort({ createdAt: -1 });

      if (!grant) {
        return res.status(403).json({
          code: 'NO_CONSENT',
          error: 'No active consent grant found for this provider and patient.',
        });
      }

      if (grant.status === 'REVOKED' || grant.status === 'CANCELLED') {
        return res.status(403).json({
          code: 'ACCESS_REVOKED',
          error: 'The patient has withdrawn permission. You can no longer view this medical record.',
        });
      }

      if (grant.status === 'REJECTED') {
        return res.status(403).json({
          code: 'CONSENT_REJECTED',
          error: 'The patient declined this access request. Ask the patient to approve a new request.',
        });
      }

      if (grant.status === 'PENDING') {
        return res.status(403).json({
          code: 'CONSENT_PENDING',
          error: 'This access request is still waiting for the patient to approve it.',
        });
      }

      if (grant.status === 'EXPIRED' || (grant.expiresAt && grant.expiresAt <= now)) {
        if (grant.status !== 'EXPIRED') {
          grant.status = 'EXPIRED';
          await grant.save();
        }
        return res.status(403).json({
          code: 'ACCESS_EXPIRED',
          error: 'Your time-bound consent grant has expired. Request access again to continue.',
        });
      }

      if (grant.status !== 'GRANTED') {
        return res.status(403).json({
          code: 'NO_CONSENT',
          error: 'Patient consent request is not granted.',
        });
      }

      if (category && !isMedicalCategoryAuthorized(grant, category)) {
        return res.status(403).json({
          code: 'CATEGORY_NOT_SHARED',
          error: `Access denied. The patient has not shared the category: ${category}.`,
        });
      }

      // Log access audit only after authorization succeeds.
      await AuditLog.create({
        patientId,
        actorId: req.user._id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'RECORD_ACCESSED',
        plainSummary: `${req.user.name} (${req.user.role}) accessed medical record under active consent.`,
        details: { category, grantId: grant._id },
      });

      req.consentGrant = grant;
      next();
    } catch {
      return res.status(500).json({ error: 'Consent verification failed.' });
    }
  };
}
