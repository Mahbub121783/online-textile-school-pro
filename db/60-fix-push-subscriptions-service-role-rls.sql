-- ============================================================
-- push_subscriptions' RLS policies (added later, in
-- supabase/migrations/20260510183557...sql, never touched by the db/57/58
-- service-role-RLS audit) only ever checked `auth.uid() = user_id` -- but
-- every write to this table goes through backend/src/functions/push.js's
-- pushSubscribe/pushUnsubscribe, which use serviceQuery() (service_role
-- context, where auth.uid() is always NULL -- see backend/src/db.js
-- withRequestContext, which never sets request.jwt.claim.sub for
-- service_role calls). Same for backend/src/notify.js's sendPushToUser,
-- which SELECTs from this table under service_role to actually deliver a
-- push. Every one of these silently failed RLS since the table was
-- created -- confirmed live: 0 rows in push_subscriptions despite real
-- subscribe attempts, and no error surfaced because pushSubscribe's catch
-- block never logged the failure. This is why "mobile notification bar"
-- push has never worked for anyone. Same fix pattern as db/58's
-- qb_user_tokens SELECT-for-RETURNING fix: add a service_role branch.
-- ============================================================
SELECT set_config('request.jwt.claim.role', 'service_role', false);

DROP POLICY IF EXISTS "Users view own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users view own push subscriptions" ON public.push_subscriptions
  FOR SELECT USING (auth.role() = 'service_role' OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users insert own push subscriptions" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users update own push subscriptions" ON public.push_subscriptions
  FOR UPDATE USING (auth.role() = 'service_role' OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users delete own push subscriptions" ON public.push_subscriptions
  FOR DELETE USING (auth.role() = 'service_role' OR auth.uid() = user_id);
