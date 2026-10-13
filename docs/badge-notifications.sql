-- Existing earned badges are the baseline; only future unlocks need a popup.
alter table challenge_internal.member_badges add column notified_at timestamptz;
update challenge_internal.member_badges set notified_at=now();

create function public.my_new_badges() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=challenge_internal.require_user(); result jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('id',badge_id,'earnedAt',earned_at) order by earned_at,badge_id),'[]'::jsonb)
 into result from challenge_internal.member_badges where user_id=uid and notified_at is null;
 return result;
end $$;
create function public.acknowledge_badge(p_badge_id text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=challenge_internal.require_user();
begin
 update challenge_internal.member_badges set notified_at=coalesce(notified_at,now()) where user_id=uid and badge_id=p_badge_id;
 if not found then raise exception 'Badge not earned'; end if;
end $$;
revoke all on function public.my_new_badges(),public.acknowledge_badge(text) from public,anon;
grant execute on function public.my_new_badges(),public.acknowledge_badge(text) to authenticated;
