import React, { useEffect, useState } from 'react';
import '@/drivebid.css';
import { base44 } from '@/api/base44Client';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        const entity = u.account_type === 'broker' ? 'Broker' : 'Driver';
        const list = await base44.entities[entity].filter({ created_by_id: u.id }, '-created_date', 1);
        if (list[0]) { setProfile(list[0]); setForm(list[0]); }
      } catch (e) { console.error(e); }
    })();
  }, []);

  const isBroker = user?.account_type === 'broker';

  const submit = async (e) => {
    e.preventDefault();
    if (!isBroker && (!form.license_front || !form.license_back || !form.driving_history_report)) {
      alert('Please upload your license front, license back, and driver abstract before saving your profile.');
      return;
    }
    setSaving(true);
    try {
      const entity = isBroker ? 'Broker' : 'Driver';
      const payload = { ...form, email: user.email, full_name: user.full_name || form.full_name };
      if (profile) {
        await base44.entities[entity].update(profile.id, payload);
      } else {
        const created = await base44.entities[entity].create(payload);
        setProfile(created);
      }
      alert('Profile saved.');
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const uploadFile = async (field, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(field);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm({ ...form, [field]: file_url });
    } catch (err) { alert(err.message); }
    finally { setUploading(null); }
  };

  if (!user) return <div className="p-10 text-stone-400">Loading…</div>;

  return (
    <div className="p-4 md:p-6 w-full max-w-2xl">
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-1">{isBroker ? 'Broker Profile' : 'Driver Profile'}</h1>
      <p className="text-stone-500 text-sm mb-6">{isBroker ? 'Your company details shown on posted deals.' : 'Complete your profile to get vetted and start bidding.'}</p>
      <form onSubmit={submit} className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
        {isBroker ? (
          <>
            <Field label="Company Name" required><input required value={form.company || ''} onChange={(e) => setForm({ ...form, company: e.target.value })} className="input" /></Field>
            <Field label="Phone"><input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" /></Field>
            <Field label="MC Number"><input value={form.mc_number || ''} onChange={(e) => setForm({ ...form, mc_number: e.target.value })} className="input" /></Field>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Phone" required><input required value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" /></Field>
              <Field label="License Number"><input value={form.license_number || ''} onChange={(e) => setForm({ ...form, license_number: e.target.value })} className="input" /></Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="License State" required><input required value={form.license_state || ''} onChange={(e) => setForm({ ...form, license_state: e.target.value })} className="input" /></Field>
              <Field label="License Expiration" required><input type="date" required value={form.license_expiration || ''} onChange={(e) => setForm({ ...form, license_expiration: e.target.value })} className="input" /></Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Years Experience"><input type="number" min="0" value={form.years_experience ?? ''} onChange={(e) => setForm({ ...form, years_experience: Number(e.target.value) })} className="input" /></Field>
              <Field label="Home Location"><input value={form.home_location || ''} onChange={(e) => setForm({ ...form, home_location: e.target.value })} className="input" /></Field>
            </div>
            <Field label="Preferred Hourly Rate ($)"><input type="number" min="1" step="0.01" value={form.preferred_rate ?? ''} onChange={(e) => setForm({ ...form, preferred_rate: Number(e.target.value) })} className="input" /></Field>
            <Field label="Vehicle Types"><input value={form.vehicle_types || ''} onChange={(e) => setForm({ ...form, vehicle_types: e.target.value })} placeholder="Sedan, SUV, Truck…" className="input" /></Field>
            <Field label="Bio"><textarea value={form.bio || ''} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} className="input resize-none" /></Field>
            <label className="flex items-start gap-2 text-sm text-stone-600">
              <input type="checkbox" required checked={!!form.driving_history_consent} onChange={(e) => setForm({ ...form, driving_history_consent: e.target.checked })} className="mt-0.5 accent-amber-500" />
              <span>I consent to a driving history background check based on my <strong>{form.license_state || 'licensing state'}</strong> record. <span className="text-rose-500">*</span></span>
            </label>
            <div className="rounded-xl border border-stone-200 p-4 space-y-4 bg-stone-50/50">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Required Documents</p>
              <FileUpload label="Driver's License — Front" field="license_front" value={form.license_front} uploading={uploading} onUpload={uploadFile} required />
              <FileUpload label="Driver's License — Back" field="license_back" value={form.license_back} uploading={uploading} onUpload={uploadFile} required />
              <FileUpload label="Driver Abstract (Full Driving History)" field="driving_history_report" value={form.driving_history_report} uploading={uploading} onUpload={uploadFile} required />
            </div>
            {profile?.status && (
              <div className={`text-sm rounded-lg p-3 ${profile.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : profile.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                {profile.status === 'approved' ? "You're approved — you can bid on deals." : profile.status === 'rejected' ? 'Your application was rejected. Please contact support.' : 'Your application is pending review. You can bid once approved.'}
              </div>
            )}
          </>
        )}
        <button type="submit" disabled={saving} className="bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 min-h-11">{saving ? 'Saving…' : 'Save Profile'}</button>
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

function FileUpload({ label, field, value, uploading, onUpload, required }) {
  return (
    <div>
      <label className="text-xs font-medium text-stone-500">{label}{required && <span className="text-rose-500"> *</span>}</label>
      <div className="mt-1">
        {value ? (
          <div className="flex items-center gap-3">
            <a href={value} target="_blank" rel="noreferrer" className="text-sm text-amber-600 hover:underline">View uploaded file</a>
            <label className="text-xs text-stone-500 cursor-pointer hover:text-stone-800">Replace
              <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => onUpload(field, e)} className="hidden" />
            </label>
          </div>
        ) : (
          <label className="flex items-center justify-center border-2 border-dashed border-stone-200 rounded-lg p-4 cursor-pointer hover:border-amber-400 text-sm text-stone-500 bg-white">
            {uploading === field ? 'Uploading…' : 'Click to upload (PDF or image)'}
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => onUpload(field, e)} className="hidden" />
          </label>
        )}
      </div>
    </div>
  );
}