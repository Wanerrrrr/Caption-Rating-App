-- Run as the database admin in the SQL Editor. Requires an existing caption.
-- All fixture users, profiles, votes and object metadata are rolled back.
-- Does not advance the caption sequence or create Storage files.
begin;
select set_config('app.rls_user_a',gen_random_uuid()::text,true);
select set_config('app.rls_user_b',gen_random_uuid()::text,true);
select set_config('app.rls_caption_id',(select min(id)::text from public.captions),true);

-- Exercise the real signup trigger with temporary users as the database admin.
insert into auth.users(id,aud,role,raw_app_meta_data,raw_user_meta_data)
values (current_setting('app.rls_user_a')::uuid,'authenticated','authenticated','{}','{}'),
       (current_setting('app.rls_user_b')::uuid,'authenticated','authenticated','{}','{}');
do $$ begin
    if (select count(*) from public.profiles where id in (current_setting('app.rls_user_a')::uuid,current_setting('app.rls_user_b')::uuid)) <> 2 then
        raise exception 'Signup trigger did not create both profiles';
    end if;
    if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relkind='r' and not c.relrowsecurity) then
        raise exception 'A public table has RLS disabled';
    end if;
    if not has_function_privilege('supabase_auth_admin','public.handle_new_user()','EXECUTE') then
        raise exception 'Auth service signup permission missing';
    end if;
    if has_function_privilege('anon','public.handle_new_user()','EXECUTE')
       or has_function_privilege('authenticated','public.handle_new_user()','EXECUTE') then
        raise exception 'Clients can execute the signup function';
    end if;
    if has_sequence_privilege('anon','public.captions_id_seq','USAGE')
       or has_sequence_privilege('authenticated','public.captions_id_seq','UPDATE') then
        raise exception 'Sequence permissions too broad';
    end if;
    if not has_sequence_privilege('authenticated','public.captions_id_seq','USAGE')
       or not has_column_privilege('authenticated','public.captions','caption','INSERT') then
        raise exception 'Generation permissions missing';
    end if;
end $$;

select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.rls_user_a'),'role','authenticated','is_anonymous',false)::text,true);
set local role authenticated;
do $$ declare affected integer; table_name text; begin
    if (select count(*) from public.profiles) <> 1 then raise exception 'Profile read isolation failed'; end if;
    update public.profiles set first_name='RLS',last_name='Verification',updated_at=now()
        where id=auth.uid();
    get diagnostics affected=row_count;
    if affected <> 1 then raise exception 'Own profile update failed'; end if;
    update public.profiles set first_name='Not allowed' where id=current_setting('app.rls_user_b')::uuid;
    get diagnostics affected=row_count;
    if affected <> 0 then raise exception 'Other profile update was allowed'; end if;
    begin
        update public.profiles set id=current_setting('app.rls_user_b')::uuid where id=auth.uid();
        raise exception 'Profile ownership reassignment allowed';
    exception when insufficient_privilege then null;
    end;
    begin
        update public.profiles set created_at=now() where id=auth.uid();
        raise exception 'Profile creation timestamp edit allowed';
    exception when insufficient_privilege then null;
    end;
    begin
        insert into public.profiles(id) values(gen_random_uuid());
        raise exception 'Direct profile insertion allowed';
    exception when insufficient_privilege then null;
    end;
    foreach table_name in array array['profiles','captions','caption_votes'] loop
        begin
            execute format('delete from public.%I where false',table_name);
            raise exception 'Client delete grant exists for %',table_name;
        exception when insufficient_privilege then null;
        end;
    end loop;
    begin
        update public.captions set caption='Not allowed' where false;
        raise exception 'Caption update grant exists';
    exception when insufficient_privilege then null;
    end;
    begin
        perform public.handle_new_user();
        raise exception 'Client signup function call allowed';
    exception when insufficient_privilege then null;
    end;
    insert into public.caption_votes(caption_id,user_id,vote)
        values(current_setting('app.rls_caption_id')::bigint,auth.uid(),1);
    if (select count(*) from public.caption_votes) <> 1 then raise exception 'Own vote read failed'; end if;
    insert into storage.objects(bucket_id,name,owner_id) values
        ('avatars',auth.uid()::text||'/rls-check.png',auth.uid()::text),
        ('caption-images',auth.uid()::text||'/rls-check.png',auth.uid()::text);
    if (select count(*) from storage.objects where name=auth.uid()::text||'/rls-check.png' and bucket_id='caption-images') <> 1 then
        raise exception 'Own caption image metadata read failed';
    end if;
    begin
        insert into storage.objects(bucket_id,name) values('avatars',current_setting('app.rls_user_b')||'/rls-check.png');
        raise exception 'Foreign avatar upload allowed';
    exception when insufficient_privilege then null;
    end;
    begin
        insert into storage.objects(bucket_id,name) values('caption-images',current_setting('app.rls_user_b')||'/rls-check.png');
        raise exception 'Foreign caption image upload allowed';
    exception when insufficient_privilege then null;
    end;
    update storage.objects set metadata='{}' where name=auth.uid()::text||'/rls-check.png';
    get diagnostics affected=row_count;
    if affected <> 0 then raise exception 'Storage overwrite allowed'; end if;
end $$;

select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.rls_user_b'),'role','authenticated','is_anonymous',false)::text,true);
do $$ begin
    if exists(select 1 from public.profiles where id=current_setting('app.rls_user_a')::uuid) then raise exception 'Other profile visible'; end if;
    if exists(select 1 from public.caption_votes where user_id=current_setting('app.rls_user_a')::uuid) then raise exception 'Other votes visible'; end if;
    if exists(select 1 from storage.objects where name=current_setting('app.rls_user_a')||'/rls-check.png') then raise exception 'Other object metadata visible'; end if;
end $$;

select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.rls_user_a'),'role','authenticated','is_anonymous',true)::text,true);
do $$ declare affected integer; bucket text; begin
    if exists(select 1 from public.profiles) or exists(select 1 from public.caption_votes) then raise exception 'Anonymous auth user read private data'; end if;
    update public.profiles set first_name='Not allowed' where id=auth.uid();
    get diagnostics affected=row_count;
    if affected <> 0 then raise exception 'Anonymous auth profile edit allowed'; end if;
    foreach bucket in array array['avatars','caption-images'] loop
        begin
            insert into storage.objects(bucket_id,name) values(bucket,auth.uid()::text||'/anonymous-check.png');
            raise exception 'Anonymous auth upload allowed';
        exception when insufficient_privilege then null;
        end;
    end loop;
    begin
        insert into public.caption_votes(caption_id,user_id,vote) values(current_setting('app.rls_caption_id')::bigint,auth.uid(),-1);
        raise exception 'Anonymous auth vote allowed';
    exception when insufficient_privilege then null;
    end;
end $$;

set local role anon;
do $$ declare table_name text; begin
    perform 1 from public.captions limit 1;
    foreach table_name in array array['profiles','caption_votes'] loop
        begin
            execute format('select 1 from public.%I limit 1',table_name);
            raise exception 'Signed-out private table read allowed';
        exception when insufficient_privilege then null;
        end;
    end loop;
    begin
        insert into public.captions(caption) values('Not allowed');
        raise exception 'Signed-out caption insertion allowed';
    exception when insufficient_privilege then null;
    end;
    begin
        insert into public.caption_votes(caption_id,user_id,vote) values(current_setting('app.rls_caption_id')::bigint,current_setting('app.rls_user_a')::uuid,1);
        raise exception 'Signed-out vote allowed';
    exception when insufficient_privilege then null;
    end;
    begin
        insert into storage.objects(bucket_id,name) values('avatars',current_setting('app.rls_user_a')||'/signed-out-check.png');
        raise exception 'Signed-out upload allowed';
    exception when insufficient_privilege then null;
    end;
end $$;
rollback;
