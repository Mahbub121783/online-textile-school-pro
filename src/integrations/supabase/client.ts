import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { authClient } from '@/lib/authClient';

// Self-hosted backend (see backend/) replacing the deleted Supabase project.
// supabase-js's `.from()`/`.rpc()` still work unmodified because
// backend/src/rest.js speaks the same PostgREST-shaped wire protocol.
// `.auth` is swapped for our own JWT client (authClient.ts) since our
// backend isn't GoTrue-wire-compatible -- everything else is untouched.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://api.onlinetextileschool.com";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "self-hosted";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false, // authClient.ts handles its own localStorage persistence
  },
});

// @ts-expect-error -- authClient is API-shape compatible for the methods actually used, not a full GoTrue client
client.auth = authClient;

export const supabase = client;
