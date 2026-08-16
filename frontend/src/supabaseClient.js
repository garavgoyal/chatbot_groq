// Used ONLY for the parts of auth that need a real browser redirect —
// Google OAuth and the password-reset email link. Everything else (login,
// signup, day-to-day API calls) still goes through the FastAPI backend via
// src/api.js. Once Supabase hands back a session here, we store its tokens
// the same way the backend-based login does, so the rest of the app can't
// tell the difference.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// createClient() throws immediately if the key is missing — and since this
// module is imported at the top of pages that load on every visit (Login,
// Signup...), that throw would crash the entire app before React can even
// render, not just disable the Google/reset-password buttons. So: only
// construct a real client when both values are present, and export null
// otherwise. Callers (handleGoogleSignIn etc.) check for null and show a
// friendly message instead of using it.
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!supabaseConfigured) {
  console.warn(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — " +
    "Google sign-in and Forgot Password won't work until frontend/.env has them. " +
    "Use the anon/publishable key from Supabase (Project Settings > API), never the secret key."
  );
}

export const supabase = supabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;
