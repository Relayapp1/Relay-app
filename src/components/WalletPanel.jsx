import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { getWallet, requestDeposit, requestWithdrawal, money } from '@/lib/wallet';
import '@/drivebid.css';

export default function WalletPanel({ user }) {
  const [wallet, setWallet] = useState(null);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [amount, setAmount] = useState('');
  const [speed, setSpeed] = useState('standard');
  const [bank, setBank] = useState({ bank_name: '', bank_account_last4: '', bank_routing: '' });
  const INSTANT_FEE = 2;
  const isBroker = user?.account_type !== 'driver';

  const load = async () => {
    try {
      const w = await getWallet(user);
      setWallet(w);
      const t = await base44.entities.WalletTransaction.filter({ user_id: user.id }, '-created_date', 100);
      setTxns(t);
    } catch (e) {
      setMessage(e.message || 'Could not load wallet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const off = base44.entities.WalletTransaction.subscribe(() => load());
    return () => off?.();
  }, []);

  useEffect(() => { load(); }, []);

  const deposit = async (e) => {
    e.preventDefault(); setSaving(true); setMessage('');
    try {
      await requestDeposit(user, amount);
      setAmount('');
      setMessage('Funds request submitted. An admin will confirm your deposit.');
      await load();
    } catch (e2) { setMessage(e2.message || 'Could not request deposit'); }
    finally { setSaving(false); }
  };

  const withdraw = async (e) => {
    e.preventDefault(); setSaving(true); setMessage('');
    try {
      await requestWithdrawal(user, amount, bank, speed);
      setAmount('');
      setSpeed('standard');
      setBank({ bank_name: '', bank_account_last4: '', bank_routing: '' });
      setMessage(speed === 'instant' ? `Instant withdrawal requested — flagged for priority admin review. A $${INSTANT_FEE.toFixed(2)} fee applies.` : 'Withdrawal requested. An admin will process your bank transfer.');
      await load();
    } catch (e2) { setMessage(e2.message || 'Could not request withdrawal'); }
    finally { setSaving(false); }
  };

  if (loading) return null;

  return (
    <section className="db-panel" style={{ marginTop: 22 }}>
      <div className="db-panel-head">
        <h2>{isBroker ? 'Broker wallet' : 'Driver wallet'}</h2>
        <span className="db-count">Balance {money(wallet?.balance || 0)}</span>
      </div>
      <div className="db-side-body">
        <div className="db-trip-metrics" style={{ marginBottom: 16 }}>
          <div><span>Available</span><strong style={{ color: 'var(--db-green)' }}>{money(wallet?.balance || 0)}</strong></div>
          <div><span>Pending {isBroker ? 'deposits' : 'withdrawals'}</span><strong>{money(isBroker ? wallet?.pending_deposits || 0 : wallet?.pending_withdrawals || 0)}</strong></div>
        </div>
        {message && <div className="db-notice" style={{ marginBottom: 12 }}>{message}</div>}
        {isBroker ? (
          <form className="db-form" onSubmit={deposit}>
            <div className="db-form-grid">
              <Field label="Add funds ($)" full><input type="number" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required /></Field>
            </div>
            <div className="db-form-actions"><button className="db-button" disabled={saving}>{saving ? 'Submitting…' : 'Request deposit'}</button></div>
            <div className="db-notice" style={{ marginTop: 8 }}>In this beta, an admin confirms each deposit. Real card payments are coming soon.</div>
          </form>
        ) : (
          <form className="db-form" onSubmit={withdraw}>
            <div className="db-form-grid">
              <Field label="Withdraw amount ($)" full><input type="number" min="1" step="0.01" max={Math.max(0, (wallet?.balance || 0) - (speed === 'instant' ? INSTANT_FEE : 0))} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required /></Field>
              <Field label="Payout speed" full>
                <div className="db-inline-actions">
                  <button type="button" className="db-button secondary" style={speed === 'standard' ? { background: 'var(--db-navy)', color: 'white' } : {}} onClick={() => setSpeed('standard')}>Standard · Free</button>
                  <button type="button" className="db-button secondary" style={speed === 'instant' ? { background: 'var(--db-navy)', color: 'white' } : {}} onClick={() => setSpeed('instant')}>Instant · ${INSTANT_FEE.toFixed(2)} fee</button>
                </div>
              </Field>
              <Field label="Bank name"><input value={bank.bank_name} onChange={e => setBank({ ...bank, bank_name: e.target.value })} required /></Field>
              <Field label="Account last 4"><input maxLength={4} value={bank.bank_account_last4} onChange={e => setBank({ ...bank, bank_account_last4: e.target.value })} required /></Field>
              <Field label="Routing number" full><input value={bank.bank_routing} onChange={e => setBank({ ...bank, bank_routing: e.target.value })} required /></Field>
            </div>
            <div className="db-form-actions"><button className="db-button" disabled={saving}>{saving ? 'Submitting…' : speed === 'instant' ? `Request instant withdrawal (+$${INSTANT_FEE.toFixed(2)})` : 'Request withdrawal'}</button></div>
            <div className="db-notice" style={{ marginTop: 8 }}>{speed === 'instant' ? `An admin still processes every transfer in this beta — instant requests are just flagged for priority review, and carry a $${INSTANT_FEE.toFixed(2)} fee. Real automated instant payouts are coming soon.` : 'An admin processes your bank transfer.'}</div>
          </form>
        )}
        <div className="db-mini-title" style={{ marginTop: 18 }}>Transaction history</div>
        {txns.length ? txns.map(t => (
          <div className="db-expense-row" key={t.id}>
            <div><strong>{t.type.replace('_', ' ')} · {money(t.amount)}{t.type === 'withdrawal' && t.speed === 'instant' ? ` · Instant (+${money(t.fee_amount || 0)} fee)` : ''}</strong><small>{new Date(t.created_date).toLocaleDateString()}{t.bank_name ? ` · ${t.bank_name} ****${t.bank_account_last4}` : ''}</small></div>
            <span className={`db-admin-status ${t.status === 'completed' ? 'approved' : t.status === 'rejected' ? 'rejected' : 'pending'}`}>{t.status}</span>
          </div>
        )) : <p className="db-job-meta">No transactions yet.</p>}
      </div>
    </section>
  );
}

function Field({ label, full = false, children }) {
  return <div className={`db-field ${full ? 'full' : ''}`}><label>{label}</label>{children}</div>;
}