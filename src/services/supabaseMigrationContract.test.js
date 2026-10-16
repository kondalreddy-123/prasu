import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const migration = (name) => readFileSync(fileURLToPath(new URL(`../../supabase/migrations/${name}`, import.meta.url)), 'utf8');
const core = migration('202610150001_healthpass_core.sql');
const pharmacist = migration('202610150002_pharmacist_prescription_consent.sql');
const runtime = migration('202610150003_healthpass_runtime_support.sql');
const emergency = migration('202610150004_emergency_limited_access.sql');
const duplicateRecords = migration('202610150005_prevent_duplicate_medical_records.sql');

test('migration order declares the runtime dependencies it extends', () => {
  assert.match(pharmacist, /Depends on 202610150001_healthpass_core\.sql/i);
  assert.match(runtime, /public\.pharmacist_applications/);
  assert.match(runtime, /public\.health_records/);
  assert.match(runtime, /public\.prescription_records/);
  assert.match(runtime, /public\.consent_grants/);
});

test('security-definer functions pin an empty search_path', () => {
  for (const [file, sql] of [['core', core], ['pharmacist', pharmacist], ['runtime', runtime], ['emergency', emergency]]) {
    const functions = [...sql.matchAll(/create or replace function[\s\S]*?\$\$;/gi)].map((match) => match[0]);
    for (const fn of functions.filter((definition) => /security definer/i.test(definition))) {
      assert.match(fn, /set search_path\s*=\s*''/i, `${file}: SECURITY DEFINER function lacks a pinned search_path`);
    }
  }
});

test('consent RPCs check identity, active status, expiry, and granted category', () => {
  assert.match(core, /v_request\.patient_user_id\s*<>\s*auth\.uid\(\)/i);
  assert.match(core, /g\.status\s*=\s*'ACTIVE'[\s\S]*?g\.expires_at\s*>\s*now\(\)/i);
  assert.match(runtime, /auth\.uid\(\).*patient_profiles/s);
  assert.match(runtime, /g\.status\s*=\s*'ACTIVE'[\s\S]*?g\.expires_at\s*>\s*now\(\)[\s\S]*?v_record\.category\s*=\s*any\(g\.granted_categories\)/i);
});

test('storage is private and object reads recheck owner or active category consent', () => {
  assert.match(runtime, /values\s*\('healthpass-private',\s*'healthpass-private',\s*false\)/i);
  assert.match(runtime, /already exists as public; inspect and secure it/i);
  assert.match(runtime, /g\.status\s*=\s*'ACTIVE'[\s\S]*?g\.expires_at\s*>\s*now\(\)[\s\S]*?r\.category\s*=\s*any\(g\.granted_categories\)/i);
  assert.match(runtime, /create policy healthpass_private_read_authorized[\s\S]*?can_read_healthpass_object\(name\)/i);
  assert.match(runtime, /create policy healthpass_private_upload_own_folder[\s\S]*?can_upload_healthpass_object\(name\)/i);
});

test('consultation writes serialize per patient and compare clinically meaningful duplicate fields', () => {
  assert.match(runtime, /pg_advisory_xact_lock\(hashtextextended\(p_patient_user_id::text,\s*0\)\)/i);
  assert.match(runtime, /r\.status\s*=\s*'ACTIVE'[\s\S]*?r\.valid_until\s+is\s+null\s+or\s+r\.valid_until\s*>=\s*current_date/i);
  for (const field of ['medication_name', 'strength', 'dosage', 'route', 'frequency', 'formulation', 'duration', 'instructions']) {
    assert.match(runtime, new RegExp(`r\\.${field}\\b`, 'i'), `duplicate comparison omits ${field}`);
  }
  assert.match(runtime, /with ordinality[\s\S]*?a\.idx\s*<\s*b\.idx/i);
  assert.equal([...runtime.matchAll(/create or replace function public\.get_consented_prescriptions\(/gi)].length, 1);
});

test('health record duplicate trigger matches the same event and serializes concurrent inserts', () => {
  assert.match(duplicateRecords, /before insert on public\.health_records/i);
  assert.match(duplicateRecords, /pg_advisory_xact_lock/i);
  assert.match(duplicateRecords, /sourceRecordId|accessionNumber/i);
  assert.match(duplicateRecords, /documentFingerprint|sourceFingerprint/i);
  assert.match(duplicateRecords, /coalesce\(r\.record_date, r\.created_at::date\)[\s\S]*?coalesce\(p_record_date, current_date\)/i);
  assert.match(duplicateRecords, /r\.patient_user_id = p_patient_user_id[\s\S]*?r\.category = p_category/i);
  assert.match(duplicateRecords, /find_duplicate_health_record[\s\S]*?auth\.uid\(\) = p_patient_user_id[\s\S]*?g\.status = 'ACTIVE'[\s\S]*?g\.expires_at > now\(\)/i);
  assert.match(duplicateRecords, /errcode = '23505'/i);
});

test('emergency lookup requires a verified doctor, matching HealthPass ID and birth date, reason, and incapacity attestation', () => {
  assert.match(emergency, /create or replace function public\.emergency_patient_lookup/i);
  assert.match(emergency, /security definer[\s\S]*?set search_path\s*=\s*''/i);
  assert.match(emergency, /auth\.uid\(\) is null[\s\S]*?p\.active and p\.provider_type = 'DOCTOR'/i);
  assert.match(emergency, /patient\.date_of_birth = p_date_of_birth/i);
  assert.match(emergency, /patient\.date_of_birth_verified_at is not null/i);
  assert.match(emergency, /date_of_birth_verified_at[\s\S]*?authenticated patients cannot update this column/i);
  assert.match(emergency, /length\(trim\(coalesce\(p_reason, ''\)\)\) not between 10 and 500/i);
  assert.match(emergency, /p_patient_unable_to_consent is distinct from true/i);
  assert.match(emergency, /raise exception 'Emergency lookup could not be verified'/i);
});

test('emergency summary is limited, unpersisted in client storage, and audited before release', () => {
  assert.match(emergency, /create table if not exists public\.emergency_access_events/i);
  assert.match(emergency, /emergency_access_event_read_patient_or_actor[\s\S]*?patient_user_id = \(select auth\.uid\(\)\) or actor_user_id = \(select auth\.uid\(\)\)/i);
  assert.match(emergency, /where r\.patient_user_id = v_patient\.user_id and r\.category = any\(v_categories\)[\s\S]*?limit 12/i);
  assert.match(emergency, /rx\.status = 'ACTIVE'[\s\S]*?limit 5/i);
  assert.match(emergency, /insert into public\.emergency_access_events[\s\S]*?return jsonb_build_object/i);
  assert.match(emergency, /actor_user_id, actor_name, reason, categories[\s\S]*?v_actor\.provider_name/i);
  assert.match(emergency, /'labFindings', v_lab_findings/i);
  assert.match(emergency, /revoke all on function public\.emergency_patient_lookup\(text, date, text, boolean\) from public, anon/i);
  assert.match(emergency, /grant execute on function public\.emergency_patient_lookup\(text, date, text, boolean\) to authenticated/i);
});
