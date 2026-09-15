import { createClient } from '@supabase/supabase-js';

// flowType: 'implicit' (not the default 'pkce') — PKCE ties the email
// confirmation/reset link to a code_verifier stored in the browser that
// started the flow, which breaks the very normal case of signing up on one
// device/browser and confirming from wherever the mail client opens the
// link. Implicit flow puts the session tokens directly in the link instead,
// so confirmation works regardless of which browser opens it.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { flowType: 'implicit' } }
);
