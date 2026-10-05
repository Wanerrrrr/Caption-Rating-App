-- Applied to the connected project as add_explore_like_counts. Reference only.
-- Read-only aggregate for Explore sorting. Individual votes remain owner-only.
alter table public.captions add column like_count bigint not null default 0 check (like_count >= 0);
create schema if not exists caption_internal;
revoke all on schema caption_internal from public, anon, authenticated;

create function caption_internal.sync_caption_like_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP in ('DELETE', 'UPDATE') then
    if OLD.vote = 1 then
      update public.captions set like_count = like_count - 1 where id = OLD.caption_id;
    end if;
  end if;
  if TG_OP in ('INSERT', 'UPDATE') then
    if NEW.vote = 1 then
      update public.captions set like_count = like_count + 1 where id = NEW.caption_id;
    end if;
  end if;
  return null;
end;
$$;
revoke all on function caption_internal.sync_caption_like_count() from public, anon, authenticated;
create trigger sync_caption_like_count after insert or delete or update of vote, caption_id
on public.caption_votes for each row execute function caption_internal.sync_caption_like_count();

update public.captions c set like_count = (
  select count(*) from public.caption_votes v where v.caption_id = c.id and v.vote = 1
);
-- No grants or RLS policies are broadened. Column-scoped INSERT grants exclude like_count.
