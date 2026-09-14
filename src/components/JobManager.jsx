import React, { useState } from 'react';
import MobileSelect from '@/components/MobileSelect';

const STATUS_OPTIONS = ['open', 'assigned', 'completed', 'cancelled'];
const RETURN_OPTIONS = ['Lease return provided', 'Broker will Uber driver back', 'Driver arranges own return'];

const STATUS_FILTERS = ['all', 'open', 'assigned', 'completed', 'cancelled'];

const EMPTY_JOB = { vehicle_info: '', pickup_location: '', delivery_location: '', pickup_date: '', pickup_time: '', return_plan: '', estimated_hours: 2, minimum_rate: 20, notes: '' };

export default function JobManager({ deals, bids = [], onSave, onDelete, onCancel, onDecideBid, onCreate, busy }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [bidsDeal, setBidsDeal] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [posting, setPosting] = useState(false);
  const [postForm, setPostForm] = useState(EMPTY_JOB);

  const openEdit = (deal) => { setEditing(deal); setForm({ ...deal }); };
  const close = () => { setEditing(null); setForm(null); };

  const submitPost = (e) => {
    e.preventDefault();
    onCreate({
      ...postForm,
      estimated_hours: Number(postForm.estimated_hours),
      minimum_rate: Number(postForm.minimum_rate),
      target_rate: Number(postForm.minimum_rate),
      is_lease_return: postForm.return_plan === 'Lease return provided',
      uber_driver_back: postForm.return_plan === 'Broker will Uber driver back',
      status: 'open'
    });
    setPostForm(EMPTY_JOB);
    setPosting(false);
  };

  const filteredDeals = statusFilter === 'all' ? deals : deals.filter(d => (d.status || 'open') === statusFilter);

  const submit = (e) => {
    e.preventDefault();
    onSave(editing.id, {
      vehicle_info: form.vehicle_info,
      pickup_location: form.pickup_location,
      delivery_location: form.delivery_location,
      pickup_date: form.pickup_date,
      pickup_time: form.pickup_time,
      estimated_hours: Number(form.estimated_hours),
      minimum_rate: Number(form.minimum_rate),
      return_plan: form.return_plan,
      status: form.status,
      notes: form.notes
    });
    close();
  };

  return (
    <section className="db-panel">
      <div className="db-panel-head"><h2>All jobs</h2><span className="db-count">{deals.length}</span><button className="db-icon-btn" disabled={busy} onClick={() => setPosting(true)} aria-label="Post a delivery" title="Post a delivery">+</button></div>
      <div className="db-chips" style={{ marginBottom: 14 }}>{STATUS_FILTERS.map(f => <button key={f} className="db-link-btn" style={statusFilter === f ? { background: 'var(--db-navy)', color: 'white' } : {}} onClick={() => setStatusFilter(f)}>{f[0].toUpperCase() + f.slice(1)}{f !== 'all' ? ` (${deals.filter(d => (d.status || 'open') === f).length})` : ''}</button>)}</div>
      {filteredDeals.length ? (
        <div className="db-admin-table-wrap">
          <table className="db-admin-table">
            <thead><tr><th>Vehicle</th><th>Route</th><th>Broker</th><th>Status</th><th>Pickup</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredDeals.map(deal => (
                <tr key={deal.id}>
                  <td>{deal.vehicle_info || '—'}</td>
                  <td>{deal.pickup_location || '—'} → {deal.delivery_location || '—'}</td>
                  <td>{deal.broker_name || '—'}</td>
                  <td><span className={`db-admin-status ${deal.status === 'completed' ? 'approved' : deal.status === 'cancelled' ? 'rejected' : 'pending'}`}>{deal.status || '—'}</span></td>
                  <td>{[deal.pickup_date, deal.pickup_time].filter(Boolean).join(' · ') || '—'}</td>
                  <td><div className="db-inline-actions"><button className="db-small-btn" disabled={busy} onClick={() => setBidsDeal(deal)}>Bids ({bids.filter(b => b.deal_id === deal.id && b.status !== 'withdrawn').length})</button><button className="db-small-btn" disabled={busy} onClick={() => openEdit(deal)}>Edit</button>{!['completed', 'cancelled'].includes(deal.status) && <button className="db-small-btn" style={{ color: 'var(--db-danger)', background: '#fff0f1' }} disabled={busy} onClick={() => setConfirmCancel(deal)}>Cancel</button>}<button className="db-small-btn" style={{ color: 'var(--db-danger)', background: '#fff0f1' }} disabled={busy} onClick={() => setConfirmDelete(deal)}>Delete</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="db-empty"><strong>No jobs match this filter</strong>Try a different status filter or post a new job.</div>
      )}

      {editing && form && (
        <div className="db-modal" role="dialog" aria-modal="true" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
          <div className="db-modal-card">
            <div className="db-modal-head"><h2>Edit job</h2><button className="db-close" onClick={close} aria-label="Close">×</button></div>
            <form className="db-form" onSubmit={submit}>
              <div className="db-form-grid">
                <Field label="Vehicle" full><input value={form.vehicle_info || ''} onChange={e => setForm({ ...form, vehicle_info: e.target.value })} required /></Field>
                <Field label="Pickup location"><input value={form.pickup_location || ''} onChange={e => setForm({ ...form, pickup_location: e.target.value })} required /></Field>
                <Field label="Delivery location"><input value={form.delivery_location || ''} onChange={e => setForm({ ...form, delivery_location: e.target.value })} required /></Field>
                <Field label="Pickup date"><input type="date" value={form.pickup_date || ''} onChange={e => setForm({ ...form, pickup_date: e.target.value })} /></Field>
                <Field label="Pickup time"><input type="time" value={form.pickup_time || ''} onChange={e => setForm({ ...form, pickup_time: e.target.value })} /></Field>
                <Field label="Estimated hours"><input type="number" min="1" value={form.estimated_hours || ''} onChange={e => setForm({ ...form, estimated_hours: e.target.value })} /></Field>
                <Field label="Minimum hourly bid"><input type="number" min="0" value={form.minimum_rate || ''} onChange={e => setForm({ ...form, minimum_rate: e.target.value })} /></Field>
                <Field label="Return plan" full><MobileSelect value={form.return_plan || ''} onChange={v => setForm({ ...form, return_plan: v })}><option value="">None</option>{RETURN_OPTIONS.map(o => <option key={o}>{o}</option>)}</MobileSelect></Field>
                <Field label="Status" full><MobileSelect value={form.status || 'open'} onChange={v => setForm({ ...form, status: v })}>{STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}</MobileSelect></Field>
                <Field label="Notes" full><textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
              </div>
              <div className="db-form-actions"><button type="button" className="db-button secondary" onClick={close}>Cancel</button><button className="db-button" disabled={busy}>Save changes</button></div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="db-modal" role="dialog" aria-modal="true" onMouseDown={e => { if (e.target === e.currentTarget) setConfirmDelete(null); }}>
          <div className="db-modal-card" style={{ maxWidth: 460 }}>
            <div className="db-modal-head"><h2>Delete job?</h2><button className="db-close" onClick={() => setConfirmDelete(null)} aria-label="Close">×</button></div>
            <div className="db-form">
              <p className="db-job-meta" style={{ marginBottom: 16 }}>This permanently deletes <strong>{confirmDelete.vehicle_info || 'this job'}</strong> ({confirmDelete.pickup_location || '—'} → {confirmDelete.delivery_location || '—'}). This cannot be undone.</p>
              <div className="db-form-actions"><button type="button" className="db-button secondary" onClick={() => setConfirmDelete(null)}>Cancel</button><button className="db-button danger" disabled={busy} onClick={() => { onDelete(confirmDelete.id); setConfirmDelete(null); }}>Delete job</button></div>
            </div>
          </div>
        </div>
      )}

      {confirmCancel && (
        <div className="db-modal" role="dialog" aria-modal="true" onMouseDown={e => { if (e.target === e.currentTarget) setConfirmCancel(null); }}>
          <div className="db-modal-card" style={{ maxWidth: 460 }}>
            <div className="db-modal-head"><h2>Cancel job?</h2><button className="db-close" onClick={() => setConfirmCancel(null)} aria-label="Close">×</button></div>
            <div className="db-form">
              <p className="db-job-meta" style={{ marginBottom: 16 }}>This cancels <strong>{confirmCancel.vehicle_info || 'this job'}</strong> ({confirmCancel.pickup_location || '—'} → {confirmCancel.delivery_location || '—'}). If a driver is actively assigned, their trip is cancelled too, the accepted bid is rejected, and any funding the broker reserved is refunded. The job record and its history are kept, unlike Delete.</p>
              <div className="db-form-actions"><button type="button" className="db-button secondary" onClick={() => setConfirmCancel(null)}>Back</button><button className="db-button danger" disabled={busy} onClick={() => { onCancel(confirmCancel); setConfirmCancel(null); }}>Cancel job</button></div>
            </div>
          </div>
        </div>
      )}

      {bidsDeal && (
        <div className="db-modal" role="dialog" aria-modal="true" onMouseDown={e => { if (e.target === e.currentTarget) setBidsDeal(null); }}>
          <div className="db-modal-card">
            <div className="db-modal-head"><h2>Bids — {bidsDeal.vehicle_info || 'job'}</h2><button className="db-close" onClick={() => setBidsDeal(null)} aria-label="Close">×</button></div>
            <div className="db-form">
              <p className="db-job-meta" style={{ marginBottom: 16 }}>{bidsDeal.pickup_location || '—'} → {bidsDeal.delivery_location || '—'} · Broker: {bidsDeal.broker_name || '—'} · Min ${bidsDeal.minimum_rate || 0}/hr</p>
              <div className="db-bids">
                {bids.filter(b => b.deal_id === bidsDeal.id && b.status !== 'withdrawn').sort((a, b) => a.hourly_rate - b.hourly_rate).length === 0 ? (
                  <div className="db-empty"><strong>No bids yet</strong>No drivers have bid on this job.</div>
                ) : (
                  bids.filter(b => b.deal_id === bidsDeal.id && b.status !== 'withdrawn').sort((a, b) => a.hourly_rate - b.hourly_rate).map(b => (
                    <div className="db-bid-item" key={b.id}>
                      <div className="db-bid-avatar">{(b.driver_name || 'D')[0].toUpperCase()}</div>
                      <div className="db-bid-info"><strong>{b.driver_name || 'Driver'}</strong><small>{b.status}</small></div>
                      <div className="db-bid-rate">${Number(b.hourly_rate || 0).toFixed(0)}/hr</div>
                      {b.status === 'pending' ? (
                        <div className="db-inline-actions">
                          <button className="db-small-btn" disabled={busy} onClick={() => { onDecideBid(bidsDeal, b, 'accepted'); setBidsDeal(null); }}>Accept</button>
                          <button className="db-small-btn" style={{ color: 'var(--db-danger)', background: '#fff0f1' }} disabled={busy} onClick={() => { onDecideBid(bidsDeal, b, 'rejected'); setBidsDeal(null); }}>Decline</button>
                        </div>
                      ) : <span className={`db-admin-status ${b.status === 'accepted' ? 'approved' : 'rejected'}`}>{b.status}</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {posting && (
        <div className="db-modal" role="dialog" aria-modal="true" onMouseDown={e => { if (e.target === e.currentTarget) setPosting(false); }}>
          <div className="db-modal-card">
            <div className="db-modal-head"><h2>Post a delivery</h2><button className="db-close" onClick={() => setPosting(false)} aria-label="Close">×</button></div>
            <form className="db-form" onSubmit={submitPost}>
              <div className="db-form-grid">
                <Field label="Vehicle" full><input value={postForm.vehicle_info} onChange={e => setPostForm({ ...postForm, vehicle_info: e.target.value })} placeholder="2026 BMW X3" required /></Field>
                <Field label="Pickup location"><input value={postForm.pickup_location} onChange={e => setPostForm({ ...postForm, pickup_location: e.target.value })} placeholder="Dealership or full address" required /></Field>
                <Field label="Delivery location"><input value={postForm.delivery_location} onChange={e => setPostForm({ ...postForm, delivery_location: e.target.value })} placeholder="Customer or full address" required /></Field>
                <Field label="Pickup date"><input type="date" value={postForm.pickup_date} onChange={e => setPostForm({ ...postForm, pickup_date: e.target.value })} required /></Field>
                <Field label="Pickup window"><input type="time" value={postForm.pickup_time} onChange={e => setPostForm({ ...postForm, pickup_time: e.target.value })} required /></Field>
                <Field label="Driver's return arrangement" full><MobileSelect value={postForm.return_plan} onChange={v => setPostForm({ ...postForm, return_plan: v })} placeholder="Select one" required><option value="">Select one</option><option>Lease return provided</option><option>Broker will Uber driver back</option><option>Driver arranges own return</option></MobileSelect></Field>
                <Field label="Estimated job time"><MobileSelect value={postForm.estimated_hours} onChange={v => setPostForm({ ...postForm, estimated_hours: v })}>{[2, 3, 4, 5, 6, 7, 8].map(h => <option value={h} key={h}>{h} hours</option>)}</MobileSelect></Field>
                <Field label="Minimum hourly bid"><input type="number" min="15" value={postForm.minimum_rate} onChange={e => setPostForm({ ...postForm, minimum_rate: e.target.value })} required /></Field>
                <Field label="Other relevant information" full><textarea value={postForm.notes} onChange={e => setPostForm({ ...postForm, notes: e.target.value })} placeholder="Tolls, paperwork, plates, customer handoff instructions, or other details" /></Field>
              </div>
              <div className="db-form-actions"><button type="button" className="db-button secondary" onClick={() => setPosting(false)}>Cancel</button><button className="db-button" disabled={busy}>Post job</button></div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, full = false, children }) {
  return <div className={`db-field ${full ? 'full' : ''}`}><label>{label}</label>{children}</div>;
}