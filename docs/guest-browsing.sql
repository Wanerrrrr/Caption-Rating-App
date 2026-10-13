create or replace function public.community_profile(p_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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

revoke execute on function public.community_profile(uuid) from anon;
