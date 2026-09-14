import React, { useEffect, useState } from 'react';
import '@/drivebid.css';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { MapPin, Flag, Car, Calendar, ArrowLeft } from 'lucide-react';
import BidCard from '@/components/BidCard';

export default function DealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deal, setDeal] = useState(null);
  const [bids, setBids] = useState([]);
  const [user, setUser] = useState(null);
  const [rate, setRate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [driverProfile, setDriverProfile] = useState(null);

  const load = async () => {
    const [d, b, u] = await Promise.all([
      base44.entities.Deal.get(id),
      base44.entities.Bid.filter({ deal_id: id }, 'hourly_rate', 100),
      base44.auth.me(),
    ]);
    setDeal(d); setBids(b); setUser(u);
    if (u?.account_type === 'driver') {
      const list = await base44.entities.Driver.filter({ created_by_id: u.id }, '-created_date', 1);
      setDriverProfile(list[0] || null);
    }
  };

  useEffect(() => {
    load().catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const submitBid = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await base44.entities.Bid.create({
        deal_id: id,
        driver_id: user.id,
        driver_name: user.full_name || user.email,
        hourly_rate: Number(rate),
        notes,
        status: 'pending',
      });
      setRate(''); setNotes('');
      await load();
    } catch (err) { alert(err.message); }
    finally { setSubmitting(false); }
  };

  const decide = async (bidId, status) => {
    await base44.entities.Bid.update(bidId, { status });
    if (status === 'accepted') {
      await base44.entities.Deal.update(id, { status: 'assigned' });
    }
    await load();
  };

  if (loading) return <div className="p-10 text-stone-400">Loading…</div>;
  if (!deal) return <div className="p-10 text-stone-400">Deal not found.</div>;

  const isBroker = user?.account_type === 'broker';
  const myBid = bids.find((b) => b.driver_id === user?.id);

  return (
    <div className="p-4 md:p-6 w-full max-w-4xl">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 mb-6"><ArrowLeft className="w-4 h-4" /> Back</button>
      <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${deal.status === 'open' ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>{deal.status}</span>
          {deal.target_rate && <span className="text-sm text-stone-500">Target: <span className="font-semibold text-stone-800">${deal.target_rate}/hr</span></span>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="flex items-start gap-2">
            <MapPin className="w-5 h-5 text-emerald-600 mt-0.5" />
            <div><p className="text-xs text-stone-400 uppercase">Pickup</p><p className="font-medium">{deal.pickup_location}</p></div>
          </div>
          <div className="flex items-start gap-2">
            <Flag className="w-5 h-5 text-rose-500 mt-0.5" />
            <div><p className="text-xs text-stone-400 uppercase">Delivery</p><p className="font-medium">{deal.delivery_location}</p></div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs mb-4">
          {deal.is_lease_return && <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">Lease Return</span>}
          {deal.uber_driver_back && <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded">Uber Driver Back</span>}
          {deal.vehicle_info && <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded inline-flex items-center gap-1"><Car className="w-3 h-3" />{deal.vehicle_info}</span>}
          {deal.pickup_date && <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{deal.pickup_date}</span>}
        </div>
        {deal.notes && <p className="text-sm text-stone-600 bg-stone-50 rounded-lg p-3">{deal.notes}</p>}
      </div>

      <h2 className="text-lg font-semibold mb-3">Bids ({bids.length})</h2>
      {bids.length === 0 ? <p className="text-stone-400 text-sm mb-6">No bids yet.</p> : (
        <div className="space-y-2 mb-6">
          {bids.map((b) => <BidCard key={b.id} bid={b} isBroker={isBroker} onDecide={decide} />)}
        </div>
      )}

      {!isBroker && deal.status === 'open' && !myBid && driverProfile?.status !== 'approved' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-800">
          {driverProfile?.status === 'rejected'
            ? 'Your driver application was rejected — you cannot bid on deals.'
            : 'Complete your profile and upload your driving history report to get approved before bidding.'}
        </div>
      )}
      {!isBroker && deal.status === 'open' && !myBid && driverProfile?.status === 'approved' && (
        <form onSubmit={submitBid} className="bg-white rounded-2xl border border-stone-200 p-6">
          <h3 className="font-semibold mb-3">Place Your Bid</h3>
          <p className="text-xs text-stone-500 mb-4">Drivers compete on rate — enter your best hourly rate to win this job.</p>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-medium text-stone-500">Hourly Rate ($)</label>
              <input type="number" min="1" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} required className="input" />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-500">Notes (optional)</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Available immediately…" className="input" />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 min-h-11">{submitting ? 'Submitting…' : 'Submit Bid'}</button>
        </form>
      )}
      {!isBroker && myBid && <p className="text-sm text-stone-500 bg-stone-50 rounded-lg p-3">You bid <span className="font-semibold">${myBid.hourly_rate}/hr</span> — status: <span className="capitalize">{myBid.status}</span></p>}
    </div>
  );
}