import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Flag, Car, ArrowRight } from 'lucide-react';

export default function DealCard({ deal }) {
  return (
    <Link to={`/deals/${deal.id}`} className="block bg-white rounded-xl border border-stone-200 p-5 hover:border-amber-400 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span className="font-medium">{deal.pickup_location}</span>
          </div>
          <div className="flex items-center gap-2 text-sm pl-6">
            <Flag className="w-3.5 h-3.5 text-rose-500" />
            <span className="text-stone-600">{deal.delivery_location}</span>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-stone-300" />
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {deal.is_lease_return && <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">Lease Return</span>}
        {deal.uber_driver_back && <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded">Uber Back</span>}
        {deal.vehicle_info && <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded inline-flex items-center gap-1"><Car className="w-3 h-3" />{deal.vehicle_info}</span>}
      </div>
      {deal.target_rate && <p className="text-sm text-stone-500 mt-3">Target rate: <span className="font-semibold text-stone-800">${deal.target_rate}/hr</span></p>}
    </Link>
  );
}