import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { processTripPayment, refundTripFunding } from '@/lib/wallet';
import { resolveTripDispute } from '@/lib/tripReview';
import { motion } from 'framer-motion';

const minutesFor = (trip, now) => {
  let total = Number(trip.tracked_minutes || 0);
  if (trip.status === 'in_progress' && trip.timer_started_at) total += (now - new Date(trip.timer_started_at).getTime()) / 60000;
  return Math.max(0, total);
};
const timeText = (minutes) => { const total = Math.floor(minutes); return `${Math.floor(total/60)}h ${String(total%60).padStart(2,'0')}m`; };
const money = (value) => `$${Number(value||0).toFixed(2)}`;
const accumulated = (trip) => Math.round(minutesFor(trip, Date.now()) * 100) / 100;

export default function TripDetailModal({ trip, deals, bids, onClose, onChanged }) {
  const [now, setNow] = useState(Date.now());
  const [expenses, setExpenses] = useState([]);
  const [messages, setMessages] = useState([]);
  const [liveTrip, setLiveTrip] = useState(trip);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [tipInput, setTipInput] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    if (!trip) return;
    let active = true;
    setLiveTrip(trip);
    const load = async () => {
      try {
        const [exp, msgs, trips, me] = await Promise.all([
          base44.entities.TripExpense.filter({ trip_id: trip.id }, '-created_date', 200),
          base44.entities.Message.filter({ trip_id: trip.id }, '-created_date', 500),
          base44.entities.Trip.filter({ id: trip.id }, '-created_date', 1),
          base44.auth.me()
        ]);
        if (!active) return;
        setExpenses(exp);
        setMessages(msgs);
        setCurrentUser(me);
        if (trips[0]) {
          setLiveTrip(trips[0]);
          setResolution(trips[0].dispute_resolution || '');
        }
      } catch (e) { if (active) setMessage(e.message || 'Could not load trip details'); }
    };
    load();
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const offTrip = base44.entities.Trip.subscribe(() => load());
    return () => { active = false; window.clearInterval(timer); offTrip?.(); };
  }, [trip && trip.id]);

  if (!trip) return null;

  const expenseTotal = expenses.filter(x => x.status !== 'rejected').reduce((s, x) => s + Number(x.amount || 0), 0);
  const trackedHours = minutesFor(trip, now) / 60;
  const laborTotal = Number(trip.accepted_rate || 0) * trackedHours;
  const tipValue = Number(trip.tip_amount || 0);
  const grandTotal = laborTotal + expenseTotal + tipValue;
  const isActive = !['completed', 'cancelled'].includes(trip.status);

  const run = async (fn, label) => {
    setSaving(true); setMessage('');
    try { await fn(); setMessage(label); onChanged(); }
    catch (e) { setMessage(e.message || 'Action failed'); }
    finally { setSaving(false); }
  };

  const pauseHours = () => run(async () => {
    await base44.entities.Trip.update(trip.id, { status: 'paused', tracked_minutes: accumulated(trip), timer_started_at: null });
  }, 'Trip paused (broker view).');

  const finishTrip = () => run(async () => {
    const completedAt = new Date().toISOString();
    await base44.entities.Trip.update(trip.id, { status: 'completed', tracked_minutes: accumulated(trip), timer_started_at: null, completed_at: completedAt });
    await base44.entities.Deal.update(trip.deal_id, { status: 'completed', completed_at: completedAt });
  }, 'Trip completed (broker view).');

  const cancelTrip = () => run(async () => {
    if (trip.funding_status === 'confirmed') await refundTripFunding(trip);
    const accepted = bids.find(x => x.deal_id === trip.deal_id && x.driver_id === trip.driver_id && x.status === 'accepted');
    if (accepted) await base44.entities.Bid.update(accepted.id, { status: 'rejected' });
    await base44.entities.Trip.update(trip.id, { status: 'cancelled', cancelled_by: 'admin', timer_started_at: null });
    await base44.entities.Deal.update(trip.deal_id, { status: 'cancelled', cancelled_by: 'admin' });
  }, 'Trip cancelled by admin. Any reserved funding was refunded to the broker.');

  const saveTip = () => run(async () => {
    await base44.entities.Trip.update(trip.id, { tip_amount: Math.max(0, Number(tipInput) || 0) });
  }, 'Tip updated.');

  const sendPayment = () => run(async () => {
    const labor = Number(trip.accepted_rate || 0) * (accumulated(trip) / 60);
    const exp = expenses.filter(x => x.status !== 'rejected').reduce((s, x) => s + Number(x.amount || 0), 0);
    const total = labor + exp + Number(trip.tip_amount || 0);
    await processTripPayment(trip, total);
  }, 'Payment sent to driver wallet.');

  const resolveDispute = () => run(async () => {
    if (!resolution.trim()) throw new Error('Add resolution notes before closing the dispute');
    await resolveTripDispute(trip, resolution.trim());
  }, 'Dispute resolved. Payment can now continue.');

  const setExpenseStatus = (id, status) => {
    setExpenses(prev => prev.map(x => x.id === id ? { ...x, status } : x));
    run(async () => {
      await base44.entities.TripExpense.update(id, { status });
    }, `Expense ${status}.`);
  };

  return (
    <div className="db-modal" role="dialog" aria-modal="true" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="db-modal-card" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
        <div className="db-modal-head"><h2>Trip · {trip.vehicle_info || 'vehicle'}</h2><button className="db-close" onClick={onClose} aria-label="Close">×</button></div>
        <div className="db-form" style={{ maxWidth: 'none' }}>
          <p className="db-job-meta" style={{ marginTop: 0, marginBottom: 14 }}>Broker view · {trip.broker_name || '—'} ↔ Driver: {trip.driver_name || '—'}</p>
          {message && <div className="db-notice" style={{ marginBottom: 12 }}>{message}</div>}

          <div className="db-trip-head" style={{ marginBottom: 14 }}>
            <div>
              <span className={`db-admin-status ${trip.status === 'completed' ? 'approved' : trip.status === 'cancelled' ? 'rejected' : 'pending'}`}>{(trip.status || 'scheduled').replace('_', ' ')}</span>
              <h2 style={{ margin: '6px 0 2px' }}>{trip.vehicle_info || 'Assigned vehicle'}</h2>
              <p>{trip.pickup_location || '—'} → {trip.delivery_location || '—'}</p>
            </div>
            <div className="db-trip-clock"><strong>{timeText(minutesFor(trip, now))}</strong><span>tracked time</span></div>
          </div>

          <div className="db-trip-metrics">
            <div><span>Accepted rate</span><strong>{money(trip.accepted_rate)}/hr</strong></div>
            <div><span>Expenses</span><strong>{money(expenseTotal)}</strong></div>
            <div><span>Tip</span><strong>{money(tipValue)}</strong></div>
            <div><span>Total {trip.status === 'completed' ? 'due' : 'estimate'}</span><strong style={{ color: 'var(--db-green)' }}>{money(grandTotal)}</strong></div>
          </div>

          <div className="db-location-box" style={{ marginTop: 14 }}>
            <strong>Trip location</strong>
            {liveTrip && liveTrip.current_latitude && liveTrip.current_longitude ? (
              <div>
                <p>{liveTrip.location_active ? 'Live sharing on' : 'Last shared location'} · {liveTrip.last_location_at ? new Date(liveTrip.last_location_at).toLocaleString() : 'time unavailable'}</p>
                <a className="db-link-btn" href={`https://www.google.com/maps?q=${liveTrip.current_latitude},${liveTrip.current_longitude}`} target="_blank" rel="noreferrer">Open map</a>
              </div>
            ) : <p>No location has been shared for this trip.</p>}
          </div>

          {liveTrip?.funding_status && (
            <div className="db-location-box" style={{ marginTop: 14 }}>
              <strong>Funding and delivery review</strong>
              <p>Funding: {(liveTrip.funding_status || 'pending').replace('_', ' ')}{liveTrip.funded_amount ? ` · ${money(liveTrip.funded_amount)} reserved` : ''}</p>
              <p>Delivery review: {(liveTrip.delivery_review_status || 'pending').replace('_', ' ')}</p>
              {liveTrip.delivery_review_status === 'disputed' && (
                <div className="db-form" style={{ maxWidth: 'none', marginTop: 12 }}>
                  <div className="db-notice"><strong>Broker dispute:</strong> {liveTrip.dispute_reason || 'No reason supplied.'}</div>
                  {currentUser?.role === 'admin' ? (
                    <>
                      <label>Administrator resolution notes<textarea rows="4" value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Document the decision and next action for both parties" /></label>
                      <button className="db-button" disabled={saving || !resolution.trim()} onClick={resolveDispute}>Resolve dispute</button>
                    </>
                  ) : <p>Payment remains paused until an administrator reviews the delivery record.</p>}
                </div>
              )}
              {liveTrip.delivery_review_status === 'resolved' && liveTrip.dispute_resolution && <p><strong>Resolution:</strong> {liveTrip.dispute_resolution}</p>}
            </div>
          )}

          {isActive && (
            <div className="db-trip-controls">
              {trip.status === 'in_progress' && <button className="db-button secondary" disabled={saving} onClick={pauseHours}>Pause</button>}
              <button className="db-button" disabled={saving} onClick={finishTrip}>Complete trip</button>
              <button className="db-button danger" disabled={saving} onClick={cancelTrip}>Cancel trip</button>
            </div>
          )}

          <div className="db-expense-list" style={{ marginTop: 16 }}>
            <div className="db-mini-title">Expenses</div>
            {expenses.length ? expenses.map(item => (
              <div className="db-expense-row" key={item.id}>
                <div><strong>{item.category} · {money(item.amount)}</strong><small>{item.notes || item.expense_date || 'Submitted expense'}</small></div>
                <span className={`db-admin-status ${item.status === 'approved' ? 'approved' : item.status === 'rejected' ? 'rejected' : 'pending'}`}>{item.status}</span>
                {item.status === 'submitted' && (
                  <div className="db-inline-actions">
                    <button className="db-small-btn" disabled={saving} onClick={() => setExpenseStatus(item.id, 'approved')}>Approve</button>
                    <button className="db-small-btn" style={{ color: 'var(--db-danger)', background: '#fff0f1' }} disabled={saving} onClick={() => setExpenseStatus(item.id, 'rejected')}>Reject</button>
                  </div>
                )}
              </div>
            )) : <p className="db-job-meta">No expenses submitted.</p>}
          </div>

          {trip.status === 'completed' && (
            <div className="db-payout-summary" style={{ marginTop: 16 }}>
              <div className="db-mini-title" style={{ marginTop: 0 }}>Payout summary (broker view)</div>
              <div className="db-status-row">Labor ({money(trip.accepted_rate)}/hr × {timeText(minutesFor(trip, now))})<span>{money(laborTotal)}</span></div>
              <div className="db-status-row">Approved expenses<span>{money(expenseTotal)}</span></div>
              <div className="db-status-row">Tip<span>{money(tipValue)}</span></div>
              <div className="db-status-row db-payout-total">Total to pay<span>{money(grandTotal)}</span></div>
              <div className="db-tip-row"><label>Add tip ($)</label><input type="number" min="0" step="1" inputMode="decimal" value={tipInput || trip.tip_amount || ''} onChange={e => setTipInput(e.target.value)} placeholder="0" /><button className="db-button secondary" disabled={saving} onClick={saveTip}>Save tip</button></div>
              <div className="db-payout-actions">
                {trip.payment_status === 'received' ? <span className="db-job-meta">Payment confirmed by driver</span> : (
                  <>
                    <button className="db-button" disabled={saving || trip.payment_status === 'sent' || !['approved', 'resolved'].includes(liveTrip?.delivery_review_status)} onClick={sendPayment}>{trip.payment_status === 'sent' ? 'Payment sent' : 'Send payment'}</button>
                    {trip.payment_status === 'sent' ? <span className="db-job-meta">Awaiting driver confirmation</span> : <span className="db-job-meta">Wallet payment to {trip.driver_name || 'the driver'}</span>}
                  </>
                )}
              </div>
            </div>
          )}

          <div className="db-mini-title" style={{ marginTop: 18 }}>Trip chat</div>
          <div className="db-chat" style={{ maxHeight: 260 }}>
            <div className="db-chat-messages">
              {messages.length ? messages.slice().sort((a, b) => new Date(a.created_date) - new Date(b.created_date)).map(m => (
                <div className="db-chat-msg" key={m.id}>
                  <div className="db-chat-bubble"><strong>{m.sender_role}{m.sender_name ? ` · ${m.sender_name}` : ''}</strong><p>{m.content}</p><small>{new Date(m.created_date).toLocaleString()}</small></div>
                </div>
              )) : <div className="db-empty"><strong>No messages yet</strong>Conversation appears here once the broker or driver writes.</div>}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}