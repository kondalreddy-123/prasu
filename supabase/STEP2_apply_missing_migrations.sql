-- STEP 2: Apply missing migrations 4 and 5
-- Run AFTER STEP1_fix_auth_identities.sql
-- Supabase Dashboard -> SQL Editor -> paste -> Run

-- Emergency access is a separate, audited break-glass flow. Providers cannot
-- read these records directly; the authenticated RPC verifies the provider,
-- patient ID + date of birth, emergency reason, and incapacity attestation.

alter table public.patient_profiles
  add column if not exists date_of_birth_verified_at timestamptz;
revoke update (date_of_birth_verified_at) on public.patient_profiles from anon, authenticated;
comment on column public.patient_profiles.date_of_birth_verified_at is
  'Set only by a trusted administrator/service after checking an identity document; authenticated patients cannot update this column.';

create table if not exists public.emergency_access_events (
  id uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  actor_name text not null,
  reason text not null check (length(trim(reason)) between 10 and 500),
  categories text[] not null check (cardinality(categories) > 0),
  patient_unable_to_consent boolean not null default true check (patient_unable_to_consent),
  occurred_at timestamptz not null default now()
);

create index if not exists emergency_access_events_patient_date_idx
  on public.emergency_access_events (patient_user_id, occurred_at desc);

alter table public.emergency_access_events enable row level security;
revoke all on public.emergency_access_events from anon, authenticated;
grant select on public.emergency_access_events to authenticated;

drop policy if exists emergency_access_event_read_patient_or_actor on public.emergency_access_events;
create policy emergency_access_event_read_patient_or_actor on public.emergency_access_events for select to authenticated
  using (patient_user_id = (select auth.uid()) or actor_user_id = (select auth.uid()));

create or replace function public.emergency_patient_lookup(
  p_healthpass_id text,
  p_date_of_birth date,
  p_reason text,
  p_patient_unable_to_consent boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient public.patient_profiles%rowtype;
  v_actor public.verified_providers%rowtype;
  v_event_id uuid;
  v_categories text[] := array[
    'Allergies', 'Medications & Prescriptions', 'Cardiac Care',
    'Diabetes & Metabolic Health', 'Respiratory Health', 'Neurological Health',
    'Kidney Health', 'General Medical History', 'Laboratory Reports'
  ];
  v_records jsonb;
  v_prescriptions jsonb;
  v_lab_findings jsonb;
begin
  if auth.uid() is null then
    raise exception 'Emergency lookup is unavailable' using errcode = '42501';
  end if;
  select p.* into v_actor from public.verified_providers p
  where p.user_id = auth.uid() and p.active and p.provider_type = 'DOCTOR';
  if not found then
    raise exception 'Emergency lookup is unavailable' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_healthpass_id, ''))) not between 3 and 40
    or p_date_of_birth is null
    or length(trim(coalesce(p_reason, ''))) not between 10 and 500
    or p_patient_unable_to_consent is distinct from true then
    raise exception 'Emergency lookup could not be verified' using errcode = '42501';
  end if;

  -- Same response for an unknown ID and an identity mismatch prevents account
  -- enumeration. DOB is an existing patient-held identity detail; ID alone is
  -- deliberately insufficient for emergency retrieval.
  select patient.* into v_patient from public.patient_profiles patient
  where upper(regexp_replace(trim(patient.healthpass_id), '\s+', '', 'g')) =
        upper(regexp_replace(trim(coalesce(p_healthpass_id, '')), '\s+', '', 'g'))
    and patient.date_of_birth = p_date_of_birth
    and patient.date_of_birth_verified_at is not null;
  if not found then
    raise exception 'Emergency lookup could not be verified' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', recent.id,
    'category', recent.category,
    'title', recent.title,
    'summary', left(recent.summary, 1200),
    'date', recent.record_date,
    'verificationStatus', recent.verification_status
  ) order by recent.record_date desc nulls last, recent.created_at desc), '[]'::jsonb)
  into v_records
  from (
    select r.id, r.category, r.title, r.summary, r.record_date,
      r.verification_status, r.created_at
    from public.health_records r
    where r.patient_user_id = v_patient.user_id and r.category = any(v_categories)
      and r.category <> 'Laboratory Reports'
    order by r.record_date desc nulls last, r.created_at desc
    limit 12
  ) recent;

  select coalesce(jsonb_agg(jsonb_build_object(
    'medicationName', recent.medication_name,
    'strength', recent.strength,
    'dosage', recent.dosage,
    'route', recent.route,
    'frequency', recent.frequency,
    'duration', recent.duration,
    'instructions', recent.instructions,
    'prescribingClinician', recent.prescribing_clinician,
    'prescriptionDate', recent.prescription_date,
    'validUntil', recent.valid_until
  ) order by recent.prescription_date desc nulls last, recent.created_at desc), '[]'::jsonb)
  into v_prescriptions
  from (
    select rx.medication_name, rx.strength, rx.dosage, rx.route, rx.frequency,
      rx.duration, rx.instructions, rx.prescribing_clinician,
      rx.prescription_date, rx.valid_until, rx.created_at
    from public.prescription_records rx
    where rx.patient_user_id = v_patient.user_id and rx.status = 'ACTIVE'
      and (rx.valid_until is null or rx.valid_until >= current_date)
    order by rx.prescription_date desc nulls last, rx.created_at desc
    limit 5
  ) recent;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', recent.id,
    'title', recent.title,
    'summary', left(recent.summary, 1200),
    'date', recent.record_date,
    'verificationStatus', recent.verification_status
  ) order by recent.record_date desc nulls last, recent.created_at desc), '[]'::jsonb)
  into v_lab_findings
  from (
    select r.id, r.title, r.summary, r.record_date, r.verification_status, r.created_at
    from public.health_records r
    where r.patient_user_id = v_patient.user_id and r.category = 'Laboratory Reports'
    order by r.record_date desc nulls last, r.created_at desc
    limit 5
  ) recent;

  insert into public.emergency_access_events
    (patient_user_id, actor_user_id, actor_name, reason, categories, patient_unable_to_consent)
  values
    (v_patient.user_id, auth.uid(), v_actor.provider_name, trim(p_reason), v_categories, true)
  returning id into v_event_id;

  return jsonb_build_object(
    'patient', jsonb_build_object(
      'patientId', v_patient.user_id,
      'healthPassId', v_patient.healthpass_id,
      'name', v_patient.display_name,
      'bloodGroup', v_patient.blood_group,
      'knownAllergies', v_patient.known_allergies,
      'adverseDrugReactions', v_patient.adverse_drug_reactions,
      'currentMedications', v_patient.current_medications,
      'medicalConditions', v_patient.medical_conditions,
      'pastSurgeries', v_patient.past_surgeries
    ),
    'records', v_records,
    'prescriptions', v_prescriptions,
    'labFindings', v_lab_findings,
    'accessEventId', v_event_id,
    'reason', trim(p_reason),
    'accessedAt', now()
  );
end;
$$;

revoke all on function public.emergency_patient_lookup(text, date, text, boolean) from public, anon;
grant execute on function public.emergency_patient_lookup(text, date, text, boolean) to authenticated;


-- Match the same logical medical document/event, not merely a category or title.
create or replace function public.matching_health_record_id(
  p_patient_user_id uuid, p_category text, p_title text, p_summary text,
  p_record_date date, p_record_payload jsonb
) returns uuid
language sql
security definer
set search_path = ''
as $$
  select r.id
  from public.health_records r
  where r.patient_user_id = p_patient_user_id
    and r.category = p_category
    and (
      (
        coalesce(nullif(lower(btrim(p_record_payload->>'idempotencyKey')), ''), nullif(lower(btrim(p_record_payload->>'sourceRecordId')), ''), nullif(lower(btrim(p_record_payload->>'documentId')), ''), nullif(lower(btrim(p_record_payload->>'reportId')), ''), nullif(lower(btrim(p_record_payload->>'accessionNumber')), ''), nullif(lower(btrim(p_record_payload#>>'{extractedFields,sourceRecordId}')), ''), nullif(lower(btrim(p_record_payload#>>'{extractedFields,documentId}')), ''), nullif(lower(btrim(p_record_payload#>>'{extractedFields,reportId}')), ''), nullif(lower(btrim(p_record_payload#>>'{extractedFields,accessionNumber}')), '')) is not null
        and coalesce(nullif(lower(btrim(r.record_payload->>'idempotencyKey')), ''), nullif(lower(btrim(r.record_payload->>'sourceRecordId')), ''), nullif(lower(btrim(r.record_payload->>'documentId')), ''), nullif(lower(btrim(r.record_payload->>'reportId')), ''), nullif(lower(btrim(r.record_payload->>'accessionNumber')), ''), nullif(lower(btrim(r.record_payload#>>'{extractedFields,sourceRecordId}')), ''), nullif(lower(btrim(r.record_payload#>>'{extractedFields,documentId}')), ''), nullif(lower(btrim(r.record_payload#>>'{extractedFields,reportId}')), ''), nullif(lower(btrim(r.record_payload#>>'{extractedFields,accessionNumber}')), ''))
          = coalesce(nullif(lower(btrim(p_record_payload->>'idempotencyKey')), ''), nullif(lower(btrim(p_record_payload->>'sourceRecordId')), ''), nullif(lower(btrim(p_record_payload->>'documentId')), ''), nullif(lower(btrim(p_record_payload->>'reportId')), ''), nullif(lower(btrim(p_record_payload->>'accessionNumber')), ''), nullif(lower(btrim(p_record_payload#>>'{extractedFields,sourceRecordId}')), ''), nullif(lower(btrim(p_record_payload#>>'{extractedFields,documentId}')), ''), nullif(lower(btrim(p_record_payload#>>'{extractedFields,reportId}')), ''), nullif(lower(btrim(p_record_payload#>>'{extractedFields,accessionNumber}')), ''))
      )
      or (
        coalesce(nullif(lower(btrim(p_record_payload->>'documentFingerprint')), ''), nullif(lower(btrim(p_record_payload->>'sourceFingerprint')), ''), nullif(lower(btrim(p_record_payload#>>'{extractedFields,documentFingerprint}')), ''), nullif(lower(btrim(p_record_payload#>>'{extractedFields,sourceFingerprint}')), '')) is not null
        and coalesce(nullif(lower(btrim(r.record_payload->>'documentFingerprint')), ''), nullif(lower(btrim(r.record_payload->>'sourceFingerprint')), ''), nullif(lower(btrim(r.record_payload#>>'{extractedFields,documentFingerprint}')), ''), nullif(lower(btrim(r.record_payload#>>'{extractedFields,sourceFingerprint}')), ''))
          = coalesce(nullif(lower(btrim(p_record_payload->>'documentFingerprint')), ''), nullif(lower(btrim(p_record_payload->>'sourceFingerprint')), ''), nullif(lower(btrim(p_record_payload#>>'{extractedFields,documentFingerprint}')), ''), nullif(lower(btrim(p_record_payload#>>'{extractedFields,sourceFingerprint}')), ''))
      )
      or (nullif(p_record_payload->>'fileDataUrl', '') is not null and r.record_payload->>'fileDataUrl' = p_record_payload->>'fileDataUrl')
      or (
        coalesce(r.record_date, r.created_at::date) = coalesce(p_record_date, current_date)
        and lower(regexp_replace(btrim(r.title), '[[:space:]]+', ' ', 'g')) = lower(regexp_replace(btrim(p_title), '[[:space:]]+', ' ', 'g'))
        and lower(regexp_replace(btrim(coalesce(r.summary, '')), '[[:space:]]+', ' ', 'g')) = lower(regexp_replace(btrim(coalesce(p_summary, '')), '[[:space:]]+', ' ', 'g'))
        and lower(regexp_replace(btrim(coalesce(r.record_payload#>>'{extractedFields,facilityName}', r.record_payload#>>'{facilityName}', r.record_payload#>>'{extractedFields,laboratoryName}', r.record_payload#>>'{laboratoryName}', '')), '[[:space:]]+', ' ', 'g'))
          = lower(regexp_replace(btrim(coalesce(p_record_payload#>>'{extractedFields,facilityName}', p_record_payload#>>'{facilityName}', p_record_payload#>>'{extractedFields,laboratoryName}', p_record_payload#>>'{laboratoryName}', '')), '[[:space:]]+', ' ', 'g'))
      )
    )
  order by r.created_at desc
  limit 1;
$$;

create or replace function public.reject_duplicate_health_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_existing_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.patient_user_id::text, 0));
  v_existing_id := public.matching_health_record_id(new.patient_user_id, new.category, new.title, new.summary, new.record_date, new.record_payload);
  if v_existing_id is not null then
    raise exception 'A matching active medical record already exists. Please open the existing record instead of creating another.' using errcode = '23505';
  end if;
  return new;
end;
$$;

-- Return a matching row only to its patient or to a provider with current,
-- category-specific consent. The write trigger remains the race-safe backstop.
create or replace function public.find_duplicate_health_record(
  p_patient_user_id uuid, p_category text, p_title text, p_summary text default '',
  p_record_date date default null, p_record_payload jsonb default '{}'::jsonb
) returns setof public.health_records
language plpgsql
security definer
set search_path = ''
as $$
declare v_existing_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign-in required' using errcode = '42501'; end if;
  if auth.uid() = p_patient_user_id and exists (select 1 from public.patient_profiles p where p.user_id = auth.uid()) then
    null;
  elsif exists (
    select 1 from public.verified_providers p
    join public.consent_grants g on g.provider_user_id = p.user_id and g.patient_user_id = p_patient_user_id
    where p.user_id = auth.uid() and p.active and p.provider_type = 'DOCTOR'
      and g.status = 'ACTIVE' and g.expires_at > now() and p_category = any(g.granted_categories)
  ) then
    null;
  elsif p_category = 'Laboratory Reports' and exists (
    select 1 from public.verified_providers p
    join public.consent_grants g on g.provider_user_id = p.user_id and g.patient_user_id = p_patient_user_id
    where p.user_id = auth.uid() and p.active and p.provider_type = 'LAB'
      and g.status = 'ACTIVE' and g.expires_at > now() and g.granted_categories = array['Laboratory Reports']
  ) then
    null;
  else
    raise exception 'Current patient authorization for this record category is required' using errcode = '42501';
  end if;

  v_existing_id := public.matching_health_record_id(p_patient_user_id, p_category, p_title, coalesce(p_summary, ''), p_record_date, coalesce(p_record_payload, '{}'::jsonb));
  if v_existing_id is not null then return query select r.* from public.health_records r where r.id = v_existing_id; end if;
end;
$$;

revoke all on function public.matching_health_record_id(uuid, text, text, text, date, jsonb) from public, anon, authenticated;
revoke all on function public.reject_duplicate_health_record() from public, anon, authenticated;
revoke all on function public.find_duplicate_health_record(uuid, text, text, text, date, jsonb) from public, anon;

drop trigger if exists reject_duplicate_health_record on public.health_records;
create trigger reject_duplicate_health_record before insert on public.health_records
for each row execute function public.reject_duplicate_health_record();

grant execute on function public.find_duplicate_health_record(uuid, text, text, text, date, jsonb) to authenticated;
