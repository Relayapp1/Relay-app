import React, { useEffect, useState } from 'react';
import '@/drivebid.css';
import { base44 } from '@/api/base44Client';
import DealCard from '@/components/DealCard';

export default function Deals() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');

  useEffect(() => {
    (async () => {
      try {
        const all = await base44.entities.Deal.list('-created_date', 100);
        setDeals(all);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const shown = filter === 'all' ? deals : deals.filter((d) => d.status === filter);

  return (
    <div className="p-4 md:p-6 w-full max-w-6xl">
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-1">Transport Deals</h1>
      <p className="text-stone-500 text-sm mb-6">Browse available deals and place your bid.</p>
      <div className="flex gap-2 mb-6">
        {['open', 'assigned', 'all'].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`min-h-11 px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${filter === f ? 'bg-slate-900 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:border-stone-300'}`}>{f}</button>
        ))}
      </div>
      {loading ? <div className="text-stone-400">Loading…</div> : shown.length === 0 ? (
        <div className="text-center py-16 text-stone-400 border border-dashed border-stone-200 rounded-2xl">No deals found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shown.map((d) => <DealCard key={d.id} deal={d} />)}
        </div>
      )}
    </div>
  );
}