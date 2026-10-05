-- Applied to the connected project as tighten_existing_access.
-- Reference only: this migration already exists on the project.
alter table public.profiles enable row level security;
alter table public.captions enable row level security;
alter table public.caption_votes enable row level security;

revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (first_name, last_name, avatar_url, updated_at) on public.profiles to authenticated;

alter policy "Users read own profile" on public.profiles
    using ((select auth.uid()) = id
        and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false');
alter policy "Users update own profile" on public.profiles
    using ((select auth.uid()) = id
        and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false')
    with check ((select auth.uid()) = id
        and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false');

revoke all on sequence public.captions_id_seq from public, anon, authenticated;
grant usage on sequence public.captions_id_seq to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

alter policy "Authenticated users can upload own avatars" on storage.objects
    with check (bucket_id = 'avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false');
alter policy "Users read own caption image metadata" on storage.objects
    using (bucket_id = 'caption-images'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false');
alter policy "Users clean up own caption images" on storage.objects
    using (bucket_id = 'caption-images'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false');
