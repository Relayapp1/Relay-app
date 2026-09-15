import { supabase } from '@/api/supabaseClient';
import { entities } from '@/api/supabaseEntities';

export const money = (value) => `$${Number(value || 0).toFixed(2)}`;

export async function getWallet(user) {
  if (!user) return null;
  const role = user.account_type === 'driver' ? 'driver' : 'broker';
  const existing = await entities.Wallet.filter({ user_id: user.id }, '-created_date', 1);
  if (existing[0]) return existing[0];
  return await entities.Wallet.create({ user_id: user.id, role, balance: 0, pending_deposits: 0, pending_withdrawals: 0 });
}

async function call(fn, params) {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) throw new Error(error.message || 'Wallet operation failed');
  return data;
}

export const requestDeposit = (user, amount, notes = '') =>
  call('wallet_deposit_request', { p_amount: Number(amount), p_notes: notes });

export const requestWithdrawal = (user, amount, bank, speed = 'standard') =>
  call('wallet_withdraw_request', {
    p_amount: Number(amount),
    p_bank_name: bank.bank_name,
    p_bank_account_last4: bank.bank_account_last4,
    p_bank_routing: bank.bank_routing,
    p_speed: speed,
  });

export const reserveTripFunding = (trip, amount) =>
  call('wallet_reserve_funding', { p_trip_id: trip.id, p_amount: Number(amount) });

export const refundTripFunding = (trip) =>
  call('wallet_refund_funding', { p_trip_id: trip.id });

export const chargeCancellationFee = (trip) =>
  call('wallet_charge_cancellation_fee', { p_trip_id: trip.id });

export const processTripPayment = (trip, totalAmount) =>
  call('wallet_process_payment', { p_trip_id: trip.id, p_amount: Number(totalAmount) });

export const approveTransaction = (id) =>
  call('wallet_approve_transaction', { p_transaction_id: id });

export const rejectTransaction = (id) =>
  call('wallet_reject_transaction', { p_transaction_id: id });
