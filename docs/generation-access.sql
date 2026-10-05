-- Current schema reference after add_caption_generation and use_available_gemini_model.
-- Also includes allow_caption_gifs. Reference only: already applied to the connected project.
alter table public.captions
    add column image_description text,
    add column description_prompt text,
    add column prompt text,
    add column generation_model text,
    add column created_by uuid references auth.users(id) on delete set null;

create index captions_created_by_idx on public.captions(created_by);

alter table public.captions enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.captions from anon, authenticated;
grant select on public.captions to anon, authenticated;
grant insert (caption, image_url, image_alt, image_description, description_prompt, prompt, generation_model, created_by) on public.captions to authenticated;
grant usage on sequence public.captions_id_seq to authenticated;

create policy "Users publish own generated captions" on public.captions
    for insert to authenticated
    with check (
        (select auth.uid()) = created_by
        and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false'
        and image_description is not null and length(image_description) between 1 and 2000
        and description_prompt is not null and length(description_prompt) > 0
        and prompt is not null and length(prompt) > 0
        and generation_model = 'gemini-3.8-flash'
        and length(caption) between 1 and 240
        and image_url is not null
    );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('caption-images', 'caption-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

create policy "Users upload own caption images" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'caption-images'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false');
create policy "Users read own caption image metadata" on storage.objects
    for select to authenticated
    using (bucket_id = 'caption-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users clean up own caption images" on storage.objects
    for delete to authenticated
    using (bucket_id = 'caption-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
