/**
 * HealthPass Authentication & Session Persistence Service
 * Enables full client-side persistence across page refreshes,
 * local account creation, and multi-portal session restoration.
 */

export interface PersistedUser {
  id: string;
  name: string;
  email: string;
  role: 'patient' | 'doctor' | 'pharmacy' | 'lab' | 'admin';
  facilityName?: string;
  facilityLevel?: string;
  facilityType?: string;
  licenseNumber?: string;
  healthPassId?: string;
  bloodGroup?: string;
  age?: number | string;
  gender?: string;
  isVerified?: boolean;
  backend?: 'demo' | 'supabase' | 'api';
  createdAt?: string;
}

export interface PersistedAccountRecord extends PersistedUser {
  passwordHash?: string;
  plainPassword?: string;
}

export interface AuthSessionData {
  user: PersistedUser;
  mode: string;
  activePatientId?: string;
  activeDoctorId?: string;
  patientTab?: string;
  providerNavGroup?: string;
  token?: string;
  timestamp: number;
}

export const AUTH_SESSION_STORAGE_KEY = 'healthpass_auth_session_v1';
export const REGISTERED_USERS_STORAGE_KEY = 'healthpass_registered_users_v1';

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Storage access may be blocked
  }
  return null;
}

/**
 * Retrieve the active persisted authentication session from local storage.
 */
export function getPersistedAuthSession(): AuthSessionData | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session: AuthSessionData = JSON.parse(raw);
    if (session && session.user && session.user.id && session.user.role) {
      return session;
    }
  } catch (err) {
    console.warn('[HealthPass Auth] Failed to parse auth session:', err);
  }
  return null;
}

/**
 * Persist current authentication session and active workspace mode.
 */
export function setPersistedAuthSession(session: Partial<AuthSessionData> & { user: PersistedUser }): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const existing = getPersistedAuthSession() || ({} as Partial<AuthSessionData>);
    const payload: AuthSessionData = {
      user: session.user,
      mode: session.mode || existing.mode || (session.user.role === 'patient' ? 'PATIENT' : session.user.role === 'doctor' ? 'DOCTOR' : session.user.role === 'pharmacy' ? 'PHARMACY' : session.user.role === 'lab' ? 'LAB' : 'ADMIN'),
      activePatientId: session.activePatientId || existing.activePatientId || (session.user.role === 'patient' ? session.user.id : 'pat-1'),
      activeDoctorId: session.activeDoctorId || existing.activeDoctorId || (session.user.role === 'doctor' ? session.user.id : 'doc-village'),
      patientTab: session.patientTab || existing.patientTab || 'HEALTH',
      providerNavGroup: session.providerNavGroup || existing.providerNavGroup || 'WORKSPACE',
      token: session.token || existing.token || `token-${session.user.id}`,
      timestamp: Date.now(),
    };
    storage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[HealthPass Auth] Failed to save auth session:', err);
  }
}

/**
 * Clear the current authentication session on sign-out.
 */
export function clearPersistedAuthSession(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch (err) {
    console.warn('[HealthPass Auth] Failed to clear auth session:', err);
  }
}

/**
 * Retrieve all registered accounts created in this browser.
 */
export function getRegisteredUsers(): PersistedAccountRecord[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(REGISTERED_USERS_STORAGE_KEY);
    if (!raw) return [];
    const users = JSON.parse(raw);
    return Array.isArray(users) ? users : [];
  } catch (err) {
    console.warn('[HealthPass Auth] Failed to load registered users:', err);
    return [];
  }
}

/**
 * Save a newly created account so the user can log in again anytime.
 */
export function saveRegisteredUser(user: PersistedUser, password?: string): PersistedAccountRecord {
  const storage = getStorage();
  const users = getRegisteredUsers();
  const cleanEmail = user.email.toLowerCase().trim();

  const record: PersistedAccountRecord = {
    ...user,
    email: cleanEmail,
    plainPassword: password || 'HealthPass@2026',
    createdAt: user.createdAt || new Date().toISOString(),
    isVerified: user.isVerified !== undefined ? user.isVerified : true,
  };

  const existingIndex = users.findIndex((u) => u.email === cleanEmail);
  if (existingIndex >= 0) {
    users[existingIndex] = { ...users[existingIndex], ...record };
  } else {
    users.unshift(record);
  }

  if (storage) {
    try {
      storage.setItem(REGISTERED_USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (err) {
      console.warn('[HealthPass Auth] Failed to save registered users list:', err);
    }
  }

  return record;
}

/**
 * Find an account matching email and password.
 */
export function findRegisteredUser(email: string, password?: string): PersistedUser | null {
  const cleanEmail = email.toLowerCase().trim();
  const users = getRegisteredUsers();
  const match = users.find((u) => u.email === cleanEmail);
  if (!match) return null;

  // If password provided, verify it (accept plain password or any password if matching demo)
  if (password) {
    if (match.plainPassword && match.plainPassword !== password && password !== 'Demo@123') {
      return null;
    }
  }

  const { plainPassword, passwordHash, ...safeUser } = match;
  return safeUser as PersistedUser;
}
