import React, { useEffect, useState } from 'react';
import RelayWordmark from '@/components/RelayWordmark';
import { getCurrentUser, updateCurrentUser } from '@/lib/supabaseAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '@/drivebid.css';

const CONSENT_VERSION = '1.0';

export default function DataConsent() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get('returnTo') || '/';
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { (async () => {
    try { setUser(await getCurrentUser()); }
    catch (error) { setMessage(error.message || 'Could not load your account'); }
    finally { setLoading(false); }
  })(); }, []);

  const accept = async () => {
    if (!checked) { setMessage('Please check the box to confirm you’ve read and agree before continuing.'); return; }
    setSaving(true); setMessage('');
    try {
      await updateCurrentUser({ data_consent_accepted_at: new Date().toISOString(), data_consent_version: CONSENT_VERSION });
      navigate(returnTo, { replace: true });
    } catch (error) { setMessage(error.message || 'Could not save your consent'); }
    finally { setSaving(false); }
  };

  const isDriver = user?.account_type === 'driver';
  const isBroker = user?.account_type === 'broker';
  const isIndividual = user?.account_type === 'individual';

  if (loading) return <div className="db-loading"><div><div className="db-spinner" /><span>Loading…</span></div></div>;

  return (
    <div className="db-shell">
      <header className="db-topbar">
        <div className="db-brand"><RelayWordmark width={100} dark /></div>
      </header>
      <main className="db-page" style={{ maxWidth: 760 }}>
        <div className="db-heading-row"><div><div className="db-eyebrow">Required before you continue</div><h1>Background Check &amp; Data Authorization</h1><p>This disclosure stands on its own — it isn't part of the Terms of Service or Privacy Policy. Please read it in full before deciding.</p></div></div>

        <div className="db-alert pending" style={{ marginBottom: 22 }}>
          <div className="db-alert-icon">!</div>
          <div><strong>Draft — not yet reviewed by a lawyer</strong><p>If Relay uses a third-party consumer reporting agency to run background/driving-history checks, this disclosure and the authorization flow must be reviewed by a lawyer for compliance with the Fair Credit Reporting Act (FCRA) and applicable state background-check laws before it's relied on. Today, Relay's vetting is a manual review by a Relay administrator — no outside consumer reporting agency is used yet.</p></div>
        </div>

        <section className="db-panel" style={{ padding: 24, marginBottom: 18, lineHeight: 1.6, fontSize: '.92rem' }}>
          <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>What we're asking you to authorize</h2>
          <p>To keep Relay's marketplace safe, we ask every user to authorize us to collect, view, and store certain personal information as part of reviewing your account, and — if you're applying as a driver — to review your driving history before you're approved to accept jobs.</p>

          <h3 style={{ fontSize: '.95rem' }}>Information we'll collect and store</h3>
          <ul>
            <li>Your name, email, and phone number.</li>
            {isDriver && <><li>Your driver's license (front and back) and license details (number, state, expiration).</li><li>Your driving history / motor vehicle record report.</li></>}
            {isBroker && <><li>Your company information, MC number, business address, and W-9.</li><li>A broker's license, if you provide one.</li></>}
            {isIndividual && <li>A photo of a government-issued ID (driver's license, state ID, or passport).</li>}
            {!isDriver && !isBroker && !isIndividual && <><li>Identity and vetting documents appropriate to your account type (driver's license and driving history for drivers, business documents for brokers, or a government ID for individuals).</li></>}
            <li>Bank details (name, account last 4 digits, routing number) if you request a payout as a driver.</li>
          </ul>

          <h3 style={{ fontSize: '.95rem' }}>Driving history / background review {isDriver ? '(applies to your account)' : '(applies to driver accounts)'}</h3>
          <p>{isDriver ? 'Because you’re applying as a driver, Relay' : 'For driver accounts, Relay'} reviews driving history as part of deciding whether to approve that account to accept jobs on the platform. This may include license validity, driving record, and any information you provide as part of your application. You have the right to ask Relay what was reviewed as part of your application, and to correct any information you believe is inaccurate by contacting us.</p>

          <h3 style={{ fontSize: '.95rem' }}>How this information is used</h3>
          <p>We use this information solely to evaluate your application, verify your identity, keep the marketplace safe for other users, process payments (for bank details), and comply with legal obligations. It's stored in private, access-restricted storage — never shown publicly, and never shown to other users beyond what's described in our <a href="/privacy" style={{ color: 'var(--db-blue)', fontWeight: 700 }}>Privacy Policy</a>.</p>

          <h3 style={{ fontSize: '.95rem' }}>Your rights</h3>
          <ul>
            <li>You can withdraw this authorization at any time by deleting your account from your profile page, which permanently deletes this information.</li>
            <li>You can request a copy of the information we hold about you, or ask us to correct it, by contacting us.</li>
            <li>Giving this authorization is required to apply for or maintain an approved account on Relay — without it, we can't review or approve your application.</li>
          </ul>
        </section>

        {message && <div className="db-notice" style={{ marginBottom: 16 }}>{message}</div>}

        <section className="db-panel" style={{ padding: 24 }}>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontWeight: 700, fontSize: '.92rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} style={{ width: 'auto', marginTop: 3 }} />
            I have read this disclosure and I authorize Relay to collect, view, and store the personal information described above{isDriver ? ', including reviewing my driving history,' : ''} as part of my Relay account.
          </label>
          <div className="db-form-actions" style={{ marginTop: 18 }}>
            <button type="button" className="db-button secondary" onClick={() => navigate('/profile')} disabled={saving}>Not now</button>
            <button className="db-button" onClick={accept} disabled={saving}>{saving ? 'Saving…' : 'I Agree & Continue'}</button>
          </div>
        </section>
      </main>
    </div>
  );
}
