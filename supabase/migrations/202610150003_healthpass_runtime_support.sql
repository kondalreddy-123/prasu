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
create trigger on_auth_user_created_healthpass
  after insert on auth.users for each row execute function public.bootstrap_healthpass_auth_user();
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
        when grant.id is null then request.status
        when grant.status = 'REVOKED' then 'REVOKED'
        when grant.expires_at <= now() then 'EXPIRED'
        else 'GRANTED'
      end,
      'grantedCategories', coalesce(grant.granted_categories, array[]::text[]),
      'expiresAt', grant.expires_at, 'grantId', grant.id
    )
    from public.consent_requests request
    left join public.verified_providers provider on provider.user_id = request.provider_user_id
    left join public.consent_grants grant on grant.request_id = request.id
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
