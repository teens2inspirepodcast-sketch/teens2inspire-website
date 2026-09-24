-- Teens2Inspire platform schema. Apply with the Supabase SQL editor or Supabase CLI.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  interests text[] not null default '{}',
  role text not null default 'user' check (role in ('user','content_editor','event_manager','administrator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  type text not null check (type in ('podcast','video','resource','printable','event','article','original','guide','playlist','series')),
  description text,
  category text,
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  media_url text,
  cover_url text,
  external_url text,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  location text,
  address text,
  organizer text,
  capacity integer check (capacity is null or capacity between 1 and 10000),
  ticket_info text,
  starts_at timestamptz,
  ends_at timestamptz
);

alter table public.content add column if not exists address text;
alter table public.content add column if not exists organizer text;
alter table public.content add column if not exists capacity integer check (capacity is null or capacity between 1 and 10000);
alter table public.content add column if not exists ticket_info text;

create index if not exists content_status_type_published_idx on public.content(status,type,published_at desc);
create index if not exists content_tags_idx on public.content using gin(tags);
create index if not exists content_category_idx on public.content(category);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.content(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,content_id)
);
create index if not exists favorites_user_created_idx on public.favorites(user_id,created_at desc);

create table if not exists public.content_views (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.content(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key(user_id,content_id)
);
create index if not exists content_views_user_viewed_idx on public.content_views(user_id,viewed_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 254),
  subject text not null check (char_length(subject) between 1 and 150),
  message text not null check (char_length(message) between 5 and 5000),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_created_at_idx on public.messages(created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists content_set_updated_at on public.content;
create trigger content_set_updated_at before update on public.content for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,first_name,interests)
  values (new.id,coalesce(new.raw_user_meta_data->>'first_name',''),
    case when jsonb_typeof(new.raw_user_meta_data->'interests')='array'
      then array(select jsonb_array_elements_text(new.raw_user_meta_data->'interests')) else '{}'::text[] end)
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute function public.create_profile_for_auth_user();

create or replace function public.user_has_role(required_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = any(required_roles));
$$;
revoke all on function public.user_has_role(text[]) from public;
grant execute on function public.user_has_role(text[]) to authenticated;

create or replace function public.studio_user_count()
returns bigint language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.user_has_role(array['administrator']) then raise exception 'Not authorized'; end if;
  return (select count(*) from public.profiles);
end;
$$;
revoke all on function public.studio_user_count() from public;
grant execute on function public.studio_user_count() to authenticated;

alter table public.profiles enable row level security;
alter table public.content enable row level security;
alter table public.favorites enable row level security;
alter table public.content_views enable row level security;
alter table public.messages enable row level security;

drop policy if exists "profiles_read_own" on public.profiles;
create policy "profiles_read_own" on public.profiles for select to authenticated using (id = (select auth.uid()));

drop policy if exists "published_content_is_public" on public.content;
create policy "published_content_is_public" on public.content for select to anon,authenticated using (status='published');
drop policy if exists "studio_roles_read_all_content" on public.content;
create policy "studio_roles_read_all_content" on public.content for select to authenticated using (public.user_has_role(array['administrator','content_editor','event_manager']));
drop policy if exists "studio_roles_insert_content" on public.content;
create policy "studio_roles_insert_content" on public.content for insert to authenticated with check (
  (public.user_has_role(array['administrator','content_editor'])) or
  (type='event' and public.user_has_role(array['event_manager']))
);
drop policy if exists "studio_roles_update_content" on public.content;
create policy "studio_roles_update_content" on public.content for update to authenticated using (
  public.user_has_role(array['administrator','content_editor']) or (type='event' and public.user_has_role(array['event_manager']))
) with check (
  public.user_has_role(array['administrator','content_editor']) or (type='event' and public.user_has_role(array['event_manager']))
);
drop policy if exists "studio_roles_delete_content" on public.content;
create policy "studio_roles_delete_content" on public.content for delete to authenticated using (
  public.user_has_role(array['administrator','content_editor']) or (type='event' and public.user_has_role(array['event_manager']))
);

drop policy if exists "users_read_own_favorites" on public.favorites;
create policy "users_read_own_favorites" on public.favorites for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "users_save_published_content" on public.favorites;
create policy "users_save_published_content" on public.favorites for insert to authenticated with check (
  user_id=(select auth.uid()) and exists(select 1 from public.content c where c.id=content_id and c.status='published')
);
drop policy if exists "users_remove_own_favorites" on public.favorites;
create policy "users_remove_own_favorites" on public.favorites for delete to authenticated using (user_id=(select auth.uid()));

drop policy if exists "users_read_own_content_views" on public.content_views;
create policy "users_read_own_content_views" on public.content_views for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "users_record_published_content_views" on public.content_views;
create policy "users_record_published_content_views" on public.content_views for insert to authenticated with check (
  user_id=(select auth.uid()) and exists(select 1 from public.content c where c.id=content_id and c.status='published')
);
drop policy if exists "users_update_own_content_views" on public.content_views;
create policy "users_update_own_content_views" on public.content_views for update to authenticated using (user_id=(select auth.uid())) with check (
  user_id=(select auth.uid()) and exists(select 1 from public.content c where c.id=content_id and c.status='published')
);

drop policy if exists "public_contact_submission" on public.messages;
create policy "public_contact_submission" on public.messages for insert to anon,authenticated with check (
  char_length(trim(name)) between 1 and 100 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  and char_length(trim(subject)) between 1 and 150 and char_length(trim(message)) between 5 and 5000
);
drop policy if exists "administrators_read_messages" on public.messages;
create policy "administrators_read_messages" on public.messages for select to authenticated using (public.user_has_role(array['administrator']));
drop policy if exists "administrators_update_messages" on public.messages;
create policy "administrators_update_messages" on public.messages for update to authenticated using (public.user_has_role(array['administrator'])) with check (public.user_has_role(array['administrator']));
drop policy if exists "administrators_delete_messages" on public.messages;
create policy "administrators_delete_messages" on public.messages for delete to authenticated using (public.user_has_role(array['administrator']));

-- Public URLs from this bucket are served through /api/media only after a published content row references the object.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('media','media',false,104857600,array['audio/*','video/*','image/*','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=104857600,allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('artwork','artwork',false,20971520,array['image/*']) on conflict(id) do update set public=false;
insert into storage.buckets(id,name,public,file_size_limit)
values ('downloads','downloads',false,104857600) on conflict(id) do update set public=false;

drop policy if exists "published_content_media_read" on storage.objects;
create policy "published_content_media_read" on storage.objects for select to anon,authenticated using (
  bucket_id='media' and exists(select 1 from public.content c where c.status='published' and
    (c.media_url='storage://media/'||name or c.cover_url='storage://media/'||name))
);
drop policy if exists "studio_media_insert" on storage.objects;
create policy "studio_media_insert" on storage.objects for insert to authenticated with check (
  bucket_id in ('media','artwork','downloads') and public.user_has_role(array['administrator','content_editor','event_manager'])
);
drop policy if exists "studio_media_update" on storage.objects;
create policy "studio_media_update" on storage.objects for update to authenticated using (
  bucket_id in ('media','artwork','downloads') and public.user_has_role(array['administrator','content_editor','event_manager'])
) with check (bucket_id in ('media','artwork','downloads') and public.user_has_role(array['administrator','content_editor','event_manager']));
drop policy if exists "studio_media_delete" on storage.objects;
create policy "studio_media_delete" on storage.objects for delete to authenticated using (
  bucket_id in ('media','artwork','downloads') and public.user_has_role(array['administrator','content_editor','event_manager'])
);

grant select on public.content to anon,authenticated;
grant select,insert,delete on public.favorites to authenticated;
grant select,insert,update on public.content_views to authenticated;
grant select,insert on public.messages to anon,authenticated;
grant update,delete on public.messages to authenticated;
grant select on public.profiles to authenticated;
grant insert,update,delete on public.content to authenticated;
