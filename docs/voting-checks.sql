-- Run in the SQL Editor as the admin role. All test writes are rolled back.
-- Requires an existing auth user, a caption, and no vote for that pair yet.
begin;
select set_config('app.test_user_id', (select id::text from auth.users order by created_at limit 1), true);
select set_config('app.test_caption_id', (select id::text from public.captions order by id desc limit 1), true);
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('app.test_user_id'),'role','authenticated','is_anonymous',false)::text, true);
set local role authenticated;
do $$
declare saved_id uuid;
begin
    insert into public.caption_votes(caption_id,user_id,vote)
    values(current_setting('app.test_caption_id')::bigint,auth.uid(),1) returning id into saved_id;
    perform set_config('app.test_vote_id',saved_id::text,true);
    if not exists(select 1 from public.caption_votes where id=saved_id and vote=1) then
        raise exception 'Own vote was not readable';
    end if;
    begin
        insert into public.caption_votes(caption_id,user_id,vote)
        values(current_setting('app.test_caption_id')::bigint,auth.uid(),-1);
        raise exception 'Duplicate vote was allowed';
    exception when unique_violation then null;
    end;
    begin
        insert into public.caption_votes(caption_id,user_id,vote)
        values(current_setting('app.test_caption_id')::bigint,auth.uid(),0);
        raise exception 'Invalid vote was allowed';
    exception when check_violation then null;
    end;
    begin
        insert into public.caption_votes(caption_id,user_id,vote)
        values(9223372036854775807,auth.uid(),1);
        raise exception 'Missing caption was allowed';
    exception when foreign_key_violation then null;
    end;
    begin
        insert into public.caption_votes(caption_id,user_id,vote)
        values(current_setting('app.test_caption_id')::bigint,'00000000-0000-0000-0000-000000000000',1);
        raise exception 'Spoofed user was allowed';
    exception when insufficient_privilege then null;
    end;
    begin
        update public.caption_votes set vote=-1 where id=saved_id;
        raise exception 'Vote update was allowed';
    exception when insufficient_privilege then null;
    end;
    begin
        delete from public.caption_votes where id=saved_id;
        raise exception 'Vote deletion was allowed';
    exception when insufficient_privilege then null;
    end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000000','role','authenticated','is_anonymous',false)::text,true);
do $$ begin
    if exists(select 1 from public.caption_votes where id=current_setting('app.test_vote_id')::uuid) then
        raise exception 'Another user could read the vote';
    end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.test_user_id'),'role','authenticated','is_anonymous',true)::text,true);
do $$ begin
    if exists(select 1 from public.caption_votes where id=current_setting('app.test_vote_id')::uuid) then
        raise exception 'Anonymous auth user could read the vote';
    end if;
    begin
        insert into public.caption_votes(caption_id,user_id,vote)
        values(current_setting('app.test_caption_id')::bigint,auth.uid(),1);
        raise exception 'Anonymous auth user could insert a vote';
    exception when insufficient_privilege then null;
    end;
end $$;
set local role anon;
do $$ begin
    begin
        perform 1 from public.caption_votes;
        raise exception 'Signed-out user could read votes';
    exception when insufficient_privilege then null;
    end;
    begin
        insert into public.caption_votes(caption_id,user_id,vote)
        values(current_setting('app.test_caption_id')::bigint,current_setting('app.test_user_id')::uuid,1);
        raise exception 'Signed-out user could insert a vote';
    exception when insufficient_privilege then null;
    end;
end $$;
rollback;
