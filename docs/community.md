# Community profiles, follows and achievements

Implemented Oct 13, 2026. Navigation is Explore → Create → Challenge → Me. Me lists all posts published by the signed-in member; post avatars/nicknames link to `/members/<uuid>`.

Public member cards expose only nickname, avatar, post count, current total likes received, following/follower counts and selected badges. Real names, contact details, private achievement progress and hidden badges are excluded. `my_member_connections` takes only a list kind, not a target user ID; it always returns the caller's own following/follower list. The two backing tables are in the unexposed `challenge_internal` schema, have RLS with default denial and have no anonymous/authenticated table grants. Follow and badge RPCs validate a non-anonymous account. Self-following is prohibited; following is unique/idempotent and can be cancelled.

Achievements:
- Hello, Club: publish one caption.
- Caption Creator: publish 10 captions.
- First Heart: like one caption.
- Good Taste: hold likes on 10 captions.
- Crowd Pleaser: receive 10 total likes.
- Club Favorite: receive 50 total likes.
- Challenge Accepted: publish one challenge entry.
- On the Podium: receive a weekly challenge prize.
- Your Little Crowd: reach five followers.

Unlocking is computed from database activity, never client-supplied counters. Earned badges are stored permanently and default to hidden. Achievement synchronization runs whenever a profile/sidebar is read; vote/follow/publication refreshes bring new accomplishments into view. Owners can toggle display in the sidebar or mobile Me panel. Once earned, cancelling likes/follows does not remove a badge. Weekly credits still come from the existing protected generation ledger, with no payment feature.

Validation: six offline server-action tests cover auth/anonymous refusal, input validation, successful RPC routing, rejected writes and cache refresh. Existing eight generation tests pass. Lint, TypeScript and production build pass. Real owner browser checks confirm three posts, seven received likes, two earned badges, badge show/hide and empty follower-list display; desktop and 390px layouts were checked. Anonymous API checks confirm private progress/hidden badges are omitted, connection lists and follow writes are denied. No fake production users were created. Only one account currently has a nickname, so following between two real accounts still needs a second-account end-to-end check.

Security advisors intentionally report privileged public profile RPCs ([anonymous RPC guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated RPC guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)). The public RPC returns the deliberately public profile subset; mutations and private lists check caller identity. Private tables deliberately use default-deny RLS ([advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)). The pre-existing leaked-password-protection notice is unrelated and Auth settings remain unchanged ([documentation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).

Database migration is applied to the connected project. Code has not been pushed/deployed; production still needs the previously documented server-only challenge secret configuration and the new code deployment.

## Guest browsing update

Unauthenticated visits to `/` and signing out now open Explore. Guests may still browse Challenge through `/?view=challenge`, including past rounds, and read original posts. The sidebar shows Google sign-in; Me, search, personal statistics and the liked-only filter are hidden. Create and challenge participation send guests to sign-in. Clicking like, share or download also goes directly to `/login`, without opening a share panel or preparing a download. Author avatars remain unlinked. Member pages and the profile RPC require a real signed-in account. Existing upload policies require non-anonymous authenticated users.

The image-export endpoint now checks the session and returns 401 for unsigned or anonymous users. The proxy refreshes cookies for this endpoint. Ordinary published photo display remains available to guests.

Verification: production-preview browser checks confirmed the Explore landing and like/share/download login navigation. The guest image-export endpoint returns 401. Guest Challenge remains readable. Lint, TypeScript, production build and all 34 existing offline tests pass. No changes to signed-in sharing, voting or downloads.

## New badge notifications

`docs/badge-notifications.sql` adds account-scoped `notified_at` state to earned badges and two authenticated RPCs. Existing badges are marked as the baseline during migration; new ones remain pending until the owner dismisses the popup. `my_new_badges` returns only the caller's pending badge identifiers. `acknowledge_badge` changes only the caller's already-earned row and is idempotent. Neither can unlock badges or change their public display setting.

The owner sidebar checks new badges after syncing achievements. The native modal is rendered into the document body, so mobile visitors see it even when the sidebar is hidden. It shows the medal, name, “You earned a new badge!” and achievement condition; multiple unlocks are queued. Close, Escape and the confirmation button save acknowledgement before advancing; failure leaves the notification available to retry. Native modal focus handling prevents interacting with the background, and closing restores focus. Notifications appear on the next page load or refresh that detects a new achievement, including the existing refresh after liking or publishing.
