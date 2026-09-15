import React, { useState } from 'react';
import Logo from '@/components/Logo';
import { changePassword } from '@/lib/supabaseAuth';
import { useNavigate } from 'react-router-dom';
import '@/drivebid.css';

export default function ChangePassword() {
  const navigate = useNavigate();
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    if (pwd.next !== pwd.confirm) { setError('New passwords do not match.'); return; }
    if (pwd.next.length < 8) { setError('New password must be at least 8 characters.'); return; }
    setSaving(true);
    try {
      await changePassword(pwd.current, pwd.next);
      setMessage('Password updated. Redirecting…');
      window.setTimeout(() => navigate('/profile'), 1200);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Could not update password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="db-shell">
      <header className="db-topbar">
        <div className="db-brand"><div className="db-brandmark"><Logo/></div><span>Relay</span></div>
        <button className="db-button secondary db-admin-back" onClick={() => navigate('/profile')}>← Back to profile</button>
      </header>
      <main className="db-page">
        <div className="db-heading-row">
          <div><div className="db-eyebrow">Security</div><h1>Change password</h1><p>Enter your current password and choose a new one.</p></div>
        </div>
        {error && <div className="db-alert pending" style={{ marginBottom: 16 }}><div className="db-alert-icon">!</div><div><strong>Could not update</strong><p>{error}</p></div></div>}
        {message && <div className="db-notice" style={{ marginBottom: 16 }}>{message}</div>}
        <section className="db-panel" style={{ maxWidth: 520 }}>
          <form className="db-form" onSubmit={submit}>
            <div className="db-form-grid">
              <Field label="Current password" full><input type="password" required value={pwd.current} onChange={e => setPwd({ ...pwd, current: e.target.value })} /></Field>
              <Field label="New password"><input type="password" required minLength={8} value={pwd.next} onChange={e => setPwd({ ...pwd, next: e.target.value })} /></Field>
              <Field label="Confirm new password"><input type="password" required minLength={8} value={pwd.confirm} onChange={e => setPwd({ ...pwd, confirm: e.target.value })} /></Field>
            </div>
            <div className="db-form-actions">
              <button type="button" className="db-button secondary" onClick={() => navigate('/profile')}>Cancel</button>
              <button className="db-button" disabled={saving}>{saving ? 'Updating…' : 'Update password'}</button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

function Field({ label, full = false, children }) {
  return <div className={`db-field ${full ? 'full' : ''}`}><label>{label}</label>{children}</div>;
}