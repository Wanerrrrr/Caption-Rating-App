-- Public profiles expose only the nickname/avatar already chosen for posts.
create table challenge_internal.user_follows (
 follower_id uuid not null references auth.users(id) on delete cascade,
 followed_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_id,followed_id), check(follower_id<>followed_id)
);
create index user_follows_followed_idx on challenge_internal.user_follows(followed_id);
create table challenge_internal.member_badges (
 user_id uuid not null references auth.users(id) on delete cascade,
 badge_id text not null check(badge_id in ('first-post','ten-posts','first-like','ten-likes','ten-received','fifty-received','challenger','winner','five-followers')),
 earned_at timestamptz not null default now(), displayed boolean not null default false,
 primary key(user_id,badge_id)
);
alter table challenge_internal.user_follows enable row level security;
alter table challenge_internal.member_badges enable row level security;
revoke all on challenge_internal.user_follows,challenge_internal.member_badges from public,anon,authenticated;
create function public.community_profile(p_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare person record; posts bigint; given bigint; received bigint; following bigint; followers bigint; entries bigint; wins bigint; own boolean:=auth.uid()=p_user_id; earned jsonb;
begin
 perform challenge_internal.require_user();
 select nickname,avatar_url into person from public.profiles where id=p_user_id and nickname is not null;
 if not found then return null; end if;
 select count(*),coalesce(sum(like_count),0) into posts,received from public.captions where created_by=p_user_id;
 select count(*) into given from public.caption_votes where user_id=p_user_id and vote=1;
 select count(*) into following from challenge_internal.user_follows where follower_id=p_user_id;
 select count(*) into followers from challenge_internal.user_follows where followed_id=p_user_id;
 select count(*),count(*) filter(where rank between 1 and 14 and reward>0) into entries,wins from public.challenge_entries where user_id=p_user_id;
 insert into challenge_internal.member_badges(user_id,badge_id)
 select p_user_id,badge from (values ('first-post',posts>=1),('ten-posts',posts>=10),('first-like',given>=1),('ten-likes',given>=10),('ten-received',received>=10),('fifty-received',received>=50),('challenger',entries>=1),('winner',wins>=1),('five-followers',followers>=5)) rules(badge,achieved)
 where achieved on conflict do nothing;
 select coalesce(jsonb_agg(jsonb_build_object('id',badge_id,'earnedAt',earned_at,'displayed',displayed) order by earned_at),'[]'::jsonb) into earned from challenge_internal.member_badges where user_id=p_user_id and (coalesce(own,false) or displayed);
 return jsonb_build_object('id',p_user_id,'nickname',person.nickname,'avatar_url',person.avatar_url,'posts',posts,'likes',received,'following',following,'followers',followers,'isFollowing',exists(select 1 from challenge_internal.user_follows where follower_id=auth.uid() and followed_id=p_user_id),'badges',earned,'progress',case when own then jsonb_build_object('posts',posts,'given',given,'received',received,'entries',entries,'wins',wins,'followers',followers) else null end);
end $$;
create function public.set_member_follow(p_user_id uuid,p_follow boolean) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=challenge_internal.require_user();
begin
 if uid=p_user_id then raise exception 'You cannot follow yourself'; end if;
 if not exists(select 1 from public.profiles where id=p_user_id and nickname is not null) then raise exception 'Member not found'; end if;
 if p_follow then insert into challenge_internal.user_follows(follower_id,followed_id) values(uid,p_user_id) on conflict do nothing;
 else delete from challenge_internal.user_follows where follower_id=uid and followed_id=p_user_id; end if;
end $$;
create function public.my_member_connections(p_kind text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=challenge_internal.require_user(); result jsonb;
begin
 if p_kind not in ('following','followers') then raise exception 'Invalid connection list'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nickname',p.nickname,'avatar_url',p.avatar_url) order by f.created_at desc),'[]'::jsonb) into result
 from challenge_internal.user_follows f join public.profiles p on p.id=case when p_kind='following' then f.followed_id else f.follower_id end
 where case when p_kind='following' then f.follower_id=uid else f.followed_id=uid end;
 return result;
end $$;
create function public.set_displayed_badge(p_badge_id text,p_displayed boolean) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=challenge_internal.require_user();
begin
 perform public.community_profile(uid);
 update challenge_internal.member_badges set displayed=p_displayed where user_id=uid and badge_id=p_badge_id;
 if not found then raise exception 'Earn this badge before displaying it'; end if;
end $$;
revoke all on function public.community_profile(uuid),public.set_member_follow(uuid,boolean),public.my_member_connections(text),public.set_displayed_badge(text,boolean) from public,anon,authenticated;
grant execute on function public.community_profile(uuid) to authenticated;
grant execute on function public.set_member_follow(uuid,boolean),public.my_member_connections(text),public.set_displayed_badge(text,boolean) to authenticated;
