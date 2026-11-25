-- =====================================================================
-- HEALTHPASS COMPLETE IDEMPOTENT CONSOLIDATED SUPABASE SCHEMA
-- Generated for Supabase Project: ghjmfrgxoruosykyfpxb
-- Fully idempotent: safe to execute even if partially applied.
-- Includes all 5 migrations in verified chronological dependency order:
--   1. Core Schema & Base Tables
--   2. Pharmacist Prescription Access & Consent
--   3. Runtime Support, Providers, Lab, Storage & Auth Trigger
--   4. Emergency Limited Break-Glass Access
--   5. Duplicate Medical Record Prevention & Concurrency Locks
-- =====================================================================


-- >>> START OF MIGRATION: 202610150001_healthpass_core.sql <<<

-- HealthPass core schema for a new Supabase project.
-- Non-destructive: this migration creates new objects only.
-- Apply with Supabase CLI after reviewing in a disposable local project first.

create table if not exists public.patient_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  healthpass_id text not null unique default (
    'HP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  ),
  display_name text not null default '',
  date_of_birth date,
  blood_group text,
  known_allergies text,
  adverse_drug_reactions text,
  current_medications text,
  medical_conditions text,
  past_surgeries text,
  emergency_contact_name text,
  emergency_contact_relation text,
  emergency_contact_phone text,
  accessibility_needs text,
  communication_needs text,
  updated_at timestamptz not null default now(),
  constraint patient_profiles_blood_group_check check (
    blood_group is null or blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
  )
);

create table if not exists public.doctor_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  applicant_name text not null,
  facility_name text not null,
  facility_type text not null,
  facility_level text not null,
  professional_id text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (user_id, professional_id)
);

-- Only trusted server-side administration may add or verify providers.
create table if not exists public.verified_providers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  application_id uuid not null unique references public.doctor_applications(id),
  provider_name text not null,
  facility_name text not null,
  facility_type text not null,
  facility_level text not null,
  verified_at timestamptz not null default now(),
  active boolean not null default true
);

create table if not exists public.consent_requests (
  id uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  provider_user_id uuid not null references public.verified_providers(user_id) on delete cascade,
  purpose text not null check (length(trim(purpose)) between 3 and 500),
  requested_categories text[] not null check (cardinality(requested_categories) > 0),
  requested_duration_hours integer not null check (requested_duration_hours between 1 and 168),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint consent_requests_categories_check check (requested_categories <@ array[
    'Cardiac Care', 'Diabetes & Metabolic Health', 'Respiratory Health',
    'Neurological Health', 'Kidney Health', 'Allergies',
    'Medications & Prescriptions', 'Laboratory Reports', 'Surgeries & Procedures',
    'Vaccinations', 'Consultation History', 'General Medical History', 'Other Medical Records'
  ]::text[])
);

create table if not exists public.consent_grants (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.consent_requests(id),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  provider_user_id uuid not null references public.verified_providers(user_id) on delete cascade,
  purpose text not null,
  granted_categories text[] not null check (cardinality(granted_categories) > 0),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'REVOKED')),
  revoked_at timestamptz,
  constraint consent_grants_expiry_check check (expires_at > granted_at),
  constraint consent_grants_categories_check check (granted_categories <@ array[
    'Cardiac Care', 'Diabetes & Metabolic Health', 'Respiratory Health',
    'Neurological Health', 'Kidney Health', 'Allergies',
    'Medications & Prescriptions', 'Laboratory Reports', 'Surgeries & Procedures',
    'Vaccinations', 'Consultation History', 'General Medical History', 'Other Medical Records'
  ]::text[])
);

create table if not exists public.health_records (
  id uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in (
    'Cardiac Care', 'Diabetes & Metabolic Health', 'Respiratory Health',
    'Neurological Health', 'Kidney Health', 'Allergies',
    'Medications & Prescriptions', 'Laboratory Reports', 'Surgeries & Procedures',
    'Vaccinations', 'Consultation History', 'General Medical History', 'Other Medical Records'
  )),
  title text not null check (length(trim(title)) between 1 and 300),
  summary text not null default '',
  record_date date,
  source_type text not null default 'PATIENT_REPORTED' check (source_type in ('PATIENT_REPORTED', 'CLINICIAN_RECORDED')),
  verification_status text not null default 'UNVERIFIED' check (verification_status in ('UNVERIFIED', 'CLINICIAN_VERIFIED')),
  storage_path text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_entered_records_unverified check (
    source_type <> 'PATIENT_REPORTED' or verification_status = 'UNVERIFIED'
  )
);

create index if not exists health_records_patient_category_date_idx
  on public.health_records (patient_user_id, category, record_date desc);
create index if not exists consent_requests_patient_status_date_idx
  on public.consent_requests (patient_user_id, status, requested_at desc);
create index if not exists consent_grants_provider_patient_expiry_idx
  on public.consent_grants (provider_user_id, patient_user_id, expires_at)
  where status = 'ACTIVE';

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  recipient_user_id uuid references auth.users(id) on delete set null,
  grant_id uuid references public.consent_grants(id) on delete set null,
  event_type text not null check (event_type in (
    'ACCESS_REQUESTED', 'CONSENT_APPROVED', 'CONSENT_REJECTED',
    'CONSENT_REVOKED', 'RECORDS_VIEWED'
  )),
  categories text[] not null default '{}',
  occurred_at timestamptz not null default now()
);

alter table public.patient_profiles enable row level security;
alter table public.doctor_applications enable row level security;
alter table public.verified_providers enable row level security;
alter table public.consent_requests enable row level security;
alter table public.consent_grants enable row level security;
alter table public.health_records enable row level security;
alter table public.audit_events enable row level security;

revoke all on public.patient_profiles, public.doctor_applications,
  public.verified_providers, public.consent_requests, public.consent_grants,
  public.health_records, public.audit_events from anon, authenticated;

grant select on public.patient_profiles to authenticated;
grant insert (user_id, display_name, date_of_birth, blood_group, known_allergies,
  adverse_drug_reactions, current_medications, medical_conditions, past_surgeries,
  emergency_contact_name, emergency_contact_relation, emergency_contact_phone,
  accessibility_needs, communication_needs) on public.patient_profiles to authenticated;
grant update (display_name, date_of_birth, blood_group, known_allergies,
  adverse_drug_reactions, current_medications, medical_conditions, past_surgeries,
  emergency_contact_name, emergency_contact_relation, emergency_contact_phone,
  accessibility_needs, communication_needs, updated_at) on public.patient_profiles to authenticated;

grant select, insert on public.doctor_applications to authenticated;
grant select on public.verified_providers, public.consent_requests,
  public.consent_grants, public.audit_events to authenticated;
grant select, insert, update, delete on public.health_records to authenticated;
grant usage, select on sequence public.audit_events_id_seq to authenticated;

drop policy if exists patient_profile_read_own on public.patient_profiles;
create policy patient_profile_read_own on public.patient_profiles
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists patient_profile_insert_own on public.patient_profiles;
create policy patient_profile_insert_own on public.patient_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists patient_profile_update_own on public.patient_profiles;
create policy patient_profile_update_own on public.patient_profiles
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists doctor_application_read_own on public.doctor_applications;
create policy doctor_application_read_own on public.doctor_applications
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists doctor_application_submit_own on public.doctor_applications;
create policy doctor_application_submit_own on public.doctor_applications
  for insert to authenticated with check (
    user_id = (select auth.uid()) and status = 'PENDING' and reviewed_at is null
  );

drop policy if exists provider_read_own_verification on public.verified_providers;
create policy provider_read_own_verification on public.verified_providers
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists consent_request_read_patient_or_provider on public.consent_requests;
create policy consent_request_read_patient_or_provider on public.consent_requests
  for select to authenticated using (
    patient_user_id = (select auth.uid()) or provider_user_id = (select auth.uid())
  );
drop policy if exists consent_grant_read_patient_or_provider on public.consent_grants;
create policy consent_grant_read_patient_or_provider on public.consent_grants
  for select to authenticated using (
    patient_user_id = (select auth.uid()) or provider_user_id = (select auth.uid())
  );

-- Medical records are directly readable only by their owner. Providers must use
-- get_consented_records(), which checks active, unexpired consent and audits access.
drop policy if exists health_record_read_patient_only on public.health_records;
create policy health_record_read_patient_only on public.health_records
  for select to authenticated using (patient_user_id = (select auth.uid()));
drop policy if exists health_record_insert_patient_reported on public.health_records;
create policy health_record_insert_patient_reported on public.health_records
  for insert to authenticated with check (
    patient_user_id = (select auth.uid())
    and recorded_by = (select auth.uid())
    and source_type = 'PATIENT_REPORTED'
    and verification_status = 'UNVERIFIED'
  );
drop policy if exists health_record_update_patient_reported on public.health_records;
create policy health_record_update_patient_reported on public.health_records
  for update to authenticated using (
    patient_user_id = (select auth.uid()) and source_type = 'PATIENT_REPORTED'
  ) with check (
    patient_user_id = (select auth.uid())
    and recorded_by = (select auth.uid())
    and source_type = 'PATIENT_REPORTED'
    and verification_status = 'UNVERIFIED'
  );
drop policy if exists health_record_delete_patient_reported on public.health_records;
create policy health_record_delete_patient_reported on public.health_records
  for delete to authenticated using (
    patient_user_id = (select auth.uid()) and source_type = 'PATIENT_REPORTED'
  );

drop policy if exists audit_event_read_patient_or_actor on public.audit_events;
create policy audit_event_read_patient_or_actor on public.audit_events
  for select to authenticated using (
    patient_user_id = (select auth.uid()) or actor_user_id = (select auth.uid())
  );

create or replace function public.request_patient_access(
  p_patient_user_id uuid,
  p_purpose text,
  p_categories text[],
  p_duration_hours integer default 24
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
  v_categories text[] := array[
    'Cardiac Care', 'Diabetes & Metabolic Health', 'Respiratory Health',
    'Neurological Health', 'Kidney Health', 'Allergies',
    'Medications & Prescriptions', 'Laboratory Reports', 'Surgeries & Procedures',
    'Vaccinations', 'Consultation History', 'General Medical History', 'Other Medical Records'
  ];
begin
  if auth.uid() is null or not exists (
    select 1 from public.verified_providers p
    where p.user_id = auth.uid() and p.active
  ) then
    raise exception 'Verified provider account required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.patient_profiles p where p.user_id = p_patient_user_id) then
    raise exception 'Patient not found' using errcode = 'P0002';
  end if;
  if p_categories is null or cardinality(p_categories) = 0
    or not (p_categories <@ v_categories)
    or p_duration_hours is null or p_duration_hours < 1 or p_duration_hours > 168
    or length(trim(coalesce(p_purpose, ''))) not between 3 and 500 then
    raise exception 'Invalid request details' using errcode = '22023';
  end if;

  insert into public.consent_requests (
    patient_user_id, provider_user_id, purpose, requested_categories, requested_duration_hours
  ) values (
    p_patient_user_id, auth.uid(), trim(p_purpose), p_categories, p_duration_hours
  ) returning id into v_request_id;

  insert into public.audit_events (
    patient_user_id, actor_user_id, recipient_user_id, event_type, categories
  ) values (p_patient_user_id, auth.uid(), p_patient_user_id, 'ACCESS_REQUESTED', p_categories);
  return v_request_id;
end;
$$;

create or replace function public.decide_patient_access(
  p_request_id uuid,
  p_decision text,
  p_categories text[] default null,
  p_duration_hours integer default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.consent_requests%rowtype;
  v_grant_id uuid;
  v_categories text[];
begin
  select * into v_request from public.consent_requests
  where id = p_request_id for update;
  if not found or v_request.patient_user_id <> auth.uid() then
    raise exception 'Consent request not found' using errcode = '42501';
  end if;
  if v_request.status <> 'PENDING' then
    raise exception 'Consent request has already been decided' using errcode = '22023';
  end if;
  if p_decision is null or p_decision not in ('APPROVED', 'REJECTED') then
    raise exception 'Invalid consent decision' using errcode = '22023';
  end if;

  if p_decision = 'APPROVED' then
    v_categories := coalesce(p_categories, v_request.requested_categories);
    if cardinality(v_categories) = 0 or not (v_categories <@ v_request.requested_categories)
      or p_duration_hours is null or p_duration_hours < 1 or p_duration_hours > 168 then
      raise exception 'Choose requested categories and an expiry between 1 and 168 hours' using errcode = '22023';
    end if;
    insert into public.consent_grants (
      request_id, patient_user_id, provider_user_id, purpose, granted_categories, expires_at
    ) values (
      v_request.id, v_request.patient_user_id, v_request.provider_user_id,
      v_request.purpose, v_categories, now() + make_interval(hours => p_duration_hours)
    ) returning id into v_grant_id;
    update public.consent_requests set status = 'APPROVED', decided_at = now() where id = v_request.id;
    insert into public.audit_events (
      patient_user_id, actor_user_id, recipient_user_id, grant_id, event_type, categories
    ) values (v_request.patient_user_id, auth.uid(), v_request.provider_user_id,
      v_grant_id, 'CONSENT_APPROVED', v_categories);
    return v_grant_id;
  end if;

  update public.consent_requests set status = 'REJECTED', decided_at = now() where id = v_request.id;
  insert into public.audit_events (
    patient_user_id, actor_user_id, recipient_user_id, event_type, categories
  ) values (v_request.patient_user_id, auth.uid(), v_request.provider_user_id,
    'CONSENT_REJECTED', v_request.requested_categories);
  return null;
end;
$$;

create or replace function public.revoke_patient_access(p_grant_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant public.consent_grants%rowtype;
begin
  select * into v_grant from public.consent_grants
  where id = p_grant_id for update;
  if not found or v_grant.patient_user_id <> auth.uid() then
    raise exception 'Consent grant not found' using errcode = '42501';
  end if;
  if v_grant.status <> 'ACTIVE' then return false; end if;

  update public.consent_grants set status = 'REVOKED', revoked_at = now() where id = v_grant.id;
  insert into public.audit_events (
    patient_user_id, actor_user_id, recipient_user_id, grant_id, event_type, categories
  ) values (v_grant.patient_user_id, auth.uid(), v_grant.provider_user_id,
    v_grant.id, 'CONSENT_REVOKED', v_grant.granted_categories);
  return true;
end;
$$;

create or replace function public.get_consented_records(p_patient_user_id uuid)
returns setof public.health_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant public.consent_grants%rowtype;
begin
  select g.* into v_grant from public.consent_grants g
  join public.verified_providers p on p.user_id = g.provider_user_id and p.active
  where g.patient_user_id = p_patient_user_id
    and g.provider_user_id = auth.uid()
    and g.status = 'ACTIVE'
    and g.expires_at > now()
  order by g.granted_at desc limit 1;
  if not found then
    raise exception 'Active patient consent is required' using errcode = '42501';
  end if;

  insert into public.audit_events (
    patient_user_id, actor_user_id, recipient_user_id, grant_id, event_type, categories
  ) values (p_patient_user_id, auth.uid(), p_patient_user_id,
    v_grant.id, 'RECORDS_VIEWED', v_grant.granted_categories);

  return query
    select r.* from public.health_records r
    where r.patient_user_id = p_patient_user_id
      and r.category = any(v_grant.granted_categories)
    order by r.record_date desc nulls last, r.created_at desc;
end;
$$;

revoke all on function public.request_patient_access(uuid, text, text[], integer) from public, anon;
revoke all on function public.decide_patient_access(uuid, text, text[], integer) from public, anon;
revoke all on function public.revoke_patient_access(uuid) from public, anon;
revoke all on function public.get_consented_records(uuid) from public, anon;
grant execute on function public.request_patient_access(uuid, text, text[], integer) to authenticated;
grant execute on function public.decide_patient_access(uuid, text, text[], integer) to authenticated;
grant execute on function public.revoke_patient_access(uuid) to authenticated;
grant execute on function public.get_consented_records(uuid) to authenticated;

-- >>> END OF MIGRATION: 202610150001_healthpass_core.sql <<<

-- >>> START OF MIGRATION: 202610150002_pharmacist_prescription_consent.sql <<<

-- Additive pharmacist access support. Depends on 202610150001_healthpass_core.sql.
-- Applying this migration does not verify or activate any pharmacist.

alter table public.verified_providers
  add column if not exists provider_type text not null default 'DOCTOR';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'verified_providers_provider_type_check'
      and conrelid = 'public.verified_providers'::regclass
  ) then
    alter table public.verified_providers
      add constraint verified_providers_provider_type_check
      check (provider_type in ('DOCTOR', 'PHARMACIST'));
  end if;
end;
$$;

create table if not exists public.pharmacist_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  applicant_name text not null check (length(trim(applicant_name)) between 1 and 200),
  professional_license text not null check (length(trim(professional_license)) between 1 and 100),
  facility_name text not null check (length(trim(facility_name)) between 1 and 200),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (user_id, professional_license)
);

create table if not exists public.prescription_records (
  id uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  prescribing_provider_user_id uuid references public.verified_providers(user_id) on delete set null,
  prescribing_clinician text not null default '',
  prescription_date date,
  valid_until date,
  status text not null check (status in ('ACTIVE', 'EXPIRED', 'CANCELLED', 'DISCONTINUED')),
  medication_name text not null check (length(trim(medication_name)) between 1 and 200),
  strength text not null default '',
  dosage text not null default '',
  route text not null default '',
  frequency text not null default '',
  duration text not null default '',
  instructions text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prescription_records_validity_check check (
    valid_until is null or prescription_date is null or valid_until >= prescription_date
  )
);

create index if not exists prescription_records_patient_date_idx
  on public.prescription_records (patient_user_id, prescription_date desc);
create index if not exists pharmacist_applications_user_status_idx
  on public.pharmacist_applications (user_id, status, submitted_at desc);

alter table public.pharmacist_applications enable row level security;
alter table public.prescription_records enable row level security;

revoke all on public.pharmacist_applications, public.prescription_records from anon, authenticated;
grant select, insert on public.pharmacist_applications to authenticated;
grant select on public.prescription_records to authenticated;

drop policy if exists pharmacist_application_read_own on public.pharmacist_applications;
create policy pharmacist_application_read_own on public.pharmacist_applications
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists pharmacist_application_submit_own on public.pharmacist_applications;
create policy pharmacist_application_submit_own on public.pharmacist_applications
  for insert to authenticated with check (
    user_id = (select auth.uid()) and status = 'PENDING' and reviewed_at is null
  );
drop policy if exists prescription_record_read_patient_only on public.prescription_records;
create policy prescription_record_read_patient_only on public.prescription_records
  for select to authenticated using (patient_user_id = (select auth.uid()));

-- Keep the existing generic provider request path for verified doctors only.
create or replace function public.request_patient_access(
  p_patient_user_id uuid,
  p_purpose text,
  p_categories text[],
  p_duration_hours integer default 24
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
  v_categories text[] := array[
    'Cardiac Care', 'Diabetes & Metabolic Health', 'Respiratory Health',
    'Neurological Health', 'Kidney Health', 'Allergies',
    'Medications & Prescriptions', 'Laboratory Reports', 'Surgeries & Procedures',
    'Vaccinations', 'Consultation History', 'General Medical History', 'Other Medical Records'
  ];
begin
  if auth.uid() is null or not exists (
    select 1 from public.verified_providers p
    where p.user_id = auth.uid() and p.active and p.provider_type = 'DOCTOR'
  ) then
    raise exception 'Verified doctor account required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.patient_profiles p where p.user_id = p_patient_user_id) then
    raise exception 'Patient not found' using errcode = 'P0002';
  end if;
  if p_categories is null or cardinality(p_categories) = 0
    or not (p_categories <@ v_categories)
    or p_duration_hours is null or p_duration_hours < 1 or p_duration_hours > 168
    or length(trim(coalesce(p_purpose, ''))) not between 3 and 500 then
    raise exception 'Invalid request details' using errcode = '22023';
  end if;

  insert into public.consent_requests (
    patient_user_id, provider_user_id, purpose, requested_categories, requested_duration_hours
  ) values (p_patient_user_id, auth.uid(), trim(p_purpose), p_categories, p_duration_hours)
  returning id into v_request_id;
  insert into public.audit_events (
    patient_user_id, actor_user_id, recipient_user_id, event_type, categories
  ) values (p_patient_user_id, auth.uid(), p_patient_user_id, 'ACCESS_REQUESTED', p_categories);
  return v_request_id;
end;
$$;

create or replace function public.request_pharmacist_prescription_access(
  p_healthpass_id text,
  p_duration_hours integer default 24
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_user_id uuid;
  v_request_id uuid;
  v_category constant text := 'Medications & Prescriptions';
begin
  if auth.uid() is null or not exists (
    select 1 from public.verified_providers p
    where p.user_id = auth.uid() and p.active and p.provider_type = 'PHARMACIST'
  ) then
    raise exception 'Verified pharmacist account required' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_healthpass_id, ''))) not between 1 and 100
    or p_duration_hours is null or p_duration_hours < 1 or p_duration_hours > 168 then
    raise exception 'Invalid patient ID or access duration' using errcode = '22023';
  end if;
  select p.user_id into v_patient_user_id from public.patient_profiles p
    where upper(trim(p.healthpass_id)) = upper(trim(p_healthpass_id));
  if v_patient_user_id is null then
    raise exception 'Patient not found' using errcode = 'P0002';
  end if;

  insert into public.consent_requests (
    patient_user_id, provider_user_id, purpose, requested_categories, requested_duration_hours
  ) values (
    v_patient_user_id, auth.uid(), 'Prescription review for dispensing', array[v_category], p_duration_hours
  ) returning id into v_request_id;
  insert into public.audit_events (
    patient_user_id, actor_user_id, recipient_user_id, event_type, categories
  ) values (v_patient_user_id, auth.uid(), v_patient_user_id, 'ACCESS_REQUESTED', array[v_category]);
  return v_request_id;
end;
$$;

-- Do not let pharmacist accounts use the broader doctor records RPC.
create or replace function public.get_consented_records(p_patient_user_id uuid)
returns setof public.health_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant public.consent_grants%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1 from public.verified_providers p
    where p.user_id = auth.uid() and p.active and p.provider_type = 'DOCTOR'
  ) then
    raise exception 'Verified doctor account required' using errcode = '42501';
  end if;
  select g.* into v_grant from public.consent_grants g
  join public.verified_providers p on p.user_id = g.provider_user_id and p.active
  where g.patient_user_id = p_patient_user_id and g.provider_user_id = auth.uid()
    and g.status = 'ACTIVE' and g.expires_at > now()
  order by g.granted_at desc limit 1;
  if not found then
    raise exception 'Active patient consent is required' using errcode = '42501';
  end if;

  insert into public.audit_events (
    patient_user_id, actor_user_id, recipient_user_id, grant_id, event_type, categories
  ) values (p_patient_user_id, auth.uid(), p_patient_user_id,
    v_grant.id, 'RECORDS_VIEWED', v_grant.granted_categories);
  return query
    select r.* from public.health_records r
    where r.patient_user_id = p_patient_user_id
      and r.category = any(v_grant.granted_categories)
    order by r.record_date desc nulls last, r.created_at desc;
end;
$$;

create or replace function public.get_consented_prescriptions(p_patient_user_id uuid)
returns setof public.prescription_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant public.consent_grants%rowtype;
  v_category constant text := 'Medications & Prescriptions';
begin
  if auth.uid() is null or not exists (
    select 1 from public.verified_providers p
    where p.user_id = auth.uid() and p.active and p.provider_type = 'PHARMACIST'
  ) then
    raise exception 'Verified pharmacist account required' using errcode = '42501';
  end if;
  select g.* into v_grant from public.consent_grants g
  where g.patient_user_id = p_patient_user_id and g.provider_user_id = auth.uid()
    and g.status = 'ACTIVE' and g.expires_at > now()
    and g.granted_categories = array[v_category]
  order by g.granted_at desc limit 1;
  if not found then
    raise exception 'Active prescription consent is required' using errcode = '42501';
  end if;

  insert into public.audit_events (
    patient_user_id, actor_user_id, recipient_user_id, grant_id, event_type, categories
  ) values (p_patient_user_id, auth.uid(), p_patient_user_id,
    v_grant.id, 'RECORDS_VIEWED', array[v_category]);
  return query
    select rx.* from public.prescription_records rx
    where rx.patient_user_id = p_patient_user_id
    order by rx.prescription_date desc nulls last, rx.created_at desc;
end;
$$;

revoke all on function public.request_patient_access(uuid, text, text[], integer) from public, anon;
revoke all on function public.request_pharmacist_prescription_access(text, integer) from public, anon;
revoke all on function public.get_consented_records(uuid) from public, anon;
revoke all on function public.get_consented_prescriptions(uuid) from public, anon;
grant execute on function public.request_patient_access(uuid, text, text[], integer) to authenticated;
grant execute on function public.request_pharmacist_prescription_access(text, integer) to authenticated;
grant execute on function public.get_consented_records(uuid) to authenticated;
grant execute on function public.get_consented_prescriptions(uuid) to authenticated;

-- >>> END OF MIGRATION: 202610150002_pharmacist_prescription_consent.sql <<<

-- >>> START OF MIGRATION: 202610150003_healthpass_runtime_support.sql <<<

-- Additive runtime support for the existing HealthPass schema.
-- Apply only after reviewing in a disposable Supabase project. This migration
-- does not seed demo users, verify providers, or remove existing records.

alter table public.verified_providers alter column application_id drop not null;
alter table public.verified_providers
  add column if not exists pharmacist_application_id uuid references public.pharmacist_applications(id),
  add column if not exists lab_application_id uuid;

alter table public.verified_providers drop constraint if exists verified_providers_provider_type_check;
alter table public.verified_providers add constraint verified_providers_provider_type_check
  check (provider_type in ('DOCTOR', 'PHARMACIST', 'LAB'));

create table if not exists public.lab_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  applicant_name text not null check (length(trim(applicant_name)) between 1 and 200),
  facility_name text not null check (length(trim(facility_name)) between 1 and 200),
  facility_type text not null default 'Diagnostic Laboratory',
  facility_level text not null default 'DISTRICT',
  professional_id text not null check (length(trim(professional_id)) between 1 and 100),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (user_id, professional_id)
);
alter table public.verified_providers drop constraint if exists verified_providers_lab_application_id_fkey;
alter table public.verified_providers add constraint verified_providers_lab_application_id_fkey
  foreign key (lab_application_id) references public.lab_applications(id);
alter table public.lab_applications enable row level security;
revoke all on public.lab_applications from anon, authenticated;
grant select, insert on public.lab_applications to authenticated;
drop policy if exists lab_application_read_own on public.lab_applications;
create policy lab_application_read_own on public.lab_applications
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists lab_application_submit_own on public.lab_applications;
create policy lab_application_submit_own on public.lab_applications
  for insert to authenticated with check (
    user_id = (select auth.uid()) and status = 'PENDING' and reviewed_at is null
  );

alter table public.health_records
  add column if not exists record_payload jsonb not null default '{}'::jsonb,
  add column if not exists uploader_role text not null default 'patient'
    check (uploader_role in ('patient', 'doctor', 'lab'));

alter table public.prescription_records
  add column if not exists prescription_group_id uuid not null default gen_random_uuid(),
  add column if not exists formulation text not null default '';
create index if not exists prescription_records_patient_active_medication_idx
  on public.prescription_records (patient_user_id, lower(trim(medication_name)), status, valid_until);

-- New signups may create patient profiles and unverified provider applications.
-- User-supplied metadata can never create a verified provider row.
create or replace function public.bootstrap_healthpass_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text := upper(coalesce(new.raw_user_meta_data ->> 'account_type', ''));
  v_name text := left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 200);
  v_facility text := left(trim(coalesce(new.raw_user_meta_data ->> 'facility_name', '')), 200);
  v_professional_id text := left(trim(coalesce(new.raw_user_meta_data ->> 'professional_id', '')), 100);
  v_facility_type text := left(trim(coalesce(new.raw_user_meta_data ->> 'facility_type', 'Clinic')), 100);
  v_facility_level text := left(trim(coalesce(new.raw_user_meta_data ->> 'facility_level', 'VILLAGE')), 40);
begin
  if v_kind = 'PATIENT' then
    insert into public.patient_profiles (user_id, display_name)
    values (new.id, v_name);
  elsif v_kind = 'DOCTOR' and v_name <> '' and v_facility <> '' and v_professional_id <> '' then
    insert into public.doctor_applications
      (user_id, applicant_name, facility_name, facility_type, facility_level, professional_id)
    values (new.id, v_name, v_facility, v_facility_type, v_facility_level, v_professional_id);
  elsif v_kind = 'PHARMACIST' and v_name <> '' and v_facility <> '' and v_professional_id <> '' then
    insert into public.pharmacist_applications
      (user_id, applicant_name, professional_license, facility_name)
    values (new.id, v_name, v_professional_id, v_facility);
  elsif v_kind = 'LAB' and v_name <> '' and v_facility <> '' and v_professional_id <> '' then
    insert into public.lab_applications
      (user_id, applicant_name, facility_name, facility_type, facility_level, professional_id)
    values (new.id, v_name, v_facility, v_facility_type, v_facility_level, v_professional_id);
  end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_healthpass on auth.users;
create trigger on_auth_user_created_healthpass after insert on auth.users for each row execute function public.bootstrap_healthpass_auth_user();
revoke all on function public.bootstrap_healthpass_auth_user() from public, anon, authenticated;

create or replace function public.lookup_patient_identity(p_healthpass_id text)
returns table (patient_user_id uuid, display_name text, healthpass_id text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.verified_providers p
    where p.user_id = auth.uid() and p.active
      and p.provider_type in ('DOCTOR', 'PHARMACIST', 'LAB')
  ) then
    raise exception 'Active verified provider account required' using errcode = '42501';
  end if;
  return query select patient.user_id, patient.display_name, patient.healthpass_id
    from public.patient_profiles patient
    where upper(trim(patient.healthpass_id)) = upper(trim(coalesce(p_healthpass_id, '')))
    limit 1;
end;
$$;

create or replace function public.request_lab_report_access(
  p_healthpass_id text,
  p_duration_hours integer default 24
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_user_id uuid;
  v_request_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.verified_providers p
    where p.user_id = auth.uid() and p.active and p.provider_type = 'LAB'
  ) then
    raise exception 'Active verified diagnostic laboratory account required' using errcode = '42501';
  end if;
  if p_duration_hours is null or p_duration_hours < 1 or p_duration_hours > 168 then
    raise exception 'Access duration must be between 1 and 168 hours' using errcode = '22023';
  end if;
  select patient.user_id into v_patient_user_id from public.patient_profiles patient
    where upper(trim(patient.healthpass_id)) = upper(trim(coalesce(p_healthpass_id, '')));
  if v_patient_user_id is null then
    raise exception 'Patient not found' using errcode = 'P0002';
  end if;
  insert into public.consent_requests
    (patient_user_id, provider_user_id, purpose, requested_categories, requested_duration_hours)
  values
    (v_patient_user_id, auth.uid(), 'Upload laboratory test results to the patient HealthPass', array['Laboratory Reports'], p_duration_hours)
  returning id into v_request_id;
  insert into public.audit_events
    (patient_user_id, actor_user_id, recipient_user_id, event_type, categories)
  values (v_patient_user_id, auth.uid(), v_patient_user_id, 'ACCESS_REQUESTED', array['Laboratory Reports']);
  return v_request_id;
end;
$$;

create or replace function public.get_consented_patient_profile(p_patient_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant public.consent_grants%rowtype;
  v_profile public.patient_profiles%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1 from public.verified_providers p
    where p.user_id = auth.uid() and p.active and p.provider_type = 'DOCTOR'
  ) then
    raise exception 'Active verified doctor account required' using errcode = '42501';
  end if;
  select g.* into v_grant from public.consent_grants g
    where g.patient_user_id = p_patient_user_id and g.provider_user_id = auth.uid()
      and g.status = 'ACTIVE' and g.expires_at > now()
    order by g.granted_at desc limit 1;
  if not found then raise exception 'Active patient consent is required' using errcode = '42501'; end if;
  select * into v_profile from public.patient_profiles where user_id = p_patient_user_id;
  return jsonb_build_object(
    'patientId', v_profile.user_id,
    'name', v_profile.display_name,
    'healthPassId', v_profile.healthpass_id,
    'bloodGroup', case when 'General Medical History' = any(v_grant.granted_categories) then v_profile.blood_group end,
    'knownAllergies', case when 'Allergies' = any(v_grant.granted_categories) then v_profile.known_allergies end,
    'currentMedications', case when 'Medications & Prescriptions' = any(v_grant.granted_categories) then v_profile.current_medications end,
    'healthConditions', case when 'General Medical History' = any(v_grant.granted_categories) then v_profile.medical_conditions end,
    'pastSurgeries', case when 'Surgeries & Procedures' = any(v_grant.granted_categories) then v_profile.past_surgeries end,
    'verificationStatus', 'PATIENT_REPORTED', 'updatedAt', v_profile.updated_at
  );
end;
$$;

create or replace function public.create_patient_health_record(
  p_category text, p_title text, p_summary text default '', p_record_date date default null,
  p_record_payload jsonb default '{}'::jsonb, p_storage_path text default null
) returns public.health_records
language plpgsql
security definer
set search_path = ''
as $$
declare v_record public.health_records%rowtype;
begin
  if auth.uid() is null or not exists (select 1 from public.patient_profiles p where p.user_id = auth.uid()) then
    raise exception 'Patient account required' using errcode = '42501';
  end if;
  if p_storage_path is not null and (split_part(p_storage_path, '/', 1) <> 'healthpass-private' or split_part(p_storage_path, '/', 2) <> auth.uid()::text) then
    raise exception 'Patient document path must belong to the signed-in patient' using errcode = '42501';
  end if;
  insert into public.health_records
    (patient_user_id, category, title, summary, record_date, source_type, verification_status, recorded_by, storage_path, record_payload, uploader_role)
  values
    (auth.uid(), p_category, trim(p_title), coalesce(p_summary, ''), p_record_date, 'PATIENT_REPORTED', 'UNVERIFIED', auth.uid(), p_storage_path, coalesce(p_record_payload, '{}'::jsonb), 'patient')
  returning * into v_record;
  return v_record;
end;
$$;

create or replace function public.create_provider_health_record(
  p_patient_user_id uuid, p_category text, p_title text, p_summary text default '',
  p_record_date date default null, p_record_payload jsonb default '{}'::jsonb, p_storage_path text default null
) returns public.health_records
language plpgsql
security definer
set search_path = ''
as $$
declare v_grant public.consent_grants%rowtype; v_record public.health_records%rowtype;
begin
  if auth.uid() is null or not exists (select 1 from public.verified_providers p where p.user_id = auth.uid() and p.active and p.provider_type = 'DOCTOR') then
    raise exception 'Active verified doctor account required' using errcode = '42501';
  end if;
  select * into v_grant from public.consent_grants g where g.patient_user_id = p_patient_user_id and g.provider_user_id = auth.uid() and g.status = 'ACTIVE' and g.expires_at > now() order by g.granted_at desc limit 1;
  if not found or not (p_category = any(v_grant.granted_categories)) then
    raise exception 'Active consent for this record category is required' using errcode = '42501';
  end if;
  if p_storage_path is not null and (split_part(p_storage_path, '/', 1) <> 'healthpass-private' or split_part(p_storage_path, '/', 2) <> p_patient_user_id::text or split_part(p_storage_path, '/', 3) = '') then
    raise exception 'Invalid private patient document path' using errcode = '22023';
  end if;
  insert into public.health_records
    (patient_user_id, category, title, summary, record_date, source_type, verification_status, recorded_by, storage_path, record_payload, uploader_role)
  values (p_patient_user_id, p_category, trim(p_title), coalesce(p_summary, ''), p_record_date, 'CLINICIAN_RECORDED', 'UNVERIFIED', auth.uid(), p_storage_path, coalesce(p_record_payload, '{}'::jsonb), 'doctor')
  returning * into v_record;
  insert into public.audit_events (patient_user_id, actor_user_id, recipient_user_id, grant_id, event_type, categories)
    values (p_patient_user_id, auth.uid(), p_patient_user_id, v_grant.id, 'RECORDS_VIEWED', array[p_category]);
  return v_record;
end;
$$;

create or replace function public.create_lab_health_record(
  p_patient_user_id uuid, p_title text, p_summary text, p_record_date date default null,
  p_record_payload jsonb default '{}'::jsonb, p_storage_path text default null
) returns public.health_records
language plpgsql
security definer
set search_path = ''
as $$
declare v_grant public.consent_grants%rowtype; v_record public.health_records%rowtype;
begin
  if auth.uid() is null or not exists (select 1 from public.verified_providers p where p.user_id = auth.uid() and p.active and p.provider_type = 'LAB') then
    raise exception 'Active verified diagnostic laboratory account required' using errcode = '42501';
  end if;
  select * into v_grant from public.consent_grants g where g.patient_user_id = p_patient_user_id and g.provider_user_id = auth.uid() and g.status = 'ACTIVE' and g.expires_at > now() and g.granted_categories = array['Laboratory Reports'] order by g.granted_at desc limit 1;
  if not found then raise exception 'Active laboratory report consent is required' using errcode = '42501'; end if;
  if p_storage_path is not null and (split_part(p_storage_path, '/', 1) <> 'healthpass-private' or split_part(p_storage_path, '/', 2) <> p_patient_user_id::text or split_part(p_storage_path, '/', 3) = '') then
    raise exception 'Invalid private patient document path' using errcode = '22023';
  end if;
  insert into public.health_records
    (patient_user_id, category, title, summary, record_date, source_type, verification_status, recorded_by, storage_path, record_payload, uploader_role)
  values (p_patient_user_id, 'Laboratory Reports', trim(p_title), coalesce(p_summary, ''), p_record_date, 'CLINICIAN_RECORDED', 'UNVERIFIED', auth.uid(), p_storage_path, coalesce(p_record_payload, '{}'::jsonb), 'lab')
  returning * into v_record;
  insert into public.audit_events (patient_user_id, actor_user_id, recipient_user_id, grant_id, event_type, categories)
    values (p_patient_user_id, auth.uid(), p_patient_user_id, v_grant.id, 'RECORDS_VIEWED', array['Laboratory Reports']);
  return v_record;
end;
$$;

create or replace function public.extend_patient_access(p_grant_id uuid, p_extra_hours integer default 24)
returns public.consent_grants
language plpgsql
security definer
set search_path = ''
as $$
declare v_grant public.consent_grants%rowtype;
begin
  select * into v_grant from public.consent_grants where id = p_grant_id for update;
  if not found or v_grant.patient_user_id <> auth.uid() then raise exception 'Consent grant not found' using errcode = '42501'; end if;
  if v_grant.status <> 'ACTIVE' or v_grant.expires_at <= now() then raise exception 'Only active consent can be extended' using errcode = '22023'; end if;
  if p_extra_hours is null or p_extra_hours < 1 or p_extra_hours > 168 then raise exception 'Extension must be between 1 and 168 hours' using errcode = '22023'; end if;
  update public.consent_grants set expires_at = greatest(expires_at, now()) + make_interval(hours => p_extra_hours) where id = p_grant_id returning * into v_grant;
  return v_grant;
end;
$$;

create or replace function public.record_consultation_with_prescriptions(
  p_patient_user_id uuid, p_chief_complaint text, p_diagnosis text, p_clinical_notes text, p_medicines jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant public.consent_grants%rowtype;
  v_visit public.health_records%rowtype;
  v_group_id uuid := gen_random_uuid();
  v_item jsonb;
  v_duplicate public.prescription_records%rowtype;
  v_internal_duplicate boolean;
begin
  if auth.uid() is null or not exists (select 1 from public.verified_providers p where p.user_id = auth.uid() and p.active and p.provider_type = 'DOCTOR') then
    raise exception 'Active verified doctor account required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_patient_user_id::text, 0));
  select * into v_grant from public.consent_grants g where g.patient_user_id = p_patient_user_id and g.provider_user_id = auth.uid() and g.status = 'ACTIVE' and g.expires_at > now() order by g.granted_at desc limit 1;
  if not found or not ('Consultation History' = any(v_grant.granted_categories)) then raise exception 'Active consultation consent is required' using errcode = '42501'; end if;
  if jsonb_typeof(coalesce(p_medicines, '[]'::jsonb)) <> 'array' then raise exception 'Medicine list must be an array' using errcode = '22023'; end if;
  if jsonb_array_length(coalesce(p_medicines, '[]'::jsonb)) > 0 and not ('Medications & Prescriptions' = any(v_grant.granted_categories)) then raise exception 'Prescription consent is also required' using errcode = '42501'; end if;
  for v_item in select value from jsonb_array_elements(coalesce(p_medicines, '[]'::jsonb)) loop
    if length(trim(coalesce(v_item->>'name', ''))) not between 1 and 200 or length(trim(coalesce(v_item->>'strength', ''))) not between 1 and 100 or length(trim(coalesce(v_item->>'dosage', ''))) not between 1 and 200 or length(trim(coalesce(v_item->>'route', ''))) not between 1 and 100 then raise exception 'Medication name, strength, dosage, and route are required' using errcode = '22023'; end if;
    select * into v_duplicate from public.prescription_records r
      where r.patient_user_id = p_patient_user_id and r.status = 'ACTIVE'
        and (r.valid_until is null or r.valid_until >= current_date)
        and lower(trim(r.medication_name)) = lower(trim(v_item->>'name'))
        and lower(trim(r.strength)) = lower(trim(v_item->>'strength'))
        and lower(trim(r.dosage)) = lower(trim(v_item->>'dosage'))
        and lower(trim(r.route)) = lower(trim(v_item->>'route'))
        and lower(trim(r.frequency)) = lower(trim(coalesce(v_item->>'frequencyLabel', v_item->>'frequency', '')))
        and lower(trim(r.formulation)) = lower(trim(coalesce(v_item->>'formulation', '')))
        and lower(trim(r.duration)) = lower(trim(coalesce(v_item->>'duration', '')))
        and lower(trim(r.instructions)) = lower(trim(concat_ws(' · ', nullif(v_item->>'instructions', ''), nullif(v_item->>'notes', ''), nullif(v_item->>'foodInstruction', ''))))
      order by r.created_at desc limit 1;
    if found then
      insert into public.health_records (patient_user_id, category, title, summary, source_type, verification_status, recorded_by, uploader_role, record_payload)
      values (p_patient_user_id, 'Consultation History', left(coalesce(nullif(trim(p_diagnosis), ''), 'Consultation'), 300), coalesce(p_clinical_notes, ''), 'CLINICIAN_RECORDED', 'UNVERIFIED', auth.uid(), 'doctor', jsonb_build_object('chiefComplaint', coalesce(p_chief_complaint, '')))
      returning * into v_visit;
      return jsonb_build_object('success', true, 'consultationRecorded', true, 'visit', to_jsonb(v_visit), 'prescription', null,
        'prescriptionWarning', jsonb_build_object('code', 'ACTIVE_PRESCRIPTION_DUPLICATE', 'error', 'An active prescription for this medication already exists. Review the existing prescription before creating another.', 'existingPrescriptionId', v_duplicate.prescription_group_id, 'existingPrescription', to_jsonb(v_duplicate)));
    end if;
  end loop;
  select exists (
    select 1
    from jsonb_array_elements(coalesce(p_medicines, '[]'::jsonb)) with ordinality a(value, idx)
    join jsonb_array_elements(coalesce(p_medicines, '[]'::jsonb)) with ordinality b(value, idx) on a.idx < b.idx
    where lower(trim(a.value->>'name')) = lower(trim(b.value->>'name'))
      and lower(trim(a.value->>'strength')) = lower(trim(b.value->>'strength'))
      and lower(trim(a.value->>'dosage')) = lower(trim(b.value->>'dosage'))
      and lower(trim(a.value->>'route')) = lower(trim(b.value->>'route'))
      and lower(trim(coalesce(a.value->>'frequencyLabel', a.value->>'frequency', ''))) = lower(trim(coalesce(b.value->>'frequencyLabel', b.value->>'frequency', '')))
      and lower(trim(coalesce(a.value->>'formulation', ''))) = lower(trim(coalesce(b.value->>'formulation', '')))
      and lower(trim(coalesce(a.value->>'duration', ''))) = lower(trim(coalesce(b.value->>'duration', '')))
      and lower(trim(concat_ws(' · ', nullif(a.value->>'instructions', ''), nullif(a.value->>'notes', ''), nullif(a.value->>'foodInstruction', ''))))
        = lower(trim(concat_ws(' · ', nullif(b.value->>'instructions', ''), nullif(b.value->>'notes', ''), nullif(b.value->>'foodInstruction', ''))))
  ) into v_internal_duplicate;
  if v_internal_duplicate then
    raise exception 'Equivalent prescriptions cannot be duplicated in one consultation' using errcode = '23505';
  end if;
  insert into public.health_records (patient_user_id, category, title, summary, source_type, verification_status, recorded_by, uploader_role, record_payload)
  values (p_patient_user_id, 'Consultation History', left(coalesce(nullif(trim(p_diagnosis), ''), 'Consultation'), 300), coalesce(p_clinical_notes, ''), 'CLINICIAN_RECORDED', 'UNVERIFIED', auth.uid(), 'doctor', jsonb_build_object('chiefComplaint', coalesce(p_chief_complaint, '')))
  returning * into v_visit;
  for v_item in select value from jsonb_array_elements(coalesce(p_medicines, '[]'::jsonb)) loop
    insert into public.prescription_records (prescription_group_id, patient_user_id, prescribing_provider_user_id, prescribing_clinician, prescription_date, valid_until, status, medication_name, strength, dosage, route, frequency, duration, instructions, formulation)
    values (v_group_id, p_patient_user_id, auth.uid(), coalesce((select provider_name from public.verified_providers where user_id = auth.uid()), ''), current_date,
      nullif(v_item->>'validUntil', '')::date, 'ACTIVE', trim(v_item->>'name'), trim(v_item->>'strength'), trim(v_item->>'dosage'), trim(v_item->>'route'),
      coalesce(v_item->>'frequencyLabel', v_item->>'frequency', ''), coalesce(v_item->>'duration', ''),
      concat_ws(' · ', nullif(v_item->>'instructions', ''), nullif(v_item->>'notes', ''), nullif(v_item->>'foodInstruction', '')), coalesce(v_item->>'formulation', ''));
  end loop;
  return jsonb_build_object('success', true, 'consultationRecorded', true, 'visit', to_jsonb(v_visit), 'prescriptionGroupId', case when jsonb_array_length(coalesce(p_medicines, '[]'::jsonb)) > 0 then v_group_id else null end);
end;
$$;

create or replace function public.get_patient_consent_inbox()
returns setof jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (select 1 from public.patient_profiles p where p.user_id = auth.uid()) then
    raise exception 'Patient account required' using errcode = '42501';
  end if;
  return query
    select jsonb_build_object(
      'id', request.id, 'requestId', request.id, 'patientId', request.patient_user_id,
      'providerId', request.provider_user_id, 'doctorId', request.provider_user_id,
      'providerType', coalesce(provider.provider_type, 'DOCTOR'),
      'doctorName', provider.provider_name, 'facilityName', provider.facility_name,
      'facilityLevel', provider.facility_level, 'facilityType', provider.facility_type,
      'purpose', request.purpose, 'requestedCategories', request.requested_categories,
      'durationHours', request.requested_duration_hours, 'createdAt', request.requested_at,
      'status', case
        when request.status = 'PENDING' then 'PENDING'
        when request.status = 'REJECTED' or request.status = 'CANCELLED' then 'DENIED'
        when cg.id is null then request.status
        when cg.status = 'REVOKED' then 'REVOKED'
        when cg.expires_at <= now() then 'EXPIRED'
        else 'GRANTED'
      end,
      'grantedCategories', coalesce(cg.granted_categories, array[]::text[]),
      'expiresAt', cg.expires_at, 'grantId', cg.id
    )
    from public.consent_requests request
    left join public.verified_providers provider on provider.user_id = request.provider_user_id
    left join public.consent_grants cg on cg.request_id = request.id
    where request.patient_user_id = auth.uid()
    order by request.requested_at desc;
end;
$$;

-- The earlier pharmacist migration allowed only pharmacists to call this
-- function, which also prevented doctors from reading prescriptions they had
-- been explicitly granted. Keep pharmacist consent category-exclusive while
-- allowing verified doctors to use their category-specific grant.
create or replace function public.get_consented_prescriptions(p_patient_user_id uuid)
returns setof public.prescription_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider public.verified_providers%rowtype;
  v_grant public.consent_grants%rowtype;
  v_category constant text := 'Medications & Prescriptions';
begin
  select * into v_provider from public.verified_providers p
  where p.user_id = auth.uid() and p.active and p.provider_type in ('DOCTOR', 'PHARMACIST');
  if not found then raise exception 'Active verified provider account required' using errcode = '42501'; end if;
  select * into v_grant from public.consent_grants g
  where g.patient_user_id = p_patient_user_id and g.provider_user_id = auth.uid()
    and g.status = 'ACTIVE' and g.expires_at > now()
    and v_category = any(g.granted_categories)
    and (v_provider.provider_type <> 'PHARMACIST' or g.granted_categories = array[v_category])
  order by g.granted_at desc limit 1;
  if not found then raise exception 'Active prescription consent is required' using errcode = '42501'; end if;
  insert into public.audit_events
    (patient_user_id, actor_user_id, recipient_user_id, grant_id, event_type, categories)
  values (p_patient_user_id, auth.uid(), p_patient_user_id, v_grant.id, 'RECORDS_VIEWED', array[v_category]);
  return query select rx.* from public.prescription_records rx
    where rx.patient_user_id = p_patient_user_id
    order by rx.prescription_date desc nulls last, rx.created_at desc;
end;
$$;

-- Private report objects are scoped to the patient UUID and checked against
-- the current grant each time a provider asks Storage for the object.
insert into storage.buckets (id, name, public) values ('healthpass-private', 'healthpass-private', false)
  on conflict (id) do nothing;
do $$
begin
  if exists (select 1 from storage.buckets where id = 'healthpass-private' and public) then
    raise exception 'The healthpass-private bucket already exists as public; inspect and secure it before continuing.';
  end if;
end;
$$;
-- A report row is created first, then this function attaches a deterministic
-- private-object path. Storage policies can consequently authorize the upload
-- against the same record and its current category grant.
create or replace function public.attach_healthpass_storage_path(p_record_id uuid, p_storage_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record public.health_records%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_record from public.health_records where id = p_record_id for update;
  if not found or v_record.storage_path is not null then
    raise exception 'Report not found or storage already attached' using errcode = 'P0002';
  end if;
  if p_storage_path is null or p_storage_path !~ ('^healthpass-private/' || v_record.patient_user_id::text || '/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}$') then
    raise exception 'Invalid private report path' using errcode = '22023';
  end if;
  if v_record.patient_user_id <> auth.uid() and not (
    v_record.recorded_by = auth.uid()
    and exists (
      select 1 from public.consent_grants g
      where g.patient_user_id = v_record.patient_user_id and g.provider_user_id = auth.uid()
        and g.status = 'ACTIVE' and g.expires_at > now()
        and v_record.category = any(g.granted_categories)
        and exists (
          select 1 from public.verified_providers p
          where p.user_id = auth.uid() and p.active
            and (p.provider_type = 'DOCTOR'
              or (p.provider_type = 'LAB' and v_record.category = 'Laboratory Reports' and g.granted_categories = array['Laboratory Reports'])
              or (p.provider_type = 'PHARMACIST' and v_record.category = 'Medications & Prescriptions' and g.granted_categories = array['Medications & Prescriptions']))
        )
    )
  ) then
    raise exception 'Patient ownership or active category consent is required' using errcode = '42501';
  end if;
  update public.health_records set storage_path = p_storage_path where id = p_record_id;
end;
$$;
create or replace function public.can_read_healthpass_object(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.health_records r
    where r.storage_path = 'healthpass-private/' || p_object_name
      and (
        r.patient_user_id = auth.uid()
        or exists (
          select 1 from public.consent_grants g
          join public.verified_providers p on p.user_id = g.provider_user_id and p.active
          where g.patient_user_id = r.patient_user_id and g.provider_user_id = auth.uid()
            and g.status = 'ACTIVE' and g.expires_at > now() and r.category = any(g.granted_categories)
            and (p.provider_type = 'DOCTOR'
              or (p.provider_type = 'LAB' and r.category = 'Laboratory Reports' and g.granted_categories = array['Laboratory Reports'])
              or (p.provider_type = 'PHARMACIST' and r.category = 'Medications & Prescriptions' and g.granted_categories = array['Medications & Prescriptions']))
        )
      )
  );
$$;
create or replace function public.can_upload_healthpass_object(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.health_records r
    where r.storage_path = 'healthpass-private/' || p_object_name
      and r.recorded_by = auth.uid()
      and public.can_read_healthpass_object(p_object_name)
  );
$$;
drop policy if exists healthpass_private_upload_own_folder on storage.objects;
create policy healthpass_private_upload_own_folder on storage.objects
  for insert to authenticated with check (bucket_id = 'healthpass-private' and public.can_upload_healthpass_object(name));
drop policy if exists healthpass_private_read_authorized on storage.objects;
create policy healthpass_private_read_authorized on storage.objects
  for select to authenticated using (bucket_id = 'healthpass-private' and public.can_read_healthpass_object(name));
drop policy if exists healthpass_private_delete_own_folder on storage.objects;
create policy healthpass_private_delete_own_folder on storage.objects
  for delete to authenticated using (bucket_id = 'healthpass-private' and exists (
    select 1 from public.health_records r
    where r.storage_path = 'healthpass-private/' || name
      and r.patient_user_id = auth.uid() and r.source_type = 'PATIENT_REPORTED'
  ));

revoke all on function public.lookup_patient_identity(text) from public, anon;
revoke all on function public.request_lab_report_access(text, integer) from public, anon;
revoke all on function public.get_consented_patient_profile(uuid) from public, anon;
revoke all on function public.create_patient_health_record(text, text, text, date, jsonb, text) from public, anon;
revoke all on function public.create_provider_health_record(uuid, text, text, text, date, jsonb, text) from public, anon;
revoke all on function public.create_lab_health_record(uuid, text, text, date, jsonb, text) from public, anon;
revoke all on function public.extend_patient_access(uuid, integer) from public, anon;
revoke all on function public.record_consultation_with_prescriptions(uuid, text, text, text, jsonb) from public, anon;
revoke all on function public.get_consented_prescriptions(uuid) from public, anon;
revoke all on function public.attach_healthpass_storage_path(uuid, text) from public, anon;
revoke all on function public.can_read_healthpass_object(text) from public, anon, authenticated;
revoke all on function public.can_upload_healthpass_object(text) from public, anon, authenticated;
grant execute on function public.lookup_patient_identity(text) to authenticated;
grant execute on function public.request_lab_report_access(text, integer) to authenticated;
grant execute on function public.get_consented_patient_profile(uuid) to authenticated;
grant execute on function public.create_patient_health_record(text, text, text, date, jsonb, text) to authenticated;
grant execute on function public.create_provider_health_record(uuid, text, text, text, date, jsonb, text) to authenticated;
grant execute on function public.create_lab_health_record(uuid, text, text, date, jsonb, text) to authenticated;
grant execute on function public.extend_patient_access(uuid, integer) to authenticated;
grant execute on function public.record_consultation_with_prescriptions(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.get_consented_prescriptions(uuid) to authenticated;
grant execute on function public.attach_healthpass_storage_path(uuid, text) to authenticated;
grant execute on function public.can_read_healthpass_object(text) to authenticated;
grant execute on function public.can_upload_healthpass_object(text) to authenticated;
revoke all on function public.get_patient_consent_inbox() from public, anon;
revoke all on function public.get_consented_prescriptions(uuid) from public, anon;
grant execute on function public.get_patient_consent_inbox() to authenticated;
grant execute on function public.get_consented_prescriptions(uuid) to authenticated;

-- >>> END OF MIGRATION: 202610150003_healthpass_runtime_support.sql <<<

-- >>> START OF MIGRATION: 202610150004_emergency_limited_access.sql <<<

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

-- >>> END OF MIGRATION: 202610150004_emergency_limited_access.sql <<<

-- >>> START OF MIGRATION: 202610150005_prevent_duplicate_medical_records.sql <<<

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

-- >>> END OF MIGRATION: 202610150005_prevent_duplicate_medical_records.sql <<<



-- =====================================================================
-- OPTIONAL: SEED DEFAULT DEMO ACCOUNTS FOR LOCAL DEVELOPMENT
-- Password for all accounts: HealthPass@123
-- =====================================================================

create extension if not exists pgcrypto;

do $$
declare
  v_patient_id uuid := 'a0000000-0000-0000-0000-000000000001';
  v_doctor_id  uuid := 'b0000000-0000-0000-0000-000000000002';
  v_pharm_id   uuid := 'c0000000-0000-0000-0000-000000000003';
  v_lab_id     uuid := 'd0000000-0000-0000-0000-000000000004';
  v_doc_app_id uuid;
  v_pharm_app_id uuid;
  v_lab_app_id uuid;
begin
  -- ============================================================
  -- 1. PATIENT: ananya.rao@healthpass.in / HealthPass@123
  -- ============================================================
  if not exists (select 1 from auth.users where email = 'ananya.rao@healthpass.in') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', v_patient_id, 'authenticated', 'authenticated',
      'ananya.rao@healthpass.in', crypt('HealthPass@123', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}',
      '{"account_type":"PATIENT","display_name":"Ananya Rao"}',
      now(), now()
    );
  end if;

  -- auth.identities is REQUIRED by GoTrue for password sign-in.
  -- Without it the user exists but every login returns 400.
  insert into auth.identities (
    id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_patient_id::text, v_patient_id,
    jsonb_build_object('sub', v_patient_id::text, 'email', 'ananya.rao@healthpass.in'),
    'email', now(), now(), now()
  ) on conflict do nothing;

  insert into public.patient_profiles (
    user_id, display_name, healthpass_id, blood_group, known_allergies,
    current_medications, medical_conditions, date_of_birth, date_of_birth_verified_at
  ) values (
    v_patient_id, 'Ananya Rao', 'HP-PAT-0417', 'O+', 'Sulfa drugs (Sulfamethoxazole)',
    'Metformin 500mg, Telmisartan 40mg', 'Type 2 Diabetes, Hypertension',
    '1982-04-17', now()
  ) on conflict (user_id) do update set
    display_name = 'Ananya Rao',
    healthpass_id = 'HP-PAT-0417',
    blood_group = 'O+',
    date_of_birth = '1982-04-17',
    date_of_birth_verified_at = now();

  -- ============================================================
  -- 2. DOCTOR: anil.kumar@healthpass.in / HealthPass@123
  -- ============================================================
  if not exists (select 1 from auth.users where email = 'anil.kumar@healthpass.in') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', v_doctor_id, 'authenticated', 'authenticated',
      'anil.kumar@healthpass.in', crypt('HealthPass@123', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}',
      '{"account_type":"DOCTOR","display_name":"Dr. Anil Kumar","facility_name":"Village Health Centre, Kothapalli","professional_id":"MCI-AP-8812","facility_level":"VILLAGE","facility_type":"Village Health Centre"}',
      now(), now()
    );
  end if;

  insert into auth.identities (
    id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_doctor_id::text, v_doctor_id,
    jsonb_build_object('sub', v_doctor_id::text, 'email', 'anil.kumar@healthpass.in'),
    'email', now(), now(), now()
  ) on conflict do nothing;

  if not exists (select 1 from public.doctor_applications where user_id = v_doctor_id) then
    insert into public.doctor_applications (
      user_id, applicant_name, facility_name, facility_type, facility_level, professional_id, status, reviewed_at
    ) values (
      v_doctor_id, 'Dr. Anil Kumar', 'Village Health Centre, Kothapalli', 'Village Health Centre', 'VILLAGE', 'MCI-AP-8812', 'APPROVED', now()
    ) returning id into v_doc_app_id;

    insert into public.verified_providers (
      user_id, application_id, provider_name, facility_name, facility_type, facility_level, active, provider_type
    ) values (
      v_doctor_id, v_doc_app_id, 'Dr. Anil Kumar', 'Village Health Centre, Kothapalli', 'Village Health Centre', 'VILLAGE', true, 'DOCTOR'
    ) on conflict (user_id) do nothing;
  end if;

  -- ============================================================
  -- 3. PHARMACIST: pharmacist@healthpass.in / HealthPass@123
  -- ============================================================
  if not exists (select 1 from auth.users where email = 'pharmacist@healthpass.in') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', v_pharm_id, 'authenticated', 'authenticated',
      'pharmacist@healthpass.in', crypt('HealthPass@123', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}',
      '{"account_type":"PHARMACIST","display_name":"Jan Aushadhi Pharmacist","facility_name":"Jan Aushadhi Medical Store","professional_id":"PCI-PHA-4402"}',
      now(), now()
    );
  end if;

  insert into auth.identities (
    id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_pharm_id::text, v_pharm_id,
    jsonb_build_object('sub', v_pharm_id::text, 'email', 'pharmacist@healthpass.in'),
    'email', now(), now(), now()
  ) on conflict do nothing;

  if not exists (select 1 from public.pharmacist_applications where user_id = v_pharm_id) then
    insert into public.pharmacist_applications (
      user_id, applicant_name, professional_license, facility_name, status, reviewed_at
    ) values (
      v_pharm_id, 'Jan Aushadhi Pharmacist', 'PCI-PHA-4402', 'Jan Aushadhi Medical Store', 'APPROVED', now()
    ) returning id into v_pharm_app_id;

    insert into public.verified_providers (
      user_id, pharmacist_application_id, provider_name, facility_name, facility_type, facility_level, active, provider_type
    ) values (
      v_pharm_id, v_pharm_app_id, 'Jan Aushadhi Pharmacist', 'Jan Aushadhi Medical Store', 'Pharmacy', 'PHARMACY', true, 'PHARMACIST'
    ) on conflict (user_id) do nothing;
  end if;

  -- ============================================================
  -- 4. LAB: lab@healthpass.in / HealthPass@123
  -- ============================================================
  if not exists (select 1 from auth.users where email = 'lab@healthpass.in') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', v_lab_id, 'authenticated', 'authenticated',
      'lab@healthpass.in', crypt('HealthPass@123', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}',
      '{"account_type":"LAB","display_name":"District Pathology Lab","facility_name":"District Hospital Diagnostic Lab","professional_id":"NABL-LAB-9921"}',
      now(), now()
    );
  end if;

  insert into auth.identities (
    id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_lab_id::text, v_lab_id,
    jsonb_build_object('sub', v_lab_id::text, 'email', 'lab@healthpass.in'),
    'email', now(), now(), now()
  ) on conflict do nothing;

  if not exists (select 1 from public.lab_applications where user_id = v_lab_id) then
    insert into public.lab_applications (
      user_id, applicant_name, facility_name, facility_type, facility_level, professional_id, status, reviewed_at
    ) values (
      v_lab_id, 'District Pathology Lab', 'District Hospital Diagnostic Lab', 'Diagnostic Laboratory', 'DISTRICT', 'NABL-LAB-9921', 'APPROVED', now()
    ) returning id into v_lab_app_id;

    insert into public.verified_providers (
      user_id, lab_application_id, provider_name, facility_name, facility_type, facility_level, active, provider_type
    ) values (
      v_lab_id, v_lab_app_id, 'District Pathology Lab', 'District Hospital Diagnostic Lab', 'Diagnostic Laboratory', 'DISTRICT', true, 'LAB'
    ) on conflict (user_id) do nothing;
  end if;
end;
$$;
