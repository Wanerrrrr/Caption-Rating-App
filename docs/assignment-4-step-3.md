# Assignment 4 — Step 3: RLS and least-privilege review

## What changed and why

All three application tables already had RLS enabled. This step narrowed the underlying SQL grants as well as the policies, so access is limited even if a client bypasses the app's buttons and calls Supabase directly.

- `profiles`: signed-out users have no table privileges. Signed-in, non-anonymous users can select only their own row and update only `first_name`, `last_name`, `avatar_url`, and `updated_at`. Clients cannot insert/delete profiles, reassign IDs, or change `created_at`.
- `captions`: public read access remains intentional for published content. Only signed-in, non-anonymous users can insert their own generated captions with the required metadata. Client UPDATE/DELETE privileges are absent.
- `caption_votes`: only signed-in, non-anonymous users can insert/read their own votes. The unique user/caption constraint prevents repeated votes. UPDATE/DELETE privileges are absent.
- `captions_id_seq`: anonymous access and client `setval`/UPDATE access were removed; authenticated USAGE remains for caption creation.
- `storage.objects`: avatar and caption-image uploads are restricted to the user's own folder, and anonymous Auth users cannot upload. Caption-image metadata reads and failed-save cleanup also require ownership and a non-anonymous user. Clients have no matching overwrite/update policy.
- `handle_new_user()`: ordinary users and PUBLIC can no longer execute the function directly. Supabase's auth service retains execution permission. The existing trigger and fixed empty search path remain intact; it uses SECURITY DEFINER specifically to create a profile on registration, without giving clients profile INSERT access.

The actual changes were applied to the connected database as `tighten_existing_access`. The SQL reference is `docs/rls-hardening.sql`. No application behavior or UI was added in this step.

## Intended access model

| Resource | Signed out | Signed in |
| --- | --- | --- |
| Published caption rows | Read via Data API | Read; insert as self with metadata |
| Profile rows | No access | Read/edit own allowed fields |
| Vote rows | No access | Read/insert own; one per caption |
| Storage uploads | Denied | Own user-ID folder |
| Caption-image object metadata | No access | Own rows |
| Signup function via client RPC | Denied | Denied |

Both image buckets remain public, matching the app's existing public-image URL implementation. Public file URLs are accessible to anyone who has the URL; object metadata and mutations are controlled separately by RLS. This is not private-photo storage. The app's homepage still requires login even though published caption rows are public through the Data API.

## Verification

`docs/rls-checks.sql` contains the rolled-back permission suite. It creates two temporary auth users to exercise the actual signup trigger as the database admin, confirms that both profiles are created, and checks the retained auth-service EXECUTE grant. The SQL connector cannot assume the `supabase_auth_admin` role, so this does not claim to simulate a complete new Google OAuth signup.

The suite passed checks for all public tables having RLS, profile owner isolation and permitted edits, protected columns, blocked profile INSERT/DELETE, blocked caption UPDATE/DELETE, signup-function access, sequence grants, vote owner isolation, owned uploads, rejected foreign-folder uploads, no storage overwrite, anonymous Auth users, and signed-out access. All fixture users, profiles, votes, and object metadata were rolled back. No caption IDs were allocated or changed.

Generation INSERT grants remain available and its existing INSERT policy is unchanged. This step did not upload an actual file or rerun an AI generation; those workflows were verified in Step 1.

Browser checks confirmed that the existing session could open My profile with its saved name/avatar, open the GIF-capable generation form, and view saved vote selections in the collection.

Supabase's two SECURITY DEFINER execute warnings are resolved. Its remaining notice is **Leaked Password Protection Disabled**. The app currently exposes Google OAuth, not password login. If password signup/login is added later, enable that setting as part of that feature's setup.

## User checks

1. Open My profile: your existing name and avatar should load. Saving your name should still work.
2. Open Create: the generation form should remain available when signed in.
3. Refresh the collection: your saved votes should remain selected.
4. In a private browser window, protected pages should direct you to login.
5. Supabase's Table Editor should show RLS enabled on all three tables. SQL Editor runs with administrative privileges and is not a simulation of an anonymous app user; use the role-based tests above to verify denied access.

Next step: themes and recent trending themes.
