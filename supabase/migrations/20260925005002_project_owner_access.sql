-- Finish aligning legacy workspace permissions with the owner-only Studio.
drop policy if exists "profiles own read" on public.profiles;

drop policy if exists "staff can manage memberships" on public.memberships;
drop policy if exists "Users can view their own membership" on public.memberships;
drop policy if exists "users can read own membership" on public.memberships;
drop policy if exists memberships_read_own on public.memberships;
drop policy if exists memberships_owner_read_all on public.memberships;
create policy memberships_read_own on public.memberships for select to authenticated using(user_id=(select auth.uid()));
create policy memberships_owner_read_all on public.memberships for select to authenticated using(public.user_has_role(array['administrator']));

drop policy if exists "staff read registrations" on public.event_registrations;
drop policy if exists event_registrations_owner_read on public.event_registrations;
create policy event_registrations_owner_read on public.event_registrations for select to authenticated using(public.user_has_role(array['administrator']));

drop policy if exists "Authenticated users can add site images" on public.site_images;
drop policy if exists "Authenticated users can delete site images" on public.site_images;
drop policy if exists "Authenticated users can insert site images" on public.site_images;
drop policy if exists "Authenticated users can update site images" on public.site_images;
drop policy if exists "staff can manage site images" on public.site_images;
drop policy if exists site_images_owner_write on public.site_images;
create policy site_images_owner_write on public.site_images for all to authenticated
  using(public.user_has_role(array['administrator'])) with check(public.user_has_role(array['administrator']));

drop policy if exists "staff media upload" on storage.objects;
drop policy if exists "staff media update" on storage.objects;
drop policy if exists "staff media delete" on storage.objects;
drop policy if exists "t2i staff upload assets" on storage.objects;
drop policy if exists "t2i staff update assets" on storage.objects;
drop policy if exists "t2i staff delete assets" on storage.objects;
drop policy if exists t2i_owner_media_insert on storage.objects;
drop policy if exists t2i_owner_media_update on storage.objects;
drop policy if exists t2i_owner_media_delete on storage.objects;
create policy t2i_owner_media_insert on storage.objects for insert to authenticated with check(
  bucket_id in ('media','artwork','downloads') and public.user_has_role(array['administrator'])
);
create policy t2i_owner_media_update on storage.objects for update to authenticated using(
  bucket_id in ('media','artwork','downloads') and public.user_has_role(array['administrator'])
) with check(bucket_id in ('media','artwork','downloads') and public.user_has_role(array['administrator']));
create policy t2i_owner_media_delete on storage.objects for delete to authenticated using(
  bucket_id in ('media','artwork','downloads') and public.user_has_role(array['administrator'])
);

revoke all on function public.t2i_apply_membership_signup() from public,anon,authenticated;
revoke all on function public.t2i_require_signup_age_gate() from public,anon,authenticated;
revoke all on function public.hide_video_media_url() from public,anon,authenticated;
revoke all on function public.handle_new_user() from public,anon,authenticated;
revoke all on function public.t2i_handle_new_user() from public,anon,authenticated;
revoke all on function public.t2i_protect_profile_fields() from public,anon,authenticated;
revoke all on function public.add_user_to_mailing_list() from public,anon,authenticated;
revoke all on function public.rls_auto_enable() from public,anon,authenticated;
revoke all on function public.is_staff(uuid) from public,anon,authenticated;
revoke all on function public.t2i_role(uuid) from public,anon,authenticated;
revoke all on function public.t2i_can_manage_type(public.content_type) from public,anon,authenticated;

create index if not exists school_codes_created_by_idx on public.school_codes(created_by);
create index if not exists content_published_type_starts_idx on public.content(status,type,starts_at);
