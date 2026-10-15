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
  if (error || !data.user) throw new Error(error?.message || 'Supabase sign-in failed.');
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
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email, password,
    options: { data: { account_type: 'PATIENT', display_name: displayName.trim().slice(0, 200) } },
  });
  if (error) throw new Error(error.message);
  if (!data.session || !data.user) return { user: null, confirmationRequired: true };
  return { user: await mapAuthenticatedUser(data.user), confirmationRequired: false };
}

export async function signOutSupabase() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) throw new Error(error.message);
}
