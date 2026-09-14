import React, { useState } from 'react';
import '@/drivebid.css';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';

export default function PostDeal() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ pickup_location: '', delivery_location: '', vehicle_info: '', is_lease_return: false, uber_driver_back: false, pickup_date: '', target_rate: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm({ ...form, [k]: v });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.entities.Deal.create({
        ...form,
        target_rate: form.target_rate ? Number(form.target_rate) : null,
        status: 'open',
      });
      navigate('/deals');
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6 w-full max-w-2xl">
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-1">Post a Deal</h1>
      <p className="text-stone-500 text-sm mb-6">Enter the transport details. Vetted drivers will be able to bid their hourly rate.</p>
      <form onSubmit={submit} className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Pickup Location" required>
            <input required value={form.pickup_location} onChange={(e) => set('pickup_location', e.target.value)} className="input" />
          </Field>
          <Field label="Delivery Location" required>
            <input required value={form.delivery_location} onChange={(e) => set('delivery_location', e.target.value)} className="input" />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Vehicle Info">
            <input value={form.vehicle_info} onChange={(e) => set('vehicle_info', e.target.value)} placeholder="e.g. 2021 Tesla Model 3" className="input" />
          </Field>
          <Field label="Pickup Date">
            <input type="date" value={form.pickup_date} onChange={(e) => set('pickup_date', e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="Target Rate ($/hr)">
          <input type="number" min="1" step="0.01" value={form.target_rate} onChange={(e) => set('target_rate', e.target.value)} placeholder="Optional" className="input" />
        </Field>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_lease_return} onChange={(e) => set('is_lease_return', e.target.checked)} className="accent-amber-500" /> This is a lease return</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.uber_driver_back} onChange={(e) => set('uber_driver_back', e.target.checked)} className="accent-amber-500" /> Will Uber the driver back</label>
        </div>
        <Field label="Notes">
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className="input resize-none" />
        </Field>
        <button type="submit" disabled={saving} className="bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 min-h-11">{saving ? 'Posting…' : 'Post Deal'}</button>
      </form>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-stone-500">{label}{required && <span className="text-rose-500"> *</span>}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}