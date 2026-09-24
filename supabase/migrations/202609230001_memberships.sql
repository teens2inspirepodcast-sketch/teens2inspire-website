-- Memberships extend the existing profile and auth model in place.
alter table public.profiles
  add column if not exists display_name text not null default '',
  add column if not exists avatar_path text,
  add column if not exists membership_tier text not null default 'personal',
  add column if not exists membership_status text not null default 'inactive',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists membership_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists accepted_terms_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_membership_tier_check') then
    alter table public.profiles add constraint profiles_membership_tier_check
      check (membership_tier in ('personal','family','school'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_membership_status_check') then
    alter table public.profiles add constraint profiles_membership_status_check
      check (membership_status in ('pending_payment','pending_school_code','active','past_due','canceled','inactive'));
  end if;
end $$;

create unique index if not exists profiles_stripe_subscription_id_key
  on public.profiles(stripe_subscription_id) where stripe_subscription_id is not null;

create table if not exists public.family_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null check (char_length(trim(first_name)) between 1 and 60),
  display_name text not null check (char_length(trim(display_name)) between 1 and 40),
  interests text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists family_profiles_owner_created_idx on public.family_profiles(owner_id,created_at);
drop trigger if exists family_profiles_set_updated_at on public.family_profiles;
create trigger family_profiles_set_updated_at before update on public.family_profiles
  for each row execute function public.set_updated_at();
alter table public.family_profiles enable row level security;
drop policy if exists family_profiles_read_own on public.family_profiles;
create policy family_profiles_read_own on public.family_profiles
  for select to authenticated using (owner_id = (select auth.uid()));
grant select on public.family_profiles to authenticated;
revoke insert, update, delete on public.family_profiles from anon, authenticated;

create table if not exists public.school_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  school_name text not null check (char_length(trim(school_name)) between 1 and 120),
  max_uses integer not null default 1 check (max_uses between 1 and 10000),
  uses integer not null default 0 check (uses between 0 and max_uses),
  expires_at timestamptz,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.school_codes enable row level security;
revoke all on public.school_codes from anon, authenticated;

create or replace function public.create_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_tier text;
  v_terms_at timestamptz;
begin
  if new.raw_user_meta_data->>'membership_tier' is null
    or new.raw_user_meta_data->>'membership_tier' not in ('personal','family','school') then
    raise exception 'Choose a valid Teens2Inspire membership.';
  end if;
  if nullif(trim(new.raw_user_meta_data->>'first_name'),'') is null
    or char_length(trim(new.raw_user_meta_data->>'first_name')) > 60
    or nullif(trim(new.raw_user_meta_data->>'display_name'),'') is null
    or char_length(trim(new.raw_user_meta_data->>'display_name')) > 40 then
    raise exception 'A first name and display name are required.';
  end if;
  begin
    v_terms_at := nullif(new.raw_user_meta_data->>'accepted_terms_at','')::timestamptz;
  exception when others then
    raise exception 'Terms acceptance is required to create an account.';
  end;
  if v_terms_at is null then raise exception 'Terms acceptance is required to create an account.'; end if;

  v_tier := case new.raw_user_meta_data->>'membership_tier'
    when 'family' then 'family'
    when 'school' then 'school'
    else 'personal'
  end;

  insert into public.profiles(id,first_name,display_name,interests,role,membership_tier,membership_status,accepted_terms_at)
  values (
    new.id,
    left(trim(coalesce(new.raw_user_meta_data->>'first_name','')),60),
    left(trim(coalesce(new.raw_user_meta_data->>'display_name','')),40),
    case when jsonb_typeof(new.raw_user_meta_data->'interests')='array'
      then array(select left(value,40) from jsonb_array_elements_text(new.raw_user_meta_data->'interests') as item(value) limit 20)
      else '{}'::text[] end,
    'user',
    v_tier,
    case when v_tier='school' then 'pending_school_code' else 'pending_payment' end,
    v_terms_at
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated;
grant update(first_name,display_name,interests,avatar_path) on public.profiles to authenticated;
grant select on public.profiles to authenticated;

create or replace function public.validate_school_code(p_code_hash text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    char_length(p_code_hash)=64 and exists (
      select 1 from public.school_codes c
      where c.code_hash=p_code_hash and c.active and (c.expires_at is null or c.expires_at > now()) and c.uses < c.max_uses
    ), false
  );
$$;
revoke all on function public.validate_school_code(text) from public;
grant execute on function public.validate_school_code(text) to anon, authenticated;

create or replace function public.redeem_school_code(p_code_hash text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Sign in is required.'; end if;
  update public.school_codes c set uses=c.uses+1
    where c.code_hash=p_code_hash and c.active and (c.expires_at is null or c.expires_at > now()) and c.uses < c.max_uses;
  if not found then raise exception 'That school code is invalid or no longer available.'; end if;
  update public.profiles p set membership_tier='school', membership_status='active',
    stripe_customer_id=null, stripe_subscription_id=null, membership_period_end=null, cancel_at_period_end=false
    where p.id=v_user_id and p.membership_tier='school' and p.membership_status='pending_school_code';
  if not found then raise exception 'This account is not waiting for a school code.'; end if;
end;
$$;
revoke all on function public.redeem_school_code(text) from public;
grant execute on function public.redeem_school_code(text) to authenticated;

create or replace function public.add_family_profile(p_first_name text,p_display_name text,p_interests text[] default '{}')
returns public.family_profiles language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_tier text;
  v_status text;
  v_count integer;
  v_profile public.family_profiles;
begin
  if v_user_id is null then raise exception 'Sign in is required.'; end if;
  if p_first_name is null or char_length(trim(p_first_name)) not between 1 and 60
    or p_display_name is null or char_length(trim(p_display_name)) not between 1 and 40 then
    raise exception 'Enter a first name and display name.';
  end if;
  if coalesce(cardinality(p_interests),0) > 17 or exists (
    select 1 from unnest(coalesce(p_interests,'{}'::text[])) as item(value)
    where value is null or value <> all(array['Inspiration','Emunah','Tefillah','Jewish Life','School','Organization','Friendship','Teen Life','Personal Growth','Camp','Creativity','Books','Podcasts','Videos','Events','Practical Tips','Tznius']::text[])
  ) then raise exception 'Choose valid interests.'; end if;
  select membership_tier,membership_status into v_tier,v_status from public.profiles where id=v_user_id for update;
  if v_tier <> 'family' or v_status <> 'active' then raise exception 'An active Family membership is required.'; end if;
  select count(*) into v_count from public.family_profiles where owner_id=v_user_id;
  if v_count >= 2 then raise exception 'A Family membership includes three profiles in total.'; end if;
  insert into public.family_profiles(owner_id,first_name,display_name,interests)
    values (v_user_id,left(trim(p_first_name),60),left(trim(p_display_name),40),coalesce(p_interests,'{}'))
    returning * into v_profile;
  return v_profile;
end;
$$;
revoke all on function public.add_family_profile(text,text,text[]) from public;
grant execute on function public.add_family_profile(text,text,text[]) to authenticated;

create or replace function public.remove_family_profile(p_profile_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Sign in is required.'; end if;
  delete from public.family_profiles where id=p_profile_id and owner_id=v_user_id;
  if not found then raise exception 'Profile not found.'; end if;
end;
$$;
revoke all on function public.remove_family_profile(uuid) from public;
grant execute on function public.remove_family_profile(uuid) to authenticated;

create or replace function public.issue_school_code(p_code_hash text,p_school_name text,p_max_uses integer,p_expires_at timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.user_has_role(array['administrator']) then raise exception 'Not authorized.'; end if;
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' or p_max_uses is null or p_max_uses not between 1 and 10000
    or p_school_name is null or char_length(trim(p_school_name)) not between 1 and 120 then
    raise exception 'Invalid school code settings.';
  end if;
  insert into public.school_codes(code_hash,school_name,max_uses,expires_at,created_by)
    values (p_code_hash,trim(p_school_name),p_max_uses,p_expires_at,(select auth.uid()));
end;
$$;
revoke all on function public.issue_school_code(text,text,integer,timestamptz) from public;
grant execute on function public.issue_school_code(text,text,integer,timestamptz) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('profile-photos','profile-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists profile_photos_read_own on storage.objects;
create policy profile_photos_read_own on storage.objects for select to authenticated using (
  bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid()::text)
);
drop policy if exists profile_photos_insert_own on storage.objects;
create policy profile_photos_insert_own on storage.objects for insert to authenticated with check (
  bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid()::text)
);
drop policy if exists profile_photos_update_own on storage.objects;
create policy profile_photos_update_own on storage.objects for update to authenticated using (
  bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid()::text)
) with check (bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid()::text));
drop policy if exists profile_photos_delete_own on storage.objects;
create policy profile_photos_delete_own on storage.objects for delete to authenticated using (
  bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid()::text)
);
