revoke all on function public.user_can_watch_videos() from public,anon,authenticated;
create or replace function public.update_content_updated_at()
returns trigger language plpgsql set search_path=''
as $$ begin new.updated_at:=now(); return new; end $$;
