import React from 'react';

export default function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4">
      <div className="flex items-center gap-2 text-stone-400 mb-1">
        {Icon && <Icon className="w-4 h-4" />}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-lg font-semibold truncate">{value}</p>
    </div>
  );
}