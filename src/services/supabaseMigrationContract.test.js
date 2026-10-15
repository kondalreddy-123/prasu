import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const migration = (name) => readFileSync(fileURLToPath(new URL(`../../supabase/migrations/${name}`, import.meta.url)), 'utf8');
const core = migration('202610150001_healthpass_core.sql');
const pharmacist = migration('202610150002_pharmacist_prescription_consent.sql');
const runtime = migration('202610150003_healthpass_runtime_support.sql');

test('migration order declares the runtime dependencies it extends', () => {
  assert.match(pharmacist, /Depends on 202610150001_healthpass_core\.sql/i);
  assert.match(runtime, /public\.pharmacist_applications/);
  assert.match(runtime, /public\.health_records/);
  assert.match(runtime, /public\.prescription_records/);
  assert.match(runtime, /public\.consent_grants/);
});

test('security-definer functions pin an empty search_path', () => {
  for (const [file, sql] of [['core', core], ['pharmacist', pharmacist], ['runtime', runtime]]) {
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
