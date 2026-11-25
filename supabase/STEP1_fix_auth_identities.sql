-- =====================================================================
-- STEP 1: Fix sign-in 400 "Invalid login credentials" error
-- =====================================================================
-- ROOT CAUSE: Supabase GoTrue requires a matching row in auth.identities
-- for every auth.users row. The original seed SQL omitted these rows,
-- so GoTrue rejects every login attempt even though the email+password
-- exists in auth.users.
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → paste this file → Run
--
-- SAFE TO RE-RUN: all inserts use ON CONFLICT DO NOTHING.
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
  -- 1. PATIENT: ananya.rao@healthpass.in
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

  -- Auth identity row (required by GoTrue for password sign-in)
  insert into auth.identities (
    id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_patient_id::text,
    v_patient_id,
    jsonb_build_object('sub', v_patient_id::text, 'email', 'ananya.rao@healthpass.in'),
    'email',
    now(), now(), now()
  ) on conflict do nothing;

  -- Patient profile
  insert into public.patient_profiles (
    user_id, display_name, healthpass_id, blood_group, known_allergies,
    current_medications, medical_conditions, date_of_birth, date_of_birth_verified_at
  ) values (
    v_patient_id, 'Ananya Rao', 'HP-PAT-0417', 'O+',
    'Sulfa drugs (Sulfamethoxazole)',
    'Metformin 500mg, Telmisartan 40mg',
    'Type 2 Diabetes, Hypertension',
    '1982-04-17', now()
  ) on conflict (user_id) do update set
    display_name            = 'Ananya Rao',
    healthpass_id           = 'HP-PAT-0417',
    blood_group             = 'O+',
    date_of_birth           = '1982-04-17',
    date_of_birth_verified_at = now();

  -- ============================================================
  -- 2. DOCTOR: anil.kumar@healthpass.in
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
    v_doctor_id::text,
    v_doctor_id,
    jsonb_build_object('sub', v_doctor_id::text, 'email', 'anil.kumar@healthpass.in'),
    'email',
    now(), now(), now()
  ) on conflict do nothing;

  if not exists (select 1 from public.doctor_applications where user_id = v_doctor_id) then
    insert into public.doctor_applications (
      user_id, applicant_name, facility_name, facility_type,
      facility_level, professional_id, status, reviewed_at
    ) values (
      v_doctor_id, 'Dr. Anil Kumar', 'Village Health Centre, Kothapalli',
      'Village Health Centre', 'VILLAGE', 'MCI-AP-8812', 'APPROVED', now()
    ) returning id into v_doc_app_id;

    insert into public.verified_providers (
      user_id, application_id, provider_name, facility_name,
      facility_type, facility_level, active, provider_type
    ) values (
      v_doctor_id, v_doc_app_id, 'Dr. Anil Kumar',
      'Village Health Centre, Kothapalli',
      'Village Health Centre', 'VILLAGE', true, 'DOCTOR'
    ) on conflict (user_id) do nothing;
  end if;

  -- ============================================================
  -- 3. PHARMACIST: pharmacist@healthpass.in
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
    v_pharm_id::text,
    v_pharm_id,
    jsonb_build_object('sub', v_pharm_id::text, 'email', 'pharmacist@healthpass.in'),
    'email',
    now(), now(), now()
  ) on conflict do nothing;

  if not exists (select 1 from public.pharmacist_applications where user_id = v_pharm_id) then
    insert into public.pharmacist_applications (
      user_id, applicant_name, professional_license, facility_name, status, reviewed_at
    ) values (
      v_pharm_id, 'Jan Aushadhi Pharmacist', 'PCI-PHA-4402',
      'Jan Aushadhi Medical Store', 'APPROVED', now()
    ) returning id into v_pharm_app_id;

    insert into public.verified_providers (
      user_id, pharmacist_application_id, provider_name, facility_name,
      facility_type, facility_level, active, provider_type
    ) values (
      v_pharm_id, v_pharm_app_id, 'Jan Aushadhi Pharmacist',
      'Jan Aushadhi Medical Store', 'Pharmacy', 'PHARMACY', true, 'PHARMACIST'
    ) on conflict (user_id) do nothing;
  end if;

  -- ============================================================
  -- 4. LAB: lab@healthpass.in
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
    v_lab_id::text,
    v_lab_id,
    jsonb_build_object('sub', v_lab_id::text, 'email', 'lab@healthpass.in'),
    'email',
    now(), now(), now()
  ) on conflict do nothing;

  if not exists (select 1 from public.lab_applications where user_id = v_lab_id) then
    declare
      v_lab_app_id2 uuid;
    begin
      insert into public.lab_applications (
        user_id, applicant_name, facility_name, facility_type,
        facility_level, professional_id, status, reviewed_at
      ) values (
        v_lab_id, 'District Pathology Lab',
        'District Hospital Diagnostic Lab',
        'Diagnostic Laboratory', 'DISTRICT', 'NABL-LAB-9921', 'APPROVED', now()
      ) returning id into v_lab_app_id2;

      insert into public.verified_providers (
        user_id, lab_application_id, provider_name, facility_name,
        facility_type, facility_level, active, provider_type
      ) values (
        v_lab_id, v_lab_app_id2, 'District Pathology Lab',
        'District Hospital Diagnostic Lab',
        'Diagnostic Laboratory', 'DISTRICT', true, 'LAB'
      ) on conflict (user_id) do nothing;
    end;
  end if;

end;
$$;
