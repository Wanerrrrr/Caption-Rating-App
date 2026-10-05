# Assignment 4 — Step 2: Voting

## Why this step

Users can now rate captions. Each first vote inserts a row into Supabase, meeting the assignment's data-mutation requirement. A database uniqueness constraint ensures one vote per user per caption, including concurrent clicks from multiple tabs.

## Where it lives

- `app/votes/actions.ts`: the Server Action validates caption ID and vote, verifies the user with `getUser()`, derives `user_id` from authentication, inserts the vote, and revalidates the collection.
- `app/components/vote-buttons.tsx`: Like/Pass buttons, saving/error feedback, and the user's selected vote. Once saved, both buttons are disabled.
- `app/page.tsx`: loads the signed-in user's existing votes and renders controls on each caption.
- `app/globals.css`: button and selected-state styling.
- `docs/voting-access.sql`: reference for the `add_caption_votes` migration already applied to the connected project; do not rerun it.
- `docs/voting-checks.sql`: repeatable database permission/constraint checks; all writes roll back. Requires an existing user/caption pair without a saved vote.

## Data and permissions

`caption_votes` stores a UUID `id`, `caption_id`, `user_id`, `vote` (1 or -1), and `created_at`. Caption IDs match the existing bigint keys. `(caption_id, user_id)` is unique. Each referenced caption and auth user must exist.

RLS is enabled immediately. Signed-in, non-anonymous users can insert votes as themselves and read their own votes. They cannot insert votes under another user's ID, read another user's individual votes, update/delete votes, or override the generated ID/timestamp. Signed-out visitors cannot read or insert vote rows. This first version records a permanent choice; changing a vote is not offered.

The page displays the user's own selection. Public vote totals will require a separate aggregation design if added later.

## How to test

1. Open the collection while signed in.
2. Choose a caption you have not rated and click Like or Pass.
3. Expect a saved confirmation and a selected, disabled button. Both choices should become disabled.
4. Refresh: the same choice should remain selected.
5. In Supabase, inspect `caption_votes`. There should be one row with the correct `caption_id`, your user ID, and vote of 1 or -1.
6. Try the same caption from another tab: only one row should exist for that user/caption pair. If a stale tab submits, it receives the original saved choice.
7. Signed-out visitors are redirected to login by the existing collection flow; the Server Action independently verifies login, and database grants/RLS also block writes without login.

## Verification

ESLint, TypeScript, and the production webpack build passed. Rolled-back database tests confirmed valid insertion and own-row reads; duplicate, invalid-value, nonexistent-caption, spoofed-user, anonymous-auth-user, signed-out, update, delete, and cross-user-read checks all passed. No caption IDs were consumed by these tests. See `docs/assignment-4-step-3.md` for the completed security review and remaining password-protection notice.

The browser verification saved an upvote on caption 16. That one real vote is retained so the saved state can be reviewed in the UI and Supabase.
