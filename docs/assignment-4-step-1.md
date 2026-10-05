# Assignment 4 — Step 1: AI generation

## Why this step comes first

Users need new AI content to vote on. The app now follows this chain:

1. A logged-in user selects a JPG, PNG, WebP, or GIF (up to 3 MB).
2. Gemini describes the visible photo.
3. Gemini uses that description and an optional creative direction to generate one funny caption.
4. The server uploads the photo to Supabase Storage and inserts the caption and generation metadata into the existing `captions` table.

GIF uploads retain the original animation in Storage and the collection. The server extracts up to three PNG snapshots (first, middle, last) for AI, since the image-input workflow does not directly accept GIF. The stored description prompt records the sampled frame indexes. GIFs are limited to 300 frames and 16 megapixels per frame; snapshots are resized to fit 768 × 768 pixels. Single-frame GIFs use one snapshot.

The image description is also the data we will search in a later step. No semantic search is involved.

## Where the changes live

- `app/create/page.tsx`: protects the page with the existing login/profile flow.
- `app/create/generate-form.tsx`: upload form, pending state, errors, and published result.
- `app/api/generate/route.ts`: validates login and the image, calls AI, uploads, and saves. It uses the user's Supabase session, not a privileged database key.
- `lib/gemini.ts`: model, both prompts, timeouts, and output validation. `GEMINI_API_KEY` stays on the server.
- `lib/caption-image.ts`: file signatures and GIF frame extraction using the pinned `sharp` dependency.
- `docs/generation-access.sql`: reference for the schema and RLS changes already applied to the connected database. Do not rerun it.
- Navigation now includes **Create**; the collection shows newest captions first.

## What is stored

| Column | Meaning |
| --- | --- |
| `caption` | AI caption output; existing field retained |
| `image_url` | Uploaded photo's public URL |
| `image_alt` | Description used for accessibility |
| `image_description` | First AI output, available for later keyword search |
| `description_prompt` | Exact text prompt used to describe the photo |
| `prompt` | Exact caption prompt, including the description and creative direction |
| `generation_model` | `gemini-3.8-flash` |
| `created_by` | Logged-in user's ID, derived by the server |
| `created_at` | Database timestamp |

Existing seed captions may have null generation metadata. They are preserved.

The new `caption-images` bucket serves public photos for the caption collection. Only signed-in users can upload into their own user-ID folder. They can read/delete their own object metadata for failed-save cleanup, through the Storage API. No overwrite policy is granted. Caption INSERT requires the authenticated user's ID and generation metadata; anonymous writes and writes with another author are rejected.

## Configuration

Keep `GEMINI_API_KEY` in the ignored `.env.local`, without a `NEXT_PUBLIC_` prefix. Restart the local server after changing it. On a hosted deployment, configure it separately in the host's server environment.

The Google project must remain on Free Tier to use its free quota. Model choice alone cannot enforce the Google project's billing tier. Submitted content on Free Tier may be used by Google to improve its products, as explained beside the upload field.

Official references: [pricing](https://ai.google.dev/gemini-api/docs/pricing), [model](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [image understanding](https://ai.google.dev/gemini-api/docs/image-understanding).

## How to test

1. Open `http://localhost:3000/create` in the browser where you normally log in.
2. Sign in and complete your name if prompted.
3. Choose a photo under 3 MB. Optionally enter `Finals week energy`.
4. Click **Generate & publish**. Expect a published confirmation, caption, and expandable image description.
5. Open **See it in the collection**. The new photo and caption should appear first. Refresh to confirm persistence.
6. In Supabase's `captions` table, inspect the latest row: `description_prompt`, `image_description`, `prompt`, `caption`, `generation_model`, and `created_by` should be populated.
7. In a private browser window, `/create` should redirect to login. An unauthenticated POST to `/api/generate` must return 401.
8. A photo over 3 MB should fail before generation; a Gemini quota error should produce a clear retry-later message.
9. Upload an animated GIF under 3 MB. It should publish successfully and continue animating in the collection. The stored `description_prompt` should identify the sampled GIF frame indexes. A corrupt GIF should show a readable error rather than call Gemini.

## Verification performed

- ESLint and TypeScript passed.
- Production build passed using Next's supported webpack compiler. Turbopack could not bind its compilation-worker port in the agent environment.
- Live Gemini image-description and caption calls both returned successfully for a synthetic test image.
- GIF checks verified three distinct ordered snapshots from a seven-frame moving-shape animation, single-frame GIF support, malformed GIF rejection, and unchanged original bytes. Live Gemini calls correctly described movement across the sampled frames and generated a caption. The `caption-images` bucket was checked to allow `image/gif` while retaining its 3 MB limit.
- Database checks in rolled-back transactions verified metadata saving, authenticated owner insertion, rejection of a spoofed author, rejection of anonymous insertion, own storage metadata access, and rejection of another user's storage path. No test rows were retained.
- The running app redirected anonymous `/create` visitors to login and rejected anonymous generation requests.
- The full signed-in browser upload/publish workflow still needs the user's test above.

The later Step 3 review resolved the `handle_new_user` trigger function's execute-grant notices. The password leak-protection notice remains relevant if password login is introduced; see `docs/assignment-4-step-3.md` for the current security review.

Do not move to voting until the signed-in upload/publish workflow has been verified.
