-- Align the application with the existing Teens2Inspire Supabase schema.
-- Existing content, memberships, media buckets, and storage objects are preserved.

create extension if not exists pgcrypto;

-- Columns expected by the Next.js Studio and Stripe integration.
alter table public.profiles
  add column if not exists display_name text not null default '',
  add column if not exists avatar_path text,
  add column if not exists membership_tier text not null default 'personal',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists membership_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists accepted_terms_at timestamptz;

alter table public.profiles drop constraint if exists profiles_membership_status_check;
update public.profiles set membership_status='canceled' where membership_status='cancelled';
alter table public.profiles add constraint profiles_membership_status_check
  check (membership_status in ('pending_payment','pending_school_code','active','past_due','canceled','inactive','expired'));
alter table public.profiles drop constraint if exists profiles_membership_tier_check;
alter table public.profiles add constraint profiles_membership_tier_check
  check (membership_tier in ('personal','family','school'));
create unique index if not exists profiles_stripe_subscription_id_key
  on public.profiles(stripe_subscription_id) where stripe_subscription_id is not null;

-- Existing memberships are all free/inactive. Map legacy labels without granting paid access.
update public.profiles
set membership_tier = case when membership_type='school' then 'school' else 'personal' end,
    membership_status = case when membership_type='school' and school_code is not null then 'active'
                             when membership_type='school' then 'pending_school_code' else 'inactive' end
where stripe_subscription_id is null;

-- Keep the shared content table while adding the event columns used by the Studio.
alter table public.content
  add column if not exists location text,
  add column if not exists address text,
  add column if not exists organizer text,
  add column if not exists capacity integer,
  add column if not exists ticket_info text,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='content_capacity_range_check') then
    alter table public.content add constraint content_capacity_range_check
      check (capacity is null or capacity between 1 and 10000);
  end if;
end $$;
update public.content set
  starts_at=coalesce(starts_at,event_starts_at),
  ends_at=coalesce(ends_at,event_ends_at),
  location=coalesce(location,event_location),
  external_url=coalesce(external_url,registration_url)
where type='event';

-- Add only app-required tables that are not already present.
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
alter table public.family_profiles enable row level security;
drop policy if exists family_profiles_read_own on public.family_profiles;
create policy family_profiles_read_own on public.family_profiles for select to authenticated using (owner_id=(select auth.uid()));
revoke all on public.family_profiles from anon,authenticated;
grant select on public.family_profiles to authenticated;

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
revoke all on public.school_codes from anon,authenticated;

-- The admin Studio counts users without exposing profiles to staff or the public.
create or replace function public.user_has_role(required_roles text[])
returns boolean language sql stable security definer set search_path=''
as $$ select exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role::text=any(required_roles)); $$;
revoke all on function public.user_has_role(text[]) from public,anon;
grant execute on function public.user_has_role(text[]) to authenticated;

create or replace function public.studio_user_count()
returns bigint language plpgsql stable security definer set search_path=''
as $$ begin
  if not public.user_has_role(array['administrator']) then raise exception 'Not authorized'; end if;
  return (select count(*) from public.profiles);
end $$;
revoke all on function public.studio_user_count() from public,anon;
grant execute on function public.studio_user_count() to authenticated;

create or replace function public.issue_school_code(p_code_hash text,p_school_name text,p_max_uses integer,p_expires_at timestamptz default null)
returns void language plpgsql security definer set search_path=''
as $$ begin
  if not public.user_has_role(array['administrator']) then raise exception 'Not authorized'; end if;
  if p_code_hash !~ '^[0-9a-f]{64}$' or p_school_name is null or char_length(trim(p_school_name)) not between 1 and 120 or p_max_uses not between 1 and 10000 then raise exception 'Invalid school code settings'; end if;
  insert into public.school_codes(code_hash,school_name,max_uses,expires_at,created_by) values(p_code_hash,trim(p_school_name),p_max_uses,p_expires_at,(select auth.uid()));
end $$;
revoke all on function public.issue_school_code(text,text,integer,timestamptz) from public,anon;
grant execute on function public.issue_school_code(text,text,integer,timestamptz) to authenticated;

create or replace function public.validate_school_code(p_code_hash text)
returns boolean language sql stable security definer set search_path=''
as $$ select coalesce(char_length(p_code_hash)=64 and exists(
  select 1 from public.school_codes c where c.code_hash=p_code_hash and c.active and (c.expires_at is null or c.expires_at>now()) and c.uses<c.max_uses
),false); $$;
revoke all on function public.validate_school_code(text) from public;
grant execute on function public.validate_school_code(text) to anon,authenticated;

create or replace function public.redeem_school_code(p_code_hash text)
returns void language plpgsql security definer set search_path=''
as $$ declare v_uid uuid:=(select auth.uid()); begin
  if v_uid is null then raise exception 'Sign in is required'; end if;
  update public.school_codes set uses=uses+1 where code_hash=p_code_hash and active and (expires_at is null or expires_at>now()) and uses<max_uses;
  if not found then raise exception 'That school code is invalid or no longer available'; end if;
  update public.profiles set membership_tier='school',membership_status='active',stripe_customer_id=null,stripe_subscription_id=null,membership_period_end=null,cancel_at_period_end=false
    where id=v_uid and membership_tier='school' and membership_status='pending_school_code';
  if not found then raise exception 'This account is not waiting for a school code'; end if;
end $$;
revoke all on function public.redeem_school_code(text) from public,anon;
grant execute on function public.redeem_school_code(text) to authenticated;

create or replace function public.add_family_profile(p_first_name text,p_display_name text,p_interests text[] default '{}')
returns public.family_profiles language plpgsql security definer set search_path=''
as $$ declare v_uid uuid:=(select auth.uid()); v_count integer; v_row public.family_profiles;
begin
  if v_uid is null then raise exception 'Sign in is required'; end if;
  if char_length(trim(coalesce(p_first_name,''))) not between 1 and 60 or char_length(trim(coalesce(p_display_name,''))) not between 1 and 40 then raise exception 'Enter a first name and display name'; end if;
  if not exists(select 1 from public.profiles where id=v_uid and membership_tier='family' and membership_status='active' and stripe_subscription_id is not null and membership_period_end>now()) then raise exception 'An active Family membership is required'; end if;
  select count(*) into v_count from public.family_profiles where owner_id=v_uid;
  if v_count>=2 then raise exception 'A Family membership includes three profiles in total'; end if;
  insert into public.family_profiles(owner_id,first_name,display_name,interests) values(v_uid,left(trim(p_first_name),60),left(trim(p_display_name),40),coalesce(p_interests,'{}')) returning * into v_row;
  return v_row;
end $$;
revoke all on function public.add_family_profile(text,text,text[]) from public;
grant execute on function public.add_family_profile(text,text,text[]) to authenticated;

create or replace function public.remove_family_profile(p_profile_id uuid)
returns void language plpgsql security definer set search_path=''
as $$ begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  delete from public.family_profiles f where f.id=p_profile_id and f.owner_id=(select auth.uid());
  if not found then raise exception 'Profile not found'; end if;
end $$;
revoke all on function public.remove_family_profile(uuid) from public;
grant execute on function public.remove_family_profile(uuid) to authenticated;

-- Support this app's signup fields after the existing legacy auth triggers run.
create or replace function public.t2i_apply_membership_signup()
returns trigger language plpgsql security definer set search_path=''
as $$ declare v_tier text; v_terms timestamptz; begin
  if coalesce(new.raw_user_meta_data->>'age_group','')<>'13plus' then raise exception 'Under-13 sign-up needs verified parent or guardian consent'; end if;
  v_tier:=case when new.raw_user_meta_data->>'membership_tier' in ('personal','family','school') then new.raw_user_meta_data->>'membership_tier' else 'personal' end;
  begin v_terms:=nullif(new.raw_user_meta_data->>'accepted_terms_at','')::timestamptz; exception when others then v_terms:=null; end;
  if v_terms is null then raise exception 'Terms acceptance is required'; end if;
  update public.profiles set
    display_name=left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),nullif(trim(new.raw_user_meta_data->>'first_name'),''),''),40),
    membership_tier=v_tier,
    membership_status=case when v_tier='school' then 'pending_school_code' else 'pending_payment' end,
    accepted_terms_at=v_terms
  where id=new.id and role::text='user';
  return new;
end $$;
drop trigger if exists zzz_t2i_apply_membership_signup on auth.users;
create trigger zzz_t2i_apply_membership_signup after insert on auth.users for each row execute function public.t2i_apply_membership_signup();

create or replace function public.t2i_require_signup_age_gate()
returns trigger language plpgsql set search_path=''
as $$ begin
  if coalesce(new.raw_user_meta_data->>'age_group','')<>'13plus' then raise exception 'Under-13 sign-up needs verified parent or guardian consent'; end if;
  return new;
end $$;
drop trigger if exists auth_signup_age_gate on auth.users;
create trigger auth_signup_age_gate before insert on auth.users for each row execute function public.t2i_require_signup_age_gate();

-- Prevent self-service changes to roles or paid membership status. Stripe uses server-side service-role writes.
drop trigger if exists t2i_protect_profile_fields_trigger on public.profiles;
drop trigger if exists protect_profile_fields on public.profiles;
drop trigger if exists t2i_protect_profile_fields on public.profiles;
revoke insert,update on public.profiles from anon,authenticated;
revoke update(first_name,display_name,interests,avatar_path,membership_tier,membership_status,stripe_customer_id,stripe_subscription_id,membership_period_end,cancel_at_period_end,accepted_terms_at,role,membership_type,membership_expires_at,school_id,school_code) on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update(first_name,display_name,interests,avatar_path) on public.profiles to authenticated;
drop policy if exists "staff profile management" on public.profiles;
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own safe update" on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
drop policy if exists "t2i own profile insert" on public.profiles;

-- Owner-only Studio: remove all legacy staff write/read paths, leaving public published reads.
drop policy if exists "published content public read" on public.content;
drop policy if exists "staff content write" on public.content;
drop policy if exists "t2i role scoped delete" on public.content;
drop policy if exists "t2i role scoped insert" on public.content;
drop policy if exists "t2i role scoped update" on public.content;
drop policy if exists "t2i_staff_delete_content" on public.content;
drop policy if exists "t2i_staff_insert_content" on public.content;
drop policy if exists "t2i_staff_read_content" on public.content;
drop policy if exists "t2i_staff_update_content" on public.content;
drop policy if exists published_content_is_public on public.content;
drop policy if exists studio_roles_read_all_content on public.content;
drop policy if exists studio_roles_insert_content on public.content;
drop policy if exists studio_roles_update_content on public.content;
drop policy if exists studio_roles_delete_content on public.content;
create policy "published content public read" on public.content for select to anon,authenticated using(status='published');
create policy "administrator read all content" on public.content for select to authenticated using(public.user_has_role(array['administrator']));
create policy "administrator insert content" on public.content for insert to authenticated with check(public.user_has_role(array['administrator']));
create policy "administrator update content" on public.content for update to authenticated using(public.user_has_role(array['administrator'])) with check(public.user_has_role(array['administrator']));
create policy "administrator delete content" on public.content for delete to authenticated using(public.user_has_role(array['administrator']));

drop policy if exists "staff can read messages" on public.messages;
drop policy if exists "staff can update messages" on public.messages;
drop policy if exists administrators_read_messages on public.messages;
drop policy if exists administrators_update_messages on public.messages;
drop policy if exists administrators_delete_messages on public.messages;
create policy administrators_read_messages on public.messages for select to authenticated using(public.user_has_role(array['administrator']));
create policy administrators_update_messages on public.messages for update to authenticated using(public.user_has_role(array['administrator'])) with check(public.user_has_role(array['administrator']));
create policy administrators_delete_messages on public.messages for delete to authenticated using(public.user_has_role(array['administrator']));
grant select,update,delete on public.messages to authenticated;

-- Private video storage is separate from existing public media/artwork/download files.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('video-assets','video-assets',false,1073741824,array['video/mp4','video/webm','video/quicktime','video/x-m4v'])
on conflict(id) do update set public=false,file_size_limit=1073741824,allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.video_assets (
  content_id uuid primary key references public.content(id) on delete cascade,
  media_url text not null check(media_url ~ '^storage://video-assets/[0-9a-f-]{36}/[0-9]+-[A-Za-z0-9._-]{1,100}$'),
  updated_at timestamptz not null default now()
);
alter table public.video_assets enable row level security;
revoke all on public.video_assets from public,anon,authenticated;
grant all on public.video_assets to service_role;

create or replace function public.hide_video_media_url()
returns trigger language plpgsql set search_path=''
as $$ begin if new.type::text in ('video','original') then new.media_url:=null; new.external_url:=null; end if; return new; end $$;
drop trigger if exists content_hide_video_media_url on public.content;
create trigger content_hide_video_media_url before insert or update of type,media_url,external_url on public.content for each row execute function public.hide_video_media_url();

create or replace function public.user_can_watch_videos()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(
  select 1 from public.profiles p join auth.users u on u.id=p.id
  where p.id=(select auth.uid()) and u.email_confirmed_at is not null and (
    p.role::text='administrator' or (
      p.membership_tier in ('personal','family') and p.membership_status='active'
      and p.stripe_subscription_id is not null and p.membership_period_end>now()
    )
  )
); $$;
revoke all on function public.user_can_watch_videos() from public,anon;
grant execute on function public.user_can_watch_videos() to authenticated;

-- There is intentionally no SELECT policy on video-assets: paid playback is proxied
-- through the app on every request, which checks the current signed-in entitlement.
drop policy if exists t2i_private_video_owner_upload on storage.objects;
create policy t2i_private_video_owner_upload on storage.objects for insert to authenticated with check(
  bucket_id='video-assets' and (storage.foldername(name))[1]=(select auth.uid()::text)
  and public.user_has_role(array['administrator'])
);
drop policy if exists t2i_private_video_owner_update on storage.objects;
create policy t2i_private_video_owner_update on storage.objects for update to authenticated using(
  bucket_id='video-assets' and (storage.foldername(name))[1]=(select auth.uid()::text)
  and public.user_has_role(array['administrator'])
) with check(bucket_id='video-assets' and (storage.foldername(name))[1]=(select auth.uid()::text) and public.user_has_role(array['administrator']));
drop policy if exists t2i_private_video_owner_delete on storage.objects;
create policy t2i_private_video_owner_delete on storage.objects for delete to authenticated using(
  bucket_id='video-assets' and (storage.foldername(name))[1]=(select auth.uid()::text)
  and public.user_has_role(array['administrator'])
);

-- Private account photos; original media, artwork, and downloads buckets are unchanged.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-photos','profile-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists profile_photos_read_own on storage.objects;
create policy profile_photos_read_own on storage.objects for select to authenticated using(bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid()::text));
drop policy if exists profile_photos_insert_own on storage.objects;
create policy profile_photos_insert_own on storage.objects for insert to authenticated with check(bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid()::text));
drop policy if exists profile_photos_update_own on storage.objects;
create policy profile_photos_update_own on storage.objects for update to authenticated using(bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid()::text)) with check(bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid()::text));
drop policy if exists profile_photos_delete_own on storage.objects;
create policy profile_photos_delete_own on storage.objects for delete to authenticated using(bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid()::text));

grant select,insert,update,delete on public.content to authenticated;
grant select on public.content to anon;
