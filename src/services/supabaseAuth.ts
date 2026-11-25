import type { User } from '@supabase/supabase-js';
import { requireSupabase } from './supabaseClient.ts';

export type HealthPassAuthUser = {
  id: string;
  email: string;
  name: string;
  role: 'patient' | 'doctor' | 'pharmacy' | 'lab';
  facilityName?: string;
  facilityLevel?: string;
  healthPassId?: string;
  backend: 'supabase';
};

async function mapAuthenticatedUser(user: User): Promise<HealthPassAuthUser> {
  const client = requireSupabase();
  const { data: patient, error: patientError } = await client
    .from('patient_profiles')
    .select('user_id, display_name, healthpass_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (patientError) throw new Error(patientError.message);
  if (patient) return {
    id: user.id, email: user.email || '', name: patient.display_name || user.email || 'Patient',
    role: 'patient', healthPassId: patient.healthpass_id, backend: 'supabase',
  };

  const { data: provider, error: providerError } = await client
    .from('verified_providers')
    .select('user_id, provider_type, provider_name, facility_name, facility_level, active')
    .eq('user_id', user.id)
    .maybeSingle();
  if (providerError) throw new Error(providerError.message);
  if (provider?.active) {
    const role = provider.provider_type === 'PHARMACIST' ? 'pharmacy' : provider.provider_type === 'LAB' ? 'lab' : 'doctor';
    return {
      id: user.id, email: user.email || '', name: provider.provider_name || user.email || 'Provider', role,
      facilityName: provider.facility_name, facilityLevel: provider.facility_level, backend: 'supabase',
    };
  }

  const pendingTables = [
    ['doctor_applications', 'Doctor'],
    ['pharmacist_applications', 'Pharmacist'],
    ['lab_applications', 'Diagnostic laboratory'],
  ] as const;
  for (const [table, label] of pendingTables) {
    const { data, error } = await client.from(table).select('status').eq('user_id', user.id).limit(1);
    if (error) throw new Error(error.message);
    if (data?.length) throw new Error(`${label} application is ${String(data[0].status).toLowerCase()}. A trusted administrator must verify this account before access is enabled.`);
  }
  throw new Error('This account is not linked to a HealthPass patient profile or active verified provider. Contact the HealthPass administrator.');
}

export async function signInSupabase(email: string, password: string) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    const raw = error?.message || 'Supabase sign-in failed.';
    // Translate Supabase GoTrue error messages into plain-language hints
    if (raw.toLowerCase().includes('invalid login credentials') || raw.toLowerCase().includes('invalid_credentials')) {
      throw new Error('Incorrect email or password. Demo accounts use password HealthPass@123 (e.g. ananya.rao@healthpass.in).');
    }
    if (raw.toLowerCase().includes('email not confirmed')) {
      throw new Error('Please confirm your email address first, or ask the administrator to confirm your account.');
    }
    if (raw.toLowerCase().includes('too many requests')) {
      throw new Error('Too many sign-in attempts. Please wait a few minutes and try again.');
    }
    throw new Error(raw);
  }
  try {
    return await mapAuthenticatedUser(data.user);
  } catch (mappingError) {
    await client.auth.signOut();
    throw mappingError;
  }
}

export async function restoreSupabaseUser() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(error.message);
  if (!data.session?.user) return null;
  try {
    return await mapAuthenticatedUser(data.session.user);
  } catch (mappingError) {
    await client.auth.signOut();
    throw mappingError;
  }
}

export async function signUpSupabasePatient(email: string, password: string, displayName: string) {
  return signUpSupabaseUser({
    email,
    password,
    name: displayName,
    role: 'patient',
  });
}

export async function signUpSupabaseUser(payload: {
  email: string;
  password: string;
  name: string;
  role: 'patient' | 'doctor' | 'pharmacy' | 'lab';
  facilityName?: string;
  facilityType?: string;
  facilityLevel?: string;
  licenseNumber?: string;
  bloodGroup?: string;
  age?: string;
  dateOfBirth?: string;
  gender?: string;
}) {
  const client = requireSupabase();
  const accountType =
    payload.role === 'doctor'
      ? 'DOCTOR'
      : payload.role === 'pharmacy'
        ? 'PHARMACIST'
        : payload.role === 'lab'
          ? 'LAB'
          : 'PATIENT';

  const meta: Record<string, string> = {
    account_type: accountType,
    display_name: payload.name.trim().slice(0, 200),
  };
  if (payload.facilityName) meta.facility_name = payload.facilityName.trim().slice(0, 200);
  if (payload.facilityType) meta.facility_type = payload.facilityType.trim().slice(0, 100);
  if (payload.facilityLevel) meta.facility_level = payload.facilityLevel.trim().slice(0, 40);
  if (payload.licenseNumber) meta.professional_id = payload.licenseNumber.trim().slice(0, 100);

  const { data, error } = await client.auth.signUp({
    email: payload.email.trim(),
    password: payload.password,
    options: { data: meta },
  });
  if (error) {
    const raw = error.message || '';
    const code = (error as any).code || '';
    // over_email_send_rate_limit = Supabase free-tier rate limit (~6 signups/hour per IP)
    if (code === 'over_email_send_rate_limit' ||
        raw.toLowerCase().includes('too many requests') ||
        raw.toLowerCase().includes('rate limit') ||
        raw.toLowerCase().includes('email rate limit')) {
      throw new Error(
        'Sign-up limit reached (Supabase free tier: ~6 accounts/hour per IP address). ' +
        'Please wait 10 minutes then try again, or use a demo account to sign in now: ' +
        'ananya.rao@healthpass.in / HealthPass@123'
      );
    }
    if (raw.toLowerCase().includes('already registered') ||
        raw.toLowerCase().includes('user already exists') ||
        code === 'user_already_exists') {
      throw new Error('An account with this email already exists. Try signing in instead.');
    }
    throw new Error(raw || 'Account registration failed.');
  }
  if (!data.user) throw new Error('Account registration failed.');
  if (payload.role !== 'patient') {
    return {
      user: null,
      verificationRequired: true,
      message: 'Account created. A hospital administrator must verify your credentials before access is enabled.',
    };
  }
  if (!data.session) {
    return {
      user: null,
      confirmationRequired: true,
      message: 'Registration successful. If email confirmations are enabled, please check your email inbox.',
    };
  }
  return { user: await mapAuthenticatedUser(data.user), confirmationRequired: false };
}

export async function signOutSupabase() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) throw new Error(error.message);
}
