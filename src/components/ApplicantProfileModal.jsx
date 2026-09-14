import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatPhone } from '@/lib/phone';

export default function ApplicantProfileModal({ applicant, trips, deals, reviews, onClose, onApprove, onReject, onRequestInfo, busy, openDocument }) {
  const navigate=useNavigate();
  if (!applicant) return null;
  const { entity, record } = applicant;
  const isDriver = entity === 'Driver';
  const title = isDriver ? (record.full_name || 'Driver') : (record.company || record.full_name || 'Broker');
  const status = record.status || 'pending';
  const docs = isDriver ? [
    { label: 'License front', uri: record.license_front },
    { label: 'License back', uri: record.license_back },
    { label: 'Driving history', uri: record.driving_history_report },
    { label: 'License file', uri: record.license_document }
  ].filter(d => d.uri) : [];
  const uid = record.created_by_id;
  const myTrips = (trips || []).filter(t => t.driver_id === uid);
  const myDeals = (deals || []).filter(d => d.broker_id === uid);
  const myReviews = (reviews || []).filter(r => r.reviewee_id === uid);
  const completedTrips = myTrips.filter(t => t.status === 'completed').length;
  const cancelledTrips = myTrips.filter(t => t.status === 'cancelled').length;
  const activeTrips = myTrips.filter(t => ['scheduled', 'in_progress', 'paused'].includes(t.status)).length;
  const totalMinutes = myTrips.reduce((s, t) => s + Number(t.tracked_minutes || 0), 0);
  const openDeals = myDeals.filter(d => d.status === 'open').length;
  const completedDeals = myDeals.filter(d => d.status === 'completed').length;
  const cancelledDeals = myDeals.filter(d => d.status === 'cancelled').length;

  return (
    <div className="db-modal" role="dialog" aria-modal="true" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="db-modal-card">
        <div className="db-modal-head"><h2>{title}</h2><button className="db-close" onClick={onClose} aria-label="Close">×</button></div>
        <div className="db-form" style={{ maxWidth: 'none' }}>
          <div className="db-chips">
            <span className="db-chip">{status}</span>
            {isDriver && record.license_state && <span className="db-chip">{record.license_state}</span>}
            {!isDriver && record.company && <span className="db-chip">{record.company}</span>}
          </div>
          <Row label="Email" value={record.email} />
          <Row label="Phone" value={formatPhone(record.phone)} />
          {isDriver ? (
            <>
              <Row label="License number" value={record.license_number} />
              <Row label="License expiration" value={record.license_expiration} />
              <Row label="Years experience" value={record.years_experience} />
              <Row label="Home location" value={record.home_location} />
              <Row label="Preferred rate" value={record.preferred_rate ? `$${record.preferred_rate}/hr` : null} />
              <Row label="Vehicle types" value={record.vehicle_types} />
              <Row label="Completed deliveries" value={record.completed_deliveries} />
              <Row label="Cancelled trips" value={record.cancelled_trips} />
              <Row label="Rating" value={record.rating ? `${Number(record.rating).toFixed(1)} / 5` : null} />
              {record.bio && <p className="db-job-meta" style={{ margin: '8px 0' }}>{record.bio}</p>}
              <div className="db-mini-title">Documents</div>
              <div className="db-admin-docs">
                {docs.length ? docs.map(d => <button key={d.label} className="db-link-btn" onClick={() => openDocument(d.uri)}>{d.label}</button>) : <span style={{ fontSize: 13, color: 'var(--db-muted)' }}>No documents uploaded</span>}
              </div>
              <div className="db-mini-title">Driver dashboard</div>
              <Row label="Active trips" value={activeTrips} />
              <Row label="Completed trips" value={completedTrips} />
              <Row label="Cancelled trips" value={cancelledTrips} />
              <Row label="Total tracked hours" value={(totalMinutes / 60).toFixed(1)} />
            </>
          ) : (
            <>
              <Row label="Company" value={record.company} />
              <Row label="MC number" value={record.mc_number} />
              <Row label="Business address" value={record.business_address} />
              <Row label="Rating" value={record.rating ? `${Number(record.rating).toFixed(1)} / 5` : null} />
              <div className="db-mini-title">Broker dashboard</div>
              <Row label="Open jobs" value={openDeals} />
              <Row label="Completed jobs" value={completedDeals} />
              <Row label="Cancelled jobs" value={cancelledDeals} />
            </>
          )}
          <div className="db-mini-title">Reviews ({myReviews.length})</div>
          {myReviews.length ? myReviews.map(r => <article className="db-review" key={r.id}><strong>{'★'.repeat(Math.max(1, Math.min(5, Math.round(r.rating))))}</strong><p>{r.comment || 'No written comment.'}</p><small>From {r.reviewer_name || r.reviewer_role}</small></article>) : <p className="db-job-meta">No reviews yet.</p>}
          <div className="db-form-actions" style={{ marginTop: 16 }}>
            <button className="db-button" onClick={()=>navigate(`/?actAs=${uid}`)}>Open {isDriver?'driver':'broker'} dashboard</button>
            <button className="db-button" disabled={busy || status === 'approved'} onClick={onApprove}>{busy ? 'Saving…' : status === 'approved' ? 'Approved' : 'Approve'}</button>
            <button className="db-button danger" disabled={busy || status === 'rejected'} onClick={onReject}>{status === 'rejected' ? 'Rejected' : 'Reject'}</button>
            <button className="db-button secondary" disabled={busy} onClick={onRequestInfo}>{busy ? 'Sending…' : 'Request more info'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return value ? <div className="db-status-row">{label}<span>{value}</span></div> : null;
}