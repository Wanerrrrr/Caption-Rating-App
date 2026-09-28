# Caption photos

The ten existing captions use individually selected Pexels photographs, not generated images. Exact photo URLs, photographers, source pages, and alt text are recorded in `caption-image-sources.json` and in the connected Supabase `public.captions` rows.

License: https://www.pexels.com/license/

Images are served from Pexels' image CDN. Only URLs and attribution metadata are stored in the database; no binary images are stored in Postgres. The application shows a fallback if the external image is unavailable. Source links appear under each caption.

Remote migration applied: `add_caption_photo_metadata`:

```sql
alter table public.captions
  add column if not exists image_url text,
  add column if not exists image_alt text,
  add column if not exists image_source_url text,
  add column if not exists image_credit text,
  add column if not exists image_license text;
```

Existing caption text was preserved. Photo matching uses stable caption IDs, not display order. New captions without an image continue to render as text cards.
