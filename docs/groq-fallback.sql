-- Additive, backwards-compatible Groq fallback support. No ledger reset.
alter table challenge_internal.api_calls add column provider text not null default 'gemini'
 check(provider in ('gemini','groq'));
create index api_calls_provider_time_idx on challenge_internal.api_calls(provider,called_at);
alter table public.captions add column description_model text
 check(description_model is null or description_model in ('gemini-3.8-flash','qwen/qwen3.8-27b'));
grant insert(description_model) on public.captions to authenticated;

create function public.acquire_provider_call(p_generation_id uuid,p_server_secret text,p_provider text)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=challenge_internal.require_user(); ts timestamptz; midnight timestamptz;
 minute_limit integer; day_limit integer;
begin
 perform challenge_internal.require_server(p_server_secret);
 if p_provider is null or p_provider not in ('gemini','groq') then raise exception 'Invalid AI provider'; end if;
 perform pg_advisory_xact_lock(74190321);
 ts:=clock_timestamp();
 if not exists(select 1 from challenge_internal.generations where id=p_generation_id and user_id=uid and state='pending' and expires_at>now()) then raise exception 'Generation reservation expired'; end if;
 -- Two stages, at most one attempt at each provider per stage.
 if (select count(*) from challenge_internal.api_calls where generation_id=p_generation_id and provider=p_provider)>=2 then raise exception 'Generation call limit reached'; end if;
 minute_limit:=case when p_provider='gemini' then 5 else 30 end;
 day_limit:=case when p_provider='gemini' then 20 else 1000 end;
 midnight := (ts at time zone 'America/Los_Angeles')::date::timestamp at time zone 'America/Los_Angeles';
 if (select count(*) from challenge_internal.api_calls where provider=p_provider and called_at>=midnight)>=day_limit then raise exception 'Daily AI capacity reached. Please try tomorrow'; end if;
 if (select count(*) from challenge_internal.api_calls where provider=p_provider and called_at>ts-interval '60 seconds')>=minute_limit then raise exception 'AI is busy. Please wait a minute and try again'; end if;
 insert into challenge_internal.api_calls(generation_id,called_at,provider) values(p_generation_id,ts,p_provider);
end $$;
revoke all on function public.acquire_provider_call(uuid,text,text) from public,anon;
grant execute on function public.acquire_provider_call(uuid,text,text) to authenticated;
-- Old deployments still call the Gemini-only function.
create or replace function public.acquire_generation_call(p_generation_id uuid,p_server_secret text)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.acquire_provider_call(p_generation_id,p_server_secret,'gemini');
end $$;
alter policy "Users publish own generated captions" on public.captions
 with check (
 (select auth.uid())=created_by
 and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
 and image_description is not null and length(image_description) between 1 and 2000
 and description_prompt is not null and length(description_prompt)>0
 and prompt is not null and length(prompt)>0
 and generation_model in ('gemini-3.8-flash','qwen/qwen3.8-27b')
 and length(caption) between 1 and 240 and image_url is not null
 );
