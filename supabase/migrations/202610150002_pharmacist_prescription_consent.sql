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

create policy pharmacist_application_read_own on public.pharmacist_applications
  for select to authenticated using (user_id = (select auth.uid()));
create policy pharmacist_application_submit_own on public.pharmacist_applications
  for insert to authenticated with check (
    user_id = (select auth.uid()) and status = 'PENDING' and reviewed_at is null
  );
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
