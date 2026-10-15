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

create policy patient_profile_read_own on public.patient_profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy patient_profile_insert_own on public.patient_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy patient_profile_update_own on public.patient_profiles
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy doctor_application_read_own on public.doctor_applications
  for select to authenticated using (user_id = (select auth.uid()));
create policy doctor_application_submit_own on public.doctor_applications
  for insert to authenticated with check (
    user_id = (select auth.uid()) and status = 'PENDING' and reviewed_at is null
  );

create policy provider_read_own_verification on public.verified_providers
  for select to authenticated using (user_id = (select auth.uid()));

create policy consent_request_read_patient_or_provider on public.consent_requests
  for select to authenticated using (
    patient_user_id = (select auth.uid()) or provider_user_id = (select auth.uid())
  );
create policy consent_grant_read_patient_or_provider on public.consent_grants
  for select to authenticated using (
    patient_user_id = (select auth.uid()) or provider_user_id = (select auth.uid())
  );

-- Medical records are directly readable only by their owner. Providers must use
-- get_consented_records(), which checks active, unexpired consent and audits access.
create policy health_record_read_patient_only on public.health_records
  for select to authenticated using (patient_user_id = (select auth.uid()));
create policy health_record_insert_patient_reported on public.health_records
  for insert to authenticated with check (
    patient_user_id = (select auth.uid())
    and recorded_by = (select auth.uid())
    and source_type = 'PATIENT_REPORTED'
    and verification_status = 'UNVERIFIED'
  );
create policy health_record_update_patient_reported on public.health_records
  for update to authenticated using (
    patient_user_id = (select auth.uid()) and source_type = 'PATIENT_REPORTED'
  ) with check (
    patient_user_id = (select auth.uid())
    and recorded_by = (select auth.uid())
    and source_type = 'PATIENT_REPORTED'
    and verification_status = 'UNVERIFIED'
  );
create policy health_record_delete_patient_reported on public.health_records
  for delete to authenticated using (
    patient_user_id = (select auth.uid()) and source_type = 'PATIENT_REPORTED'
  );

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

