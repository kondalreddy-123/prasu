
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
  -- 1. Demo Patient: ananya.rao@healthpass.in
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
      date_of_birth = '1982-04-17',
      date_of_birth_verified_at = now();
  end if;

  -- 2. Demo Doctor: anil.kumar@healthpass.in
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

  -- 3. Demo Pharmacist: pharmacist@healthpass.in
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

  -- 4. Demo Lab: lab@healthpass.in
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
