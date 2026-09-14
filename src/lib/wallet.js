import { base44 } from '@/api/base44Client';

export const money = (value) => `$${Number(value || 0).toFixed(2)}`;

export async function getWallet(user) {
  if (!user) return null;
  const role = user.account_type === 'driver' ? 'driver' : 'broker';
  const existing = await base44.entities.Wallet.filter({ user_id: user.id }, '-created_date', 1);
  if (existing[0]) return existing[0];
  return await base44.entities.Wallet.create({ user_id: user.id, role, balance: 0, pending_deposits: 0, pending_withdrawals: 0 });
}

async function call(payload) {
  try {
    const res = await base44.functions.invoke('wallet-ops', payload);
    return res?.data ?? res;
  } catch (e) {
    throw new Error(e?.response?.data?.error || e?.message || 'Wallet operation failed');
  }
}

export const requestDeposit = (user, amount, notes = '') =>
  call({ action: 'deposit_request', amount: Number(amount), notes });

export const requestWithdrawal = (user, amount, bank) =>
  call({ action: 'withdraw_request', amount: Number(amount), bank_name: bank.bank_name, bank_account_last4: bank.bank_account_last4, bank_routing: bank.bank_routing });

export const reserveTripFunding = (trip, amount) =>
  call({ action: 'reserve_funding', trip_id: trip.id, amount: Number(amount) });

export const refundTripFunding = (trip) =>
  call({ action: 'refund_funding', trip_id: trip.id });

export const chargeCancellationFee = (trip) =>
  call({ action: 'charge_cancellation_fee', trip_id: trip.id });

export const processTripPayment = (trip, totalAmount) =>
  call({ action: 'process_payment', trip_id: trip.id, amount: Number(totalAmount) });

export const approveTransaction = (id) =>
  call({ action: 'approve', transaction_id: id });

export const rejectTransaction = (id) =>
  call({ action: 'reject', transaction_id: id });