-- Applied to the connected Supabase project as protect_personal_profiles.
-- Reference only: these policies already exist on that project.
alter table public.profiles enable row level security;
create policy "Users read own profile" on public.profiles
    for select to authenticated using ((select auth.uid()) = id);
create policy "Users update own profile" on public.profiles
    for update to authenticated
    using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
grant select, update on public.profiles to authenticated;
