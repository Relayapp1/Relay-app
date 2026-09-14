export const DRIVEBID_OWNER_ID = '6aa08336d001645119644800';

export function isDriveBidOwner(user) {
  return Boolean(user && user.id === DRIVEBID_OWNER_ID && user.role === 'admin');
}
