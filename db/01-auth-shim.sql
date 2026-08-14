-- ============================================================
-- auth-shim.sql — Supabase compatibility layer for self-hosted Postgres
--
-- Recreates just enough of Supabase's `auth`/`storage` schemas and
-- auth.uid()/auth.role()/auth.jwt() functions so that the existing 90
-- Supabase migrations (280 RLS policies, FKs to auth.users, storage.objects
-- policies) still apply and enforce the same per-row authorization.
--
-- NOTE: the hosting provider declined to create cluster-level Postgres roles
-- (anon/authenticated/service_role/authenticator), citing the BYPASSRLS
-- privilege on service_role as a security risk. So this database has only
-- ONE login role (tecnedub_ots_app) -- there is no role-based access split
-- at the Postgres level. All 280 RLS policies were mechanically rewritten
-- (see scratch_rewrite_policies.cjs) to drop their `TO <role>` clauses and
-- instead AND-gate on auth.role() = '<role>', which reads a per-request
-- session GUC the Node API sets via SET LOCAL before every query -- same
-- practical effect, enforced in SQL, without needing real Postgres roles.
--
-- The Node API server is expected to run, per request:
--   SELECT set_config('request.jwt.claims', '{"sub": "...", "role": "authenticated"}', true);
--   SELECT set_config('request.jwt.claim.sub', '<user-id>', true);
--   SELECT set_config('request.jwt.claim.role', 'authenticated', true);
-- before running any query (see backend/src/db.js withRequestContext()).
-- ============================================================

-- Empty publication so migrations' `ALTER PUBLICATION supabase_realtime ADD/DROP
-- TABLE ...` statements (leftover from Supabase Realtime, which we don't use --
-- only 1 frontend file, ChatWidget.tsx, uses realtime and will be polling-based
-- instead per the plan) succeed as harmless no-ops instead of erroring.
DO $$ BEGIN
  CREATE PUBLICATION supabase_realtime;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- auth schema
-- ============================================================
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  phone text,
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- auth.uid() / auth.role() / auth.jwt() read from the per-request session
-- settings the Node API sets via set_config() before each query.
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;

-- ============================================================
-- storage schema stub (files themselves live on Cloudflare R2 via the
-- r2-presign function; this table only exists so RLS policies referencing
-- storage.objects can be created and evaluated without erroring)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text,
  owner uuid REFERENCES auth.users(id),
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true)
  ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- extensions schema referenced by several migrations (net.http_post moved here
-- historically) — kept as an empty namespace so ALTER EXTENSION / SET SCHEMA
-- style statements referencing it don't fail if any remain.
-- ============================================================
CREATE SCHEMA IF NOT EXISTS extensions;
