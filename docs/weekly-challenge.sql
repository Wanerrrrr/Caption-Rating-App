-- Replace __SERVER_SECRET_SHA256__ during setup. Never store plaintext secrets here.
create schema if not exists challenge_internal;
revoke all on schema challenge_internal from public, anon, authenticated;
create table challenge_internal.settings (id boolean primary key default true check(id), server_secret_hash text not null);
insert into challenge_internal.settings values (true, '__SERVER_SECRET_SHA256__');
create table challenge_internal.admins (user_id uuid primary key references auth.users(id) on delete cascade);
do $$ begin if (select count(*) from public.profiles where nickname='Wanerrrrr')<>1 then raise exception 'Confirm the challenge host account before setup'; end if; end $$;
insert into challenge_internal.admins select id from public.profiles where nickname='Wanerrrrr';
create table public.weekly_challenges (
 id uuid primary key default gen_random_uuid(), title text not null check(char_length(title) between 1 and 80),
 theme text not null check(char_length(theme) between 1 and 300), image_url text,
 week_start date not null unique check(extract(isodow from week_start)=1),
 starts_at timestamptz not null, ends_at timestamptz not null check(ends_at>starts_at), settled_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.challenge_entries (
 id uuid primary key default gen_random_uuid(), challenge_id uuid not null references public.weekly_challenges(id),
 caption_id bigint not null unique references public.captions(id), user_id uuid not null references auth.users(id),
 submitted_at timestamptz not null default now(), final_likes bigint, rank integer, reward integer,
 unique(challenge_id,user_id)
);
create table public.generation_wallets (
 user_id uuid primary key references auth.users(id) on delete cascade,
 week_start date not null, weekly_used integer not null default 0 check(weekly_used between 0 and 10),
 bonus integer not null default 0 check(bonus>=0)
);
create table challenge_internal.generations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 challenge_id uuid references public.weekly_challenges(id), week_start date not null,
 source text not null check(source in ('weekly','bonus')),
 state text not null default 'pending' check(state in ('pending','completed','failed','expired')),
 expires_at timestamptz not null default now()+interval '5 minutes', created_at timestamptz not null default now()
);
create index generations_user_state_idx on challenge_internal.generations(user_id,state);
create table challenge_internal.api_calls (generation_id uuid not null references challenge_internal.generations(id), called_at timestamptz not null default clock_timestamp());
create index api_calls_time_idx on challenge_internal.api_calls(called_at);
alter table public.captions add column challenge_id uuid references public.weekly_challenges(id);
alter table public.captions add column generation_id uuid unique references challenge_internal.generations(id);
create index captions_challenge_idx on public.captions(challenge_id);
create index challenge_entries_user_idx on public.challenge_entries(user_id);
alter table public.weekly_challenges enable row level security;
alter table public.challenge_entries enable row level security;
alter table public.generation_wallets enable row level security;
grant select on public.weekly_challenges, public.challenge_entries to anon, authenticated;
revoke insert, update, delete on public.weekly_challenges, public.challenge_entries, public.generation_wallets from anon, authenticated;
grant select on public.generation_wallets to authenticated;
grant insert(challenge_id,generation_id) on public.captions to authenticated;
create policy "Challenges are readable" on public.weekly_challenges for select to anon,authenticated using(true);
create policy "Entries are readable" on public.challenge_entries for select to anon,authenticated using(true);
create policy "Own generation balance" on public.generation_wallets for select to authenticated using((select auth.uid())=user_id);

-- These narrowly scoped definer functions own the protected ledger. Clients must
-- never receive write grants on balances, reservations, results or rewards.
create function challenge_internal.require_user() returns uuid language plpgsql security invoker set search_path='' as $$
declare uid uuid := auth.uid();
begin
 if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in to continue'; end if;
 return uid;
end $$;
create function challenge_internal.require_server(secret text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if secret is null or not exists(select 1 from challenge_internal.settings where server_secret_hash=encode(extensions.digest(secret,'sha256'),'hex')) then raise exception 'Server authorization required'; end if;
end $$;
create function challenge_internal.prepare_wallet(uid uuid) returns void language plpgsql security invoker set search_path='' as $$
declare wk date := date_trunc('week',now() at time zone 'America/New_York')::date; r record;
begin
 insert into public.generation_wallets(user_id,week_start) values(uid,wk) on conflict(user_id) do nothing;
 perform 1 from public.generation_wallets where user_id=uid for update;
 update public.generation_wallets set week_start=wk,weekly_used=0 where user_id=uid and week_start<>wk;
 for r in select * from challenge_internal.generations where user_id=uid and state='pending' and expires_at<=now() for update loop
  update challenge_internal.generations set state='expired' where id=r.id;
  update public.generation_wallets set bonus=bonus+case when r.source='bonus' then 1 else 0 end,
   weekly_used=weekly_used-case when r.source='weekly' and r.week_start=wk then 1 else 0 end where user_id=uid;
 end loop;
end $$;
create function public.generation_balance() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := challenge_internal.require_user(); result jsonb;
begin
 perform challenge_internal.prepare_wallet(uid);
 select jsonb_build_object('weekly',10-weekly_used,'bonus',bonus,'total',10-weekly_used+bonus,'resetsAt',(week_start+7)::timestamp at time zone 'America/New_York') into result from public.generation_wallets where user_id=uid;
 return result;
end $$;
create function public.reserve_generation(p_server_secret text,p_challenge_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid := challenge_internal.require_user(); wallet public.generation_wallets; rid uuid; src text; ch public.weekly_challenges;
begin
 perform challenge_internal.require_server(p_server_secret);
 if not exists(select 1 from public.profiles where id=uid and nickname is not null) then raise exception 'Choose a nickname before generating'; end if;
 if p_challenge_id is not null then
  select * into ch from public.weekly_challenges where id=p_challenge_id for share;
  if ch.id is null or now()<ch.starts_at or now()>=ch.ends_at or ch.settled_at is not null then raise exception 'This challenge is not open'; end if;
  if exists(select 1 from public.challenge_entries where challenge_id=p_challenge_id and user_id=uid) then raise exception 'You already entered this challenge'; end if;
 end if;
 perform challenge_internal.prepare_wallet(uid);
 if exists(select 1 from challenge_internal.generations where user_id=uid and state='pending') then raise exception 'A generation is already in progress'; end if;
 select * into wallet from public.generation_wallets where user_id=uid;
 if wallet.weekly_used<10 then src:='weekly'; update public.generation_wallets set weekly_used=weekly_used+1 where user_id=uid;
 elsif wallet.bonus>0 then src:='bonus'; update public.generation_wallets set bonus=bonus-1 where user_id=uid;
 else raise exception 'No generation credits left. Your weekly credits reset on Monday'; end if;
 insert into challenge_internal.generations(user_id,challenge_id,week_start,source) values(uid,p_challenge_id,wallet.week_start,src) returning id into rid;
 return rid;
end $$;
create function public.acquire_generation_call(p_generation_id uuid,p_server_secret text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=challenge_internal.require_user(); ts timestamptz:=clock_timestamp(); midnight timestamptz;
begin
 perform challenge_internal.require_server(p_server_secret);
 perform pg_advisory_xact_lock(74190321);
 ts:=clock_timestamp();
 if not exists(select 1 from challenge_internal.generations where id=p_generation_id and user_id=uid and state='pending' and expires_at>now()) then raise exception 'Generation reservation expired'; end if;
 if (select count(*) from challenge_internal.api_calls where generation_id=p_generation_id)>=2 then raise exception 'Generation call limit reached'; end if;
 midnight := (ts at time zone 'America/Los_Angeles')::date::timestamp at time zone 'America/Los_Angeles';
 if (select count(*) from challenge_internal.api_calls where called_at>=midnight)>=20 then raise exception 'Daily AI capacity reached. Please try tomorrow'; end if;
 if (select count(*) from challenge_internal.api_calls where called_at>ts-interval '60 seconds')>=5 then raise exception 'AI is busy. Please wait a minute and try again'; end if;
 insert into challenge_internal.api_calls(generation_id,called_at) values(p_generation_id,ts);
end $$;
create function public.finish_generation(p_generation_id uuid,p_success boolean,p_server_secret text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=challenge_internal.require_user(); r challenge_internal.generations; wk date;
begin
 perform challenge_internal.require_server(p_server_secret);
 perform challenge_internal.prepare_wallet(uid);
 select * into r from challenge_internal.generations where id=p_generation_id and user_id=uid for update;
 if r.id is null then raise exception 'Unknown generation reservation'; end if;
 if r.state='pending' then
  update challenge_internal.generations set state=case when p_success then 'completed' else 'failed' end where id=r.id;
  if not p_success then
   select week_start into wk from public.generation_wallets where user_id=uid;
   update public.generation_wallets set bonus=bonus+case when r.source='bonus' then 1 else 0 end,
    weekly_used=weekly_used-case when r.source='weekly' and r.week_start=wk then 1 else 0 end where user_id=uid;
  end if;
 elsif p_success and r.state<>'completed' then raise exception 'Generation reservation expired'; end if;
 return public.generation_balance();
end $$;
create function public.is_challenge_admin() returns boolean language sql security definer set search_path='' as $$
 select auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false) and exists(select 1 from challenge_internal.admins where user_id=auth.uid());
$$;
create function public.create_weekly_challenge(p_title text,p_theme text,p_week date,p_image_url text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=challenge_internal.require_user(); rid uuid; st timestamptz; en timestamptz;
begin
 if not public.is_challenge_admin() then raise exception 'Only the challenge host can create a challenge'; end if;
 st:=p_week::timestamp at time zone 'America/New_York'; en:=(p_week+7)::timestamp at time zone 'America/New_York';
 if extract(isodow from p_week)<>1 or en<=now() then raise exception 'Choose the Monday of a current or future week'; end if;
 if p_image_url is not null and p_image_url not like 'https://yczmsejrxftobrxwnbnv.supabase.co/storage/v1/object/public/caption-images/'||uid::text||'/%' then raise exception 'Upload a challenge image first'; end if;
 insert into public.weekly_challenges(title,theme,image_url,week_start,starts_at,ends_at) values(trim(p_title),trim(p_theme),p_image_url,p_week,st,en) returning id into rid;
 return rid;
end $$;
create function public.settle_weekly_challenges() returns integer language plpgsql security definer set search_path='' as $$
declare uid uuid:=challenge_internal.require_user(); ch record; e record; reward_count integer:=0;
begin
 for ch in select * from public.weekly_challenges where ends_at<=now() and settled_at is null order by week_start for update loop
  for e in select entries.*,c.like_count,row_number() over(order by c.like_count desc,entries.submitted_at asc,entries.caption_id asc)::integer as position
   from public.challenge_entries entries join public.captions c on c.id=entries.caption_id where entries.challenge_id=ch.id loop
   update public.challenge_entries set final_likes=e.like_count,rank=e.position,reward=case when e.position=1 then 3 when e.position<=4 then 2 when e.position<=14 then 1 else 0 end where id=e.id;
   if e.position<=14 then
    -- Lock wallets in the same order as reserve/refund; only this settlement writes rewards.
    perform challenge_internal.prepare_wallet(e.user_id);
    update public.generation_wallets set bonus=bonus+case when e.position=1 then 3 when e.position<=4 then 2 else 1 end where user_id=e.user_id;
    reward_count:=reward_count+1;
   end if;
  end loop;
  update public.weekly_challenges set settled_at=now() where id=ch.id;
 end loop;
 return reward_count;
end $$;
-- A client cannot publish a forged entry, reuse a generation, or enter twice.
create function challenge_internal.validate_publication() returns trigger language plpgsql security definer set search_path='' as $$
declare uid uuid:=challenge_internal.require_user(); r challenge_internal.generations; ch public.weekly_challenges;
begin
 -- Keep already-deployed regular-post publishing compatible during rollout.
 -- Challenge entries always require a server-completed generation reservation.
 if new.generation_id is null and new.challenge_id is null then return new; end if;
 if new.created_by is distinct from uid then raise exception 'Publish only your own caption'; end if;
 select * into r from challenge_internal.generations where id=new.generation_id and user_id=uid and state='completed';
 if r.id is null then raise exception 'Generate a new preview before publishing'; end if;
 if new.challenge_id is distinct from r.challenge_id then raise exception 'Challenge does not match this preview'; end if;
 if new.challenge_id is not null then
  select * into ch from public.weekly_challenges where id=new.challenge_id for share;
  if now()<ch.starts_at or now()>=ch.ends_at or ch.settled_at is not null then raise exception 'This challenge has closed'; end if;
  insert into public.challenge_entries(challenge_id,caption_id,user_id) values(new.challenge_id,new.id,uid);
 end if;
 return new;
end $$;
-- Entry creation must run AFTER the caption exists, for the caption foreign key.
create trigger validate_generation_publication after insert on public.captions for each row execute function challenge_internal.validate_publication();
create function challenge_internal.lock_challenge_vote() returns trigger language plpgsql security definer set search_path='' as $$
declare cid bigint; ch public.weekly_challenges;
begin
 perform challenge_internal.require_user();
 if (case when TG_OP='DELETE' then old.user_id else new.user_id end) is distinct from auth.uid() then raise exception 'Vote only as yourself'; end if;
 cid:=case when TG_OP='DELETE' then old.caption_id else new.caption_id end;
 select challenges.* into ch from public.weekly_challenges challenges join public.challenge_entries e on e.challenge_id=challenges.id where e.caption_id=cid for share of challenges;
 if ch.id is not null and (now()<ch.starts_at or now()>=ch.ends_at or ch.settled_at is not null) then raise exception 'Voting for this challenge has closed'; end if;
 if TG_OP='DELETE' then return old; else return new; end if;
end $$;
create trigger lock_challenge_votes before insert or update or delete on public.caption_votes for each row execute function challenge_internal.lock_challenge_vote();
-- Internal functions are never API endpoints. Public entrypoints explicitly check identity.
revoke all on all functions in schema challenge_internal from public,anon,authenticated;
revoke all on function public.generation_balance(),public.reserve_generation(text,uuid),public.acquire_generation_call(uuid,text),public.finish_generation(uuid,boolean,text),public.is_challenge_admin(),public.create_weekly_challenge(text,text,date,text),public.settle_weekly_challenges() from public,anon;
grant execute on function public.generation_balance(),public.reserve_generation(text,uuid),public.acquire_generation_call(uuid,text),public.finish_generation(uuid,boolean,text),public.is_challenge_admin(),public.create_weekly_challenge(text,text,date,text),public.settle_weekly_challenges() to authenticated;

-- Bootstrap the first week; future weeks are created by the host UI.
insert into public.weekly_challenges(title,theme,week_start,starts_at,ends_at)
select 'NYC Moments','Find the funny side of New York City. Caption a subway moment, a city surprise, or your everyday NYC life.',wk,wk::timestamp at time zone 'America/New_York',(wk+7)::timestamp at time zone 'America/New_York'
from (select date_trunc('week',now() at time zone 'America/New_York')::date as wk) w;
