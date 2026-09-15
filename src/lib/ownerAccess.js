// Set via VITE_OWNER_ID once the real owner account exists in Supabase Auth
// (its auth.users uuid) — the old hardcoded Base44 id no longer means
// anything post-migration. Empty string matches nothing, so no one is
// treated as the owner until this is actually configured.
export const DRIVEBID_OWNER_ID = import.meta.env.VITE_OWNER_ID || '';

export function isDriveBidOwner(user) {
  return Boolean(user && user.id === DRIVEBID_OWNER_ID && user.role === 'admin');
}
