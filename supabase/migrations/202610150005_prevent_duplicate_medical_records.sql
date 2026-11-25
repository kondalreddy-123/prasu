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
