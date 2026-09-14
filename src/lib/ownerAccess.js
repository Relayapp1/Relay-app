// Overridable via VITE_OWNER_ID in .env.local for local/sandbox dev, where the real
// production owner id never exists (base44 dev's in-memory users get fresh ids each run).
// Defaults to the real production owner id so deployed behavior is unchanged.
export const DRIVEBID_OWNER_ID = import.meta.env.VITE_OWNER_ID || '6aa08336d001645119644800';

export function isDriveBidOwner(user) {
  return Boolean(user && user.id === DRIVEBID_OWNER_ID && user.role === 'admin');
}
