import React from 'react';
import { Check, X } from 'lucide-react';

export default function BidCard({ bid, isBroker, onDecide }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 flex items-center justify-between">
      <div>
        <p className="font-medium">{bid.driver_name || 'Driver'}</p>
        <p className="text-sm text-stone-500">${bid.hourly_rate}/hr {bid.notes && <span className="text-stone-400">· {bid.notes}</span>}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${bid.status === 'accepted' ? 'bg-emerald-50 text-emerald-700' : bid.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{bid.status}</span>
        {isBroker && bid.status === 'pending' && (
          <>
            <button onClick={() => onDecide(bid.id, 'accepted')} className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"><Check className="w-4 h-4" /></button>
            <button onClick={() => onDecide(bid.id, 'rejected')} className="p-1.5 rounded-lg bg-stone-200 text-stone-600 hover:bg-stone-300"><X className="w-4 h-4" /></button>
          </>
        )}
      </div>
    </div>
  );
}