# Weekly challenge setup and operations

- The root `/` opens Explore for both signed-in visitors and guests. Weekly Challenge is opened explicitly at `/?view=challenge`; past rounds remain at `/?round=...`.
- First theme: **NYC Moments**. The host can schedule subsequent theme or fixed-image challenges at `/challenge/manage`. Challenge configuration is immutable after creation to keep entries fair.
- Each round starts Monday 00:00 America/New_York and ends the next Monday. One published entry per account; self-likes are allowed. Votes on contest entries freeze at the deadline everywhere, including Explore, Liked and original posts.
- Entries rank by final likes, submission time, then caption ID. Ranks 1, 2–4 and 5–14 earn 3, 2 and 1 credits respectively. Fewer participants means fewer awards. Zero-like entries remain eligible.
- Results and rewards settle transactionally on the first signed-in visit to Explore or Challenge after the deadline. Concurrent visits cannot issue duplicate rewards. This is lazy settlement, not a midnight cron job.
- Credits are free allowances and contest rewards only. There is no payment, recharge, purchase, or billing feature.
- Each Monday the balance resets to 10 weekly credits. Rewards accumulate without expiry; weekly credits are used first. Existing posts and historic generations do not consume the new allowance.
- A successful preview, including Regenerate, costs one credit. Publishing costs none. Failed generation refunds its reservation. A stopped or interrupted server request expires after five minutes and refunds when the user's balance is next read. Only one active generation is allowed per account.
- Global Gemini calls are gated transactionally at five per rolling minute and 20 per Pacific calendar day. Each generation calls Gemini twice. These counters cannot see external calls made outside this app, so other API usage can still exhaust provider quota. At capacity the request stops with a wait/try-tomorrow message; failed requests refund user credits but provider call attempts remain counted.

## Deployment

1. Review/apply `weekly-challenge.sql` to the connected Supabase project. Substitute `__SERVER_SECRET_SHA256__` with the SHA-256 hash of the local `CHALLENGE_SERVER_SECRET` (not the plaintext). The bootstrap checks that exactly one profile has the host's chosen nickname, Wanerrrrr, and records that account's immutable UUID as host.
2. Keep `CHALLENGE_SERVER_SECRET` in `.env.local` and add the same value as a **server-only** Vercel environment variable for the deployment environments using this database. Never prefix it with NEXT_PUBLIC, commit it, or print it. It protects the credit-reservation and completion RPCs from being called directly by browsers. The database stores only its hash in an unexposed schema.
3. Deploy the code. Existing regular-post publication remains compatible with the older deployment during rollout; all challenge entries require a completed server-authorized generation. The new generation endpoint enforces credits for both ordinary and challenge captions. Old preview tokens must be regenerated in the new deployment.
4. Verify signed-in Home, the host page, ordinary Create, and challenge Create. Use a real user-uploaded image for a final Gemini preview check, then confirm credit change/refund and explicit publication. Do not fabricate production users or auth claims to run tests.
5. Run Supabase security advisors after applying the migration. Public tables have RLS; clients have no balance/result write permission; internal functions cannot be called through the API. The scoped public definer RPCs verify signed-in identity and either host membership or a server-only credential before writing protected data.

## Checks

`node --test tests/weekly-challenge.test.mjs` exercises real route logic with offline provider/database stubs. It does not spend API quota or mutate production accounts. Also run lint, TypeScript, a production build and browser checks. After migration, inspect grants, RLS, trigger/function definitions and the actual owner balance. Reward/concurrency logic should additionally be verified in an isolated database before broad rollout; offline route tests cannot prove PostgreSQL locking behavior.

## Applied verification (2026-10-12)

The connected database migration is applied. NYC Moments runs Oct 12–19 at midnight New York time. Browser checks confirmed the actual host has 10 weekly credits and can open the challenge entry and host forms; desktop and mobile layouts were checked. The three new public tables have RLS, the internal schema is inaccessible to authenticated clients, and no unresolved secret placeholder remains.

Security advisors flag the seven deliberately privileged authenticated RPCs ([advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)). Their permissions are intentional: wallet reads/settlement verify signed-in identity, AI reservation/completion additionally require the server-only secret, and challenge creation requires host membership. The existing project warning for leaked-password protection predates this feature ([configuration documentation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)); no Auth settings were changed.

Vercel configuration and code deployment are still pending. No live Gemini request or real contest settlement was performed as part of these checks.


## Explore activity panel and inline challenge entry

OAuth success and saving completed profile details now redirect to `/explore`; both Caption Club wordmarks also link there. Required nickname/profile completion remains enforced before entering the signed-in feed.

Explore shows the current active challenge beneath the search bar, with medal rewards inside the yellow panel above the Enter challenge link. This opens the existing challenge page (`/?view=challenge`). With the activity panel above the feed, Explore uses one central scroll so the panel and posts fit naturally without clipping.

Challenge uses the same yellow panel and prize markup, without an entry button. A signed-in member who has not submitted sees the existing Generate → Review → Regenerate / Publish form directly below it, bound to the current challenge. For the current round, submissions appear only after the member has published; preview generation alone does not reveal them. The existing refresh after publication switches to the submitted state and lists every entry. Returning entrants see submissions immediately and cannot generate a second entry. Guests must sign in and publish to see current submissions. Finished-round results remain readable. This is a Challenge-page presentation rule; published challenge posts still participate in the public Explore feed.

Validation includes eight offline checks covering the pre/post-publication page states, guests, finished rounds, lookup errors, OAuth and profile-completion redirects. All 46 tests, lint, TypeScript and production build pass. Browser checks confirm the activity panel/prize placement, entry link, embedded generator, hidden pre-publication submissions and wordmark navigation. No live generation or real post publication was performed for this layout update.
