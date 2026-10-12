alter table public.profiles add column if not exists nickname text;
grant select (nickname), update (nickname) on public.profiles to authenticated;
alter table public.profiles add constraint profiles_nickname_length check (nickname is null or (nickname = btrim(nickname) and char_length(nickname) between 1 and 40));
create table public.post_authors (
 id uuid primary key references public.profiles(id) on delete cascade,
 nickname text not null check (nickname = btrim(nickname) and char_length(nickname) between 1 and 40),
 avatar_url text
);
alter table public.post_authors enable row level security;
grant select on public.post_authors to anon, authenticated;
grant insert, update, delete on public.post_authors to authenticated;
create policy "Published author names are public" on public.post_authors for select to anon, authenticated using (exists (select 1 from public.captions where created_by = post_authors.id));
create policy "Users read own author card" on public.post_authors for select to authenticated using ((select auth.uid()) = id);
create policy "Users create own author card" on public.post_authors for insert to authenticated with check ((select auth.uid()) = id and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false));
create policy "Users update own author card" on public.post_authors for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false));
create policy "Users remove own author card" on public.post_authors for delete to authenticated using ((select auth.uid()) = id);
create index if not exists captions_created_by_idx on public.captions(created_by);
create function public.sync_post_author() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if new.nickname is null then
  delete from public.post_authors where id = new.id;
 else
  insert into public.post_authors(id, nickname, avatar_url) values(new.id, new.nickname, new.avatar_url)
  on conflict(id) do update set nickname = excluded.nickname, avatar_url = excluded.avatar_url;
 end if;
 return new;
end;
$$;
revoke all on function public.sync_post_author() from public;
grant execute on function public.sync_post_author() to authenticated;
create trigger sync_post_author after insert or update of nickname, avatar_url on public.profiles for each row execute function public.sync_post_author();
