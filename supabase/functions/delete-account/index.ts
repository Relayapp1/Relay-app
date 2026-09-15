// Replaces base44/functions/delete-account. Needs auth.admin.deleteUser,
// which only the Auth Admin API can do — Postgres alone can't, so this stays
// an Edge Function rather than a plain RPC. The actual cascading data delete
// is the delete_account_data() Postgres function (one atomic transaction);
// this function calls it, cleans up the storage files it names, then deletes
// the auth user (whose profiles row cascades away via its own FK).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Scoped to the caller's own JWT, so delete_account_data()'s auth.uid()
    // resolves to them — never accept a target user id from the request body.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 });
    }

    const { data: paths, error: rpcError } = await userClient.rpc('delete_account_data');
    if (rpcError) {
      return new Response(JSON.stringify({ error: rpcError.message }), { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const byBucket = {};
    for (const p of paths || []) {
      const slash = p.indexOf('/');
      if (slash === -1) continue;
      const bucket = p.slice(0, slash);
      const path = p.slice(slash + 1);
      (byBucket[bucket] ||= []).push(path);
    }
    for (const [bucket, objectPaths] of Object.entries(byBucket)) {
      await adminClient.storage.from(bucket).remove(objectPaths);
    }

    // Fail loud here rather than swallowing the error — the data half above
    // already committed, so a silent failure would leave an orphaned auth
    // user with no app data, worse than surfacing the error to the client.
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteUserError) {
      return new Response(JSON.stringify({ error: deleteUserError.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Unexpected error' }), { status: 500 });
  }
});
