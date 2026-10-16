import { getMedicalRecordCategory, MEDICAL_RECORD_CATEGORIES } from '../medicalRecordCategories.ts';
import { getPrescriptionDisplayStatus } from './pharmacistPrescriptionAccess.js';
import { requireSupabase } from './supabaseClient.ts';

type Options = RequestInit & { patientId?: string; doctorId?: string; pharmacistId?: string; labId?: string; suppressGlobal403?: boolean };

const result = (ok: boolean, status: number, data: any, consentError?: any) => ({ ok, status, data, consentError });
const bodyOf = (options: Options) => {
  try { return options.body ? JSON.parse(String(options.body)) : {}; } catch { return {}; }
};
const statusFor = (error: any) => error?.code === '42501' || error?.status === 403 ? 403 : error?.code === 'P0002' || error?.code === 'PGRST116' ? 404 : error?.code === '23505' ? 409 : 400;
const failed = (error: any) => result(false, statusFor(error), {
  code: statusFor(error) === 403 ? 'NO_CONSENT' : statusFor(error) === 409 ? 'DUPLICATE_MEDICAL_RECORD' : undefined,
  error: error?.message || 'The Supabase request failed.',
  message: error?.message || 'The Supabase request failed.',
});

async function loadOriginalForAuthorizedSession(storagePath?: string | null) {
  if (!storagePath) return undefined;
  const marker = 'healthpass-private/';
  const objectPath = storagePath.startsWith(marker) ? storagePath.slice(marker.length) : '';
  if (!objectPath) return undefined;
  // Download through the authenticated Storage API so RLS and current consent
  // are evaluated on the read itself; avoid issuing a bearer URL that bypasses
  // subsequent policy checks until its expiry.
  const { data, error } = await requireSupabase().storage.from('healthpass-private').download(objectPath);
  if (error) return undefined;
  return URL.createObjectURL(data);
}

function mapRecord(row: any, patientId = row.patient_user_id) {
  const payload = row.record_payload && typeof row.record_payload === 'object' ? row.record_payload : {};
  return {
    ...payload,
    id: row.id,
    patientId,
    title: row.title,
    category: row.category === 'Laboratory Reports' ? 'Lab reports' : row.category,
    medicalCategory: row.category,
    resultSummary: row.summary || '',
    reportDate: row.record_date || '',
    date: row.record_date || row.created_at,
    source: row.source_type === 'PATIENT_REPORTED' ? 'PATIENT_UPLOAD' : row.uploader_role === 'lab' ? 'LAB_UPLOAD' : 'DOCTOR_UPLOAD',
    uploaderRole: row.uploader_role,
    uploadedBy: row.recorded_by,
    uploadedAt: row.created_at,
    verificationStatus: row.verification_status,
    fileDataUrl: undefined,
    storagePath: row.storage_path || undefined,
  };
}

function mapPrescription(row: any) {
  return {
    id: row.id,
    patientId: row.patient_user_id,
    prescriptionGroupId: row.prescription_group_id,
    doctorName: row.prescribing_clinician,
    doctorId: row.prescribing_provider_user_id,
    createdAt: row.created_at,
    date: row.prescription_date,
    status: row.status,
    diagnosis: 'Prescription',
    confirmedByClinician: true,
    medicines: [{
      id: row.id, name: row.medication_name, strength: row.strength, dosage: row.dosage,
      route: row.route, frequency: row.frequency, duration: row.duration, instructions: row.instructions,
      formulation: row.formulation, validUntil: row.valid_until, status: row.status,
    }],
  };
}

function groupPrescriptions(rows: any[]) {
  const grouped = new Map<string, any>();
  for (const row of rows || []) {
    const mapped = mapPrescription(row);
    const key = row.prescription_group_id || row.id;
    const current = grouped.get(key);
    if (current) current.medicines.push(...mapped.medicines);
    else grouped.set(key, mapped);
  }
  return [...grouped.values()];
}

async function userId() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw Object.assign(new Error('Sign in with Supabase to continue.'), { status: 401 });
  return data.user.id;
}

async function identityForHealthPassId(healthPassId: string) {
  const { data, error } = await requireSupabase().rpc('lookup_patient_identity', { p_healthpass_id: healthPassId });
  if (error) throw error;
  const identity = Array.isArray(data) ? data[0] : data;
  if (!identity?.patient_user_id) throw Object.assign(new Error('No patient matches that HealthPass ID.'), { code: 'P0002' });
  return identity;
}

async function requestRow(requestId: string) {
  const { data, error } = await requireSupabase().from('consent_requests')
    .select('*, verified_providers(provider_type, provider_name, facility_name, facility_level, facility_type), consent_grants(*)')
    .eq('id', requestId).maybeSingle();
  if (error) throw error;
  return data;
}

async function mapPatientWallet(patientId: string) {
  const client = requireSupabase();
  const uid = await userId();
  if (uid !== patientId) throw Object.assign(new Error('The signed-in patient does not own this record.'), { status: 403 });
  const [profileResult, recordsResult, prescriptionsResult, inboxResult, auditsResult, emergencyAuditsResult] = await Promise.all([
    client.from('patient_profiles').select('*').eq('user_id', uid).single(),
    client.from('health_records').select('*').eq('patient_user_id', uid).order('record_date', { ascending: false, nullsFirst: false }),
    client.from('prescription_records').select('*').eq('patient_user_id', uid).order('created_at', { ascending: false }),
    client.rpc('get_patient_consent_inbox'),
    client.from('audit_events').select('*').eq('patient_user_id', uid).order('occurred_at', { ascending: false }).limit(200),
    client.from('emergency_access_events').select('id, patient_user_id, actor_user_id, actor_name, reason, categories, occurred_at').eq('patient_user_id', uid).order('occurred_at', { ascending: false }).limit(100),
  ]);
  for (const item of [profileResult, recordsResult, prescriptionsResult, inboxResult, auditsResult, emergencyAuditsResult]) if (item.error) throw item.error;
  const profile = profileResult.data;
  const records = recordsResult.data || [];
  const mappedRecords = await Promise.all(records.map(async (row: any) => ({
    ...mapRecord(row, uid), fileDataUrl: await loadOriginalForAuthorizedSession(row.storage_path),
  })));
  const prescriptions = groupPrescriptions(prescriptionsResult.data || []);
  const visits = mappedRecords.filter((item) => item.medicalCategory === 'Consultation History');
  const medicines = mappedRecords.filter((item) => item.medicalCategory === 'Medications & Prescriptions');
  const allergies = mappedRecords.filter((item) => item.medicalCategory === 'Allergies').map((item) => ({
    id: item.id, patientId: uid, allergen: item.title, severity: item.record_payload?.severity || '',
    reaction: item.record_payload?.reaction || '', source: item.source,
  }));
  const reports = mappedRecords.filter((item) => !['Consultation History', 'Medications & Prescriptions', 'Allergies'].includes(item.medicalCategory));
  const consentGrants = (inboxResult.data || []).map((grant: any) => ({
    ...grant,
    id: grant.grantId || grant.requestId || grant.id,
  }));
  return {
    patient: {
      id: uid, name: profile.display_name, healthPassId: profile.healthpass_id,
      dateOfBirth: profile.date_of_birth, bloodGroup: profile.blood_group || undefined,
    },
    patientHealthProfile: {
      patientId: uid, knownAllergies: profile.known_allergies || '', adverseDrugReactions: profile.adverse_drug_reactions || '',
      currentMedications: profile.current_medications || '', healthConditions: profile.medical_conditions || '',
      pastSurgeries: profile.past_surgeries || '', emergencyContactName: profile.emergency_contact_name || '',
      emergencyContactRelation: profile.emergency_contact_relation || '', emergencyContactPhone: profile.emergency_contact_phone || '',
      bloodGroup: profile.blood_group || '', source: 'Patient-provided', verificationStatus: 'Unverified', updatedAt: profile.updated_at,
    },
    record: { allergies, medicines, visits, reports, prescriptions, chronicConditions: [], vitals: [], vaccinations: [] },
    grants: consentGrants,
    auditLogs: [
      ...(auditsResult.data || []).map((event: any) => ({
      id: event.id, patientId: event.patient_user_id, timestamp: event.occurred_at,
      action: event.event_type, actorName: event.actor_user_id === uid ? profile.display_name : 'Authorized provider',
      plainSummary: `${event.event_type.replaceAll('_', ' ')} · ${(event.categories || []).join(', ')}`,
      })),
      ...(emergencyAuditsResult.data || []).map((event: any) => ({
        id: event.id, patientId: event.patient_user_id, timestamp: event.occurred_at,
        action: 'EMERGENCY_ACCESS', actorName: event.actor_name || 'Verified doctor',
        plainSummary: `Emergency access by ${event.actor_name || 'verified doctor'} · ${event.reason} · ${(event.categories || []).join(', ')}`,
      })),
    ].sort((a: any, b: any) => Date.parse(b.timestamp) - Date.parse(a.timestamp)),
    emergencyLinks: [], notifications: [], auditChainVerification: { totalEntries: (auditsResult.data?.length || 0) + (emergencyAuditsResult.data?.length || 0), simulated: false },
  };
}

function consentError(error: any) {
  return {
    code: 'NO_CONSENT', message: error?.message || 'Active patient consent is required.',
    screenTitle: 'Access is not available', screenSubtitle: error?.message || 'The patient has not shared this record category.',
    primaryActionLabel: 'Request access',
  };
}

async function storeReportFile(patientId: string, reportId: string, fileDataUrl?: string, objectPath?: string) {
  if (!fileDataUrl || !fileDataUrl.startsWith('data:')) return null;
  if (fileDataUrl.length > 8_000_000) throw new Error('Report file is too large for this upload.');
  const match = fileDataUrl.match(/^data:([^;,]+);base64,(.+)$/s);
  if (!match) throw new Error('The report file could not be read.');
  const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
  const path = objectPath || `${patientId}/${reportId}/${crypto.randomUUID()}`;
  const { error } = await requireSupabase().storage.from('healthpass-private').upload(path, new Blob([bytes], { type: match[1] }), {
    contentType: match[1], upsert: false,
  });
  if (error) throw error;
  return { path, storagePath: `healthpass-private/${path}` };
}

async function createStoredRecord(rpc: string, args: Record<string, any>, patientId: string, fileDataUrl?: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc(rpc, args);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  let originalUrl: string | undefined;
  if (fileDataUrl && row?.id) {
    try {
      const objectPath = `${patientId}/${row.id}/${crypto.randomUUID()}`;
      const storagePath = `healthpass-private/${objectPath}`;
      const { error: attachError } = await client.rpc('attach_healthpass_storage_path', {
        p_record_id: row.id, p_storage_path: storagePath,
      });
      if (attachError) throw attachError;
      const stored = await storeReportFile(patientId, row.id, fileDataUrl, objectPath);
      if (stored) {
        originalUrl = await loadOriginalForAuthorizedSession(stored.storagePath);
      }
    } catch (error: any) {
      return { record: mapRecord(row, patientId), warning: `The report details were saved, but the original file could not be uploaded: ${error?.message || 'storage error'}` };
    }
  }
  return { record: { ...mapRecord(row, patientId), fileDataUrl: originalUrl } };
}

async function findDuplicateHealthRecord(patientId: string, category: string, title: string, summary: string, recordDate: string | null, payload: any) {
  const { data, error } = await requireSupabase().rpc('find_duplicate_health_record', {
    p_patient_user_id: patientId, p_category: category, p_title: title, p_summary: summary || '',
    p_record_date: recordDate || null, p_record_payload: payload || {},
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

function duplicateRecordResult(row: any, patientId: string) {
  return result(false, 409, {
    code: 'DUPLICATE_MEDICAL_RECORD',
    error: 'A matching active medical record already exists. Please open the existing record instead of creating another.',
    existingRecordId: row.id,
    report: mapRecord(row, patientId),
  });
}

export async function handleSupabaseApiRequest(endpoint: string, options: Options = {}) {
  try {
    const client = requireSupabase();
    const url = new URL(endpoint, window.location.origin);
    const path = url.pathname;
    const method = (options.method || 'GET').toUpperCase();
    const body = bodyOf(options);

    if (path === '/api/demo/status') return result(true, 200, { localOnly: false, storageStatus: 'supabase', persistent: true });
    if (path === '/api/auth/login') return result(false, 400, { error: 'Use Supabase Auth sign-in from the login form.' });
    if (path.includes('/wallet') && method === 'GET') {
      const patientId = path.split('/')[3];
      return result(true, 200, await mapPatientWallet(patientId));
    }

    const profileMatch = path.match(/^\/api\/patient\/([^/]+)\/health-profile$/);
    if (profileMatch) {
      const patientId = profileMatch[1];
      if (await userId() !== patientId) return result(false, 403, { error: 'Only the patient who owns this profile can access it.' });
      if (method === 'GET') {
        const { data, error } = await client.from('patient_profiles').select('*').eq('user_id', patientId).single();
        if (error) throw error;
        return result(true, 200, { profile: profileToUi(data) });
      }
      if (method === 'PUT') {
        const { data, error } = await client.from('patient_profiles').update(profileToDb(body)).eq('user_id', patientId).select('*').single();
        if (error) throw error;
        return result(true, 200, { profile: profileToUi(data) });
      }
    }

    if (path === '/api/provider/lookup' && method === 'POST') {
      const query = String(body.query || '').trim();
      const { data, error } = await client.rpc('lookup_patient_identity', { p_healthpass_id: query });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return result(false, 404, { error: 'No patient matches that HealthPass ID.' });
      return result(true, 200, { lookup: { patientId: row.patient_user_id, name: row.display_name, healthPassId: row.healthpass_id, gatewayLabel: 'HealthPass Verified Identity' } });
    }

    if (path === '/api/emergency/find-patient' && method === 'POST') {
      // The RPC performs provider verification, identity matching, break-glass
      // checks, limited record selection, and audit logging in one transaction.
      // Never do a client-side identity lookup before this call.
      const { data, error } = await client.rpc('emergency_patient_lookup', {
        p_healthpass_id: String(body.healthPassId || '').trim(),
        p_date_of_birth: String(body.dateOfBirth || '').trim() || null,
        p_reason: String(body.reason || '').trim(),
        p_patient_unable_to_consent: body.patientUnableToConsent === true,
      });
      if (error) throw error;
      return result(true, 200, { summary: data });
    }

    if (path === '/api/provider/request-access' && method === 'POST') {
      const { data: requestId, error } = await client.rpc('request_patient_access', {
        p_patient_user_id: body.patientId, p_purpose: body.purpose,
        p_categories: body.requestedCategories, p_duration_hours: body.durationHours || 24,
      });
      if (error) throw error;
      const request = await requestRow(requestId);
      return result(true, 201, { grant: mapConsentRequest(request), simulatedOtp: undefined });
    }

    const walletConsent = path.match(/^\/api\/patient\/([^/]+)\/consent\/([^/]+)\/(decide|revoke|extend)$/);
    if (walletConsent) {
      const [, patientId, itemId, action] = walletConsent;
      if (await userId() !== patientId) return result(false, 403, { error: 'Only the patient who owns this consent can change it.' });
      if (action === 'decide' && method === 'POST') {
        const { data, error } = await client.rpc('decide_patient_access', {
          p_request_id: itemId, p_decision: body.decision === 'GRANT' ? 'APPROVED' : 'REJECTED',
          p_categories: body.grantedCategories, p_duration_hours: body.durationHours || 24,
        });
        if (error) throw error;
        return result(true, 200, { success: true, grantId: data });
      }
      if (action === 'revoke' && method === 'POST') {
        const { data, error } = await client.rpc('revoke_patient_access', { p_grant_id: itemId });
        if (error) throw error;
        return result(true, 200, { success: Boolean(data) });
      }
      if (action === 'extend' && method === 'POST') {
        const { data, error } = await client.rpc('extend_patient_access', { p_grant_id: itemId, p_extra_hours: body.extraHours || 24 });
        if (error) throw error;
        return result(true, 200, { grant: mapConsentGrant(data) });
      }
    }

    if (/^\/api\/patient\/[^/]+\/consent\/revoke-all$/.test(path) && method === 'POST') {
      const patientId = path.split('/')[3];
      if (await userId() !== patientId) return result(false, 403, { error: 'Only the patient can revoke their access grants.' });
      const { data, error } = await client.from('consent_grants').select('id').eq('patient_user_id', patientId).eq('status', 'ACTIVE');
      if (error) throw error;
      for (const grant of data || []) {
        const revoked = await client.rpc('revoke_patient_access', { p_grant_id: grant.id });
        if (revoked.error) throw revoked.error;
      }
      return result(true, 200, { success: true });
    }

    const patientReportMatch = path.match(/^\/api\/patient\/([^/]+)\/reports(?:\/([^/]+))?(?:\/(summary|explanation|category))?$/);
    if (patientReportMatch && method === 'POST' && !patientReportMatch[2]) {
      const patientId = patientReportMatch[1];
      if (await userId() !== patientId) return result(false, 403, { error: 'Only the patient can add their own report.' });
      const category = MEDICAL_RECORD_CATEGORIES.includes(body.medicalCategory) ? body.medicalCategory : getMedicalRecordCategory(body);
      const recordDate = body.reportDate || body.extractedFields?.reportDate || null;
      const duplicate = await findDuplicateHealthRecord(patientId, category, body.title, body.resultSummary || '', recordDate, body);
      if (duplicate) return duplicateRecordResult(duplicate, patientId);
      const created = await createStoredRecord('create_patient_health_record', {
        p_category: category, p_title: body.title, p_summary: body.resultSummary || '', p_record_date: recordDate,
        p_record_payload: body, p_storage_path: null,
      }, patientId, body.fileDataUrl);
      return result(true, 201, { report: created.record, warning: created.warning });
    }

    if (patientReportMatch && patientReportMatch[2] && method === 'DELETE') {
      const patientId = patientReportMatch[1]; const recordId = patientReportMatch[2];
      if (await userId() !== patientId) return result(false, 403, { error: 'Only the patient can remove their own report.' });
      const { data: row, error: getError } = await client.from('health_records').select('storage_path, source_type').eq('id', recordId).eq('patient_user_id', patientId).single();
      if (getError) throw getError;
      if (row.source_type !== 'PATIENT_REPORTED') return result(false, 403, { error: 'Clinician and laboratory records are retained.' });
      if (row.storage_path?.startsWith('healthpass-private/')) {
        const objectPath = row.storage_path.slice('healthpass-private/'.length);
        const { error: storageError } = await client.storage.from('healthpass-private').remove([objectPath]);
        if (storageError) throw storageError;
      }
      const { error } = await client.from('health_records').delete().eq('id', recordId).eq('patient_user_id', patientId);
      if (error) throw error;
      return result(true, 200, { success: true });
    }

    if (patientReportMatch && patientReportMatch[2] && patientReportMatch[3] === 'category' && method === 'POST') {
      const patientId = patientReportMatch[1]; const recordId = patientReportMatch[2];
      if (await userId() !== patientId) return result(false, 403, { error: 'Only the patient can update their own report.' });
      if (!MEDICAL_RECORD_CATEGORIES.includes(body.medicalCategory)) return result(false, 400, { error: 'Choose a valid medical record category.' });
      const { data, error } = await client.from('health_records').update({ category: body.medicalCategory }).eq('id', recordId).eq('patient_user_id', patientId).eq('source_type', 'PATIENT_REPORTED').select('*').single();
      if (error) throw error;
      return result(true, 200, { report: mapRecord(data, patientId) });
    }

    if (/^\/api\/provider\/patient\/[^/]+\/reports$/.test(path) && method === 'POST') {
      const patientId = path.split('/')[4];
      const category = MEDICAL_RECORD_CATEGORIES.includes(body.medicalCategory) ? body.medicalCategory : getMedicalRecordCategory(body);
      const recordDate = body.reportDate || body.extractedFields?.reportDate || null;
      const duplicate = await findDuplicateHealthRecord(patientId, category, body.title, body.resultSummary || '', recordDate, body);
      if (duplicate) return duplicateRecordResult(duplicate, patientId);
      const created = await createStoredRecord('create_provider_health_record', {
        p_patient_user_id: patientId, p_category: category, p_title: body.title,
        p_summary: body.resultSummary || '', p_record_date: recordDate,
        p_record_payload: body, p_storage_path: null,
      }, patientId, body.fileDataUrl);
      return created.warning ? result(true, 201, { report: created.record, warning: created.warning }) : result(true, 201, { report: created.record });
    }

    if (/^\/api\/provider\/patient\/[^/]+\/consultation$/.test(path) && method === 'POST') {
      const patientId = path.split('/')[4];
      const { data, error } = await client.rpc('record_consultation_with_prescriptions', {
        p_patient_user_id: patientId, p_chief_complaint: body.chiefComplaint || '', p_diagnosis: body.diagnosis || '',
        p_clinical_notes: body.clinicalNotes || '', p_medicines: body.medicines || [],
      });
      if (error) throw error;
      const warning = data?.prescriptionWarning;
      if (warning) return result(true, 201, { ...data, visit: mapRecord(data.visit, patientId), prescriptionWarning: warning });
      return result(true, 201, { ...data, visit: mapRecord(data.visit, patientId), prescription: null });
    }

    if (/^\/api\/provider\/patient\/[^/]+\/record$/.test(path) && method === 'GET') {
      const patientId = path.split('/')[4];
      const [recordsResult, profileResult, prescriptionsResult, grantsResult] = await Promise.all([
        client.rpc('get_consented_records', { p_patient_user_id: patientId }),
        client.rpc('get_consented_patient_profile', { p_patient_user_id: patientId }),
        client.rpc('get_consented_prescriptions', { p_patient_user_id: patientId }),
        client.from('consent_grants').select('*').eq('patient_user_id', patientId).eq('provider_user_id', await userId()).eq('status', 'ACTIVE').gt('expires_at', new Date().toISOString()).order('granted_at', { ascending: false }).limit(1),
      ]);
      const error = recordsResult.error || profileResult.error || prescriptionsResult.error || grantsResult.error;
      if (error) return result(false, statusFor(error), { code: 'NO_CONSENT', message: error.message, error: error.message }, consentError(error));
      const rows = recordsResult.data || [];
      const records = await Promise.all(rows.map(async (row: any) => ({ ...mapRecord(row, patientId), fileDataUrl: await loadOriginalForAuthorizedSession(row.storage_path) })));
      const prescriptions = groupPrescriptions(prescriptionsResult.data || []);
      const profile = profileResult.data || {};
      const activeGrant = grantsResult.data?.[0];
      return result(true, 200, {
        patient: { id: patientId, name: profile.name || 'Patient', healthPassId: profile.healthPassId || '' },
        grant: activeGrant ? mapConsentGrant(activeGrant) : null,
        healthProfileSection: { shared: Object.values(profile).some(Boolean), profile },
        allergies: records.filter((r: any) => r.medicalCategory === 'Allergies'),
        allergiesSection: { shared: records.some((r: any) => r.medicalCategory === 'Allergies') },
        medicinesSection: { shared: records.some((r: any) => r.medicalCategory === 'Medications & Prescriptions'), activeMedicines: records.filter((r: any) => r.medicalCategory === 'Medications & Prescriptions'), pastMedicines: [] },
        prescriptionsSection: { shared: Boolean(prescriptionsResult.data), prescriptions },
        historySection: { shared: records.some((r: any) => r.medicalCategory === 'Consultation History'), chronicConditions: [], visits: records.filter((r: any) => r.medicalCategory === 'Consultation History') },
        labReportsSection: { shared: records.some((r: any) => r.medicalCategory === 'Laboratory Reports'), reports: records.filter((r: any) => r.medicalCategory === 'Laboratory Reports') },
        medicalRecordsSection: { shared: records.length > 0, records },
      });
    }

    if (path === '/api/pharmacy/request-access' && method === 'POST') {
      const { data, error } = await client.rpc('request_pharmacist_prescription_access', { p_healthpass_id: body.healthPassId, p_duration_hours: body.durationHours || 24 });
      if (error) throw error;
      return result(true, 201, { grant: mapConsentRequest(await requestRow(data)) });
    }

    if (path.startsWith('/api/pharmacy/patient/')) {
      const healthPassId = decodeURIComponent(path.split('/').pop() || '');
      const identity = await identityForHealthPassId(healthPassId);
      const [requestQuery, prescriptionsResult] = await Promise.all([
        client.from('consent_requests').select('*, consent_grants(*)').eq('patient_user_id', identity.patient_user_id).eq('provider_user_id', await userId()).order('requested_at', { ascending: false }).limit(1),
        client.rpc('get_consented_prescriptions', { p_patient_user_id: identity.patient_user_id }),
      ]);
      const grant = requestQuery.data?.[0] ? mapConsentRequest(requestQuery.data[0]) : null;
      const accessStatus = prescriptionsResult.error ? grant?.status || 'UNAVAILABLE' : 'ACTIVE';
      return result(true, 200, { patient: { id: identity.patient_user_id, name: identity.display_name, healthPassId: identity.healthpass_id }, grant, accessStatus, prescriptions: prescriptionsResult.error ? [] : (prescriptionsResult.data || []).map((row: any) => ({ ...row, medicationName: row.medication_name, prescribingClinician: row.prescribing_clinician, prescriptionDate: row.prescription_date, validUntil: row.valid_until, status: getPrescriptionDisplayStatus(row) })) });
    }

    if (path === '/api/lab/patient-lookup' && method === 'POST') {
      const identity = await identityForHealthPassId(body.healthPassId);
      const { data, error } = await client.from('consent_requests').select('*, consent_grants(*)').eq('patient_user_id', identity.patient_user_id).eq('provider_user_id', await userId()).order('requested_at', { ascending: false }).limit(1);
      if (error) throw error;
      const grant = data?.[0] ? mapConsentRequest(data[0]) : null;
      return result(true, 200, { patient: { patientId: identity.patient_user_id, name: identity.display_name, healthPassId: identity.healthpass_id }, accessStatus: grant?.status || 'NONE', grant });
    }

    if (path === '/api/lab/request-access' && method === 'POST') {
      const { data, error } = await client.rpc('request_lab_report_access', { p_healthpass_id: body.healthPassId, p_duration_hours: 24 });
      if (error) throw error;
      return result(true, 201, { grant: mapConsentRequest(await requestRow(data)) });
    }

    if (path === '/api/lab/reports' && method === 'POST') {
      const identity = await identityForHealthPassId(body.healthPassId);
      const recordPayload = body.recordPayload || {};
      const duplicate = await findDuplicateHealthRecord(identity.patient_user_id, 'Laboratory Reports', body.title, body.resultSummary || '', body.reportDate || null, recordPayload);
      if (duplicate) return duplicateRecordResult(duplicate, identity.patient_user_id);
      const { data, error } = await client.rpc('create_lab_health_record', {
        p_patient_user_id: identity.patient_user_id, p_title: body.title, p_summary: body.resultSummary || '',
        p_record_date: body.reportDate || null, p_record_payload: recordPayload, p_storage_path: null,
      });
      if (error) throw error;
      return result(true, 201, { report: mapRecord(data, identity.patient_user_id) });
    }

    if (path.includes('/personal-health-report') && method === 'POST') {
      const patientId = path.split('/')[3];
      if (await userId() !== patientId) return result(false, 403, { error: 'Only the patient can export their personal health report.' });
      const categories = Array.isArray(body.categories) ? body.categories : [];
      if (!categories.length || categories.some((category: string) => !MEDICAL_RECORD_CATEGORIES.includes(category as any))) return result(false, 400, { error: 'Select at least one valid medical category.' });
      let query = client.from('health_records').select('*').eq('patient_user_id', patientId).in('category', categories);
      if (body.fromDate) query = query.gte('record_date', body.fromDate);
      if (body.toDate) query = query.lte('record_date', body.toDate);
      const { data, error } = await query;
      if (error) throw error;
      return result(true, 200, { entries: (data || []).map((row: any) => ({ id: row.id, title: row.title, category: row.category, date: row.record_date || '', provider: row.recorded_by, source: row.source_type, verificationStatus: row.verification_status, detail: row.summary })), categories, fromDate: body.fromDate || '', toDate: body.toDate || '' });
    }

    return result(false, 501, { error: `This action (${method} ${path}) is not implemented for authenticated Supabase accounts. Sign in to a demo account for the local prototype workflow.` });
  } catch (error: any) {
    return failed(error);
  }
}

function profileToUi(row: any) {
  return {
    patientId: row.user_id, knownAllergies: row.known_allergies || '', adverseDrugReactions: row.adverse_drug_reactions || '',
    currentMedications: row.current_medications || '', healthConditions: row.medical_conditions || '', pastSurgeries: row.past_surgeries || '',
    emergencyContactName: row.emergency_contact_name || '', emergencyContactRelation: row.emergency_contact_relation || '',
    emergencyContactPhone: row.emergency_contact_phone || '', bloodGroup: row.blood_group || '', source: 'Patient-provided',
    verificationStatus: 'Unverified', updatedAt: row.updated_at,
  };
}

function profileToDb(profile: any) {
  return {
    known_allergies: String(profile.knownAllergies || '').trim(), adverse_drug_reactions: String(profile.adverseDrugReactions || '').trim(),
    current_medications: String(profile.currentMedications || '').trim(), medical_conditions: String(profile.healthConditions || '').trim(),
    past_surgeries: String(profile.pastSurgeries || '').trim(), emergency_contact_name: String(profile.emergencyContactName || '').trim(),
    emergency_contact_relation: String(profile.emergencyContactRelation || '').trim(), emergency_contact_phone: String(profile.emergencyContactPhone || '').trim(),
    blood_group: String(profile.bloodGroup || '').trim() || null, updated_at: new Date().toISOString(),
  };
}

function mapConsentGrant(row: any) {
  return {
    id: row.id, requestId: row.request_id, patientId: row.patient_user_id, providerId: row.provider_user_id,
    doctorId: row.provider_user_id, status: row.status === 'ACTIVE' ? (Date.parse(row.expires_at) > Date.now() ? 'GRANTED' : 'EXPIRED') : 'REVOKED',
    grantedCategories: row.granted_categories || [], purpose: row.purpose, expiresAt: row.expires_at,
    createdAt: row.granted_at, facilityName: '', doctorName: '',
  };
}

function mapConsentRequest(row: any) {
  const grant = Array.isArray(row.consent_grants) ? row.consent_grants[0] : row.consent_grants;
  const provider = Array.isArray(row.verified_providers) ? row.verified_providers[0] : row.verified_providers;
  const providerType = row.provider_type || provider?.provider_type || 'DOCTOR';
  let status = row.status === 'PENDING' ? 'PENDING' : row.status === 'REJECTED' || row.status === 'CANCELLED' ? 'DENIED' : row.status;
  if (grant) status = mapConsentGrant(grant).status;
  return {
    id: row.id, requestId: row.id, grantId: grant?.id, patientId: row.patient_user_id,
    providerId: row.provider_user_id, doctorId: row.provider_user_id,
    providerType: providerType.toLowerCase() === 'pharmacist' ? 'pharmacist' : providerType.toLowerCase(),
    doctorName: row.provider_name || provider?.provider_name || (providerType === 'PHARMACIST' ? 'Pharmacist' : providerType === 'LAB' ? 'Diagnostic Laboratory' : 'Doctor'),
    facilityName: row.facility_name || provider?.facility_name || '', facilityLevel: row.facility_level || provider?.facility_level || '', facilityType: row.facility_type || provider?.facility_type || '',
    purpose: row.purpose, requestedCategories: row.requested_categories || [],
    grantedCategories: grant?.granted_categories || [], durationHours: row.requested_duration_hours,
    expiresAt: grant?.expires_at, createdAt: row.requested_at, status,
  };
}
