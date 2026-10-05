-- Applied to the connected Supabase project as add_caption_votes.
-- Reference only: these schema changes already exist on that project.
create table public.caption_votes (
    id uuid primary key default gen_random_uuid(),
    caption_id bigint not null references public.captions(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    vote smallint not null check (vote in (-1, 1)),
    created_at timestamptz not null default now(),
    constraint caption_votes_one_per_user unique (caption_id, user_id)
);
create index caption_votes_user_id_idx on public.caption_votes(user_id);

alter table public.caption_votes enable row level security;
revoke all on public.caption_votes from anon, authenticated;
grant select on public.caption_votes to authenticated;
grant insert (caption_id, user_id, vote) on public.caption_votes to authenticated;

create policy "Users read own votes" on public.caption_votes
    for select to authenticated
    using ((select auth.uid()) = user_id
        and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false');
create policy "Users insert own votes" on public.caption_votes
    for insert to authenticated
    with check ((select auth.uid()) = user_id
        and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false');
