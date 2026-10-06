-- Applied as allow_users_to_remove_own_likes. Reference only.
grant delete on public.caption_votes to authenticated;
create policy "Users remove own likes" on public.caption_votes
for delete to authenticated using (
  (select auth.uid()) = user_id and vote = 1
  and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false'
);
-- Existing positive-vote counter trigger decrements on DELETE.
-- Verified own deletion, other-user protection, duplicate deletion and counters
-- in a rolled-back transaction. Anonymous DELETE remains forbidden.
-- Browser verified caption 6: like -> unlike -> reload; original zero votes restored.
-- Security advisor reports only the existing password protection setting:
-- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
