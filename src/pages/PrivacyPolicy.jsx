import React from 'react';
import { useNavigate } from 'react-router-dom';
import '@/drivebid.css';

const EFFECTIVE_DATE = '[DATE NOT YET SET]';
const COMPANY_NAME = '[LEGAL ENTITY NAME]';
const CONTACT_EMAIL = '[privacy@yourdomain.com]';
const GOVERNING_STATE = '[STATE]';

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  return (
    <div className="db-shell">
      <header className="db-topbar">
        <div className="db-brand"><div className="db-brandmark">R</div><span>Relay</span></div>
        <button className="db-button secondary db-admin-back" onClick={() => navigate(-1)}>← Back</button>
      </header>
      <main className="db-page" style={{ maxWidth: 820 }}>
        <div className="db-heading-row"><div><div className="db-eyebrow">Legal</div><h1>Privacy Policy</h1><p>Effective date: {EFFECTIVE_DATE}</p></div></div>
        <div className="db-alert pending" style={{ marginBottom: 22 }}>
          <div className="db-alert-icon">!</div>
          <div><strong>Draft — not yet reviewed by a lawyer</strong><p>This is a working draft generated to match what Relay actually collects and does today. Before relying on it (or removing this notice), have a licensed attorney review it — especially the background-check, financial-data, and multi-state sections. Replace every bracketed placeholder below with real information first.</p></div>
        </div>

        <Section title="Who we are">
          <p>Relay ("Relay," "we," "us," or "our") operates a marketplace mobile and web application connecting brokers, individuals, and drivers for vehicle transport and delivery jobs. This Privacy Policy explains what personal information we collect, how we use it, who we share it with, and the choices you have. It applies to everyone who creates a Relay account — drivers, brokers, and individuals posting jobs.</p>
          <p>Relay is operated by {COMPANY_NAME}. If you have questions about this policy, contact us at {CONTACT_EMAIL}.</p>
        </Section>

        <Section title="Information we collect">
          <p><strong>Account information (all users):</strong> full name, email address, phone number, password, and account type (driver, broker, or individual).</p>
          <p><strong>Driver vetting information:</strong> driver's license number, state, expiration date, and photos of the front and back of your license; your consent to a driving history / motor vehicle record review, and the resulting report; years of experience, vehicle types you operate, a short bio, and your general operating area.</p>
          <p><strong>Broker vetting information:</strong> company name, MC number, business address, your W-9, and (optionally) a broker's license document.</p>
          <p><strong>Individual poster vetting information:</strong> a photo of a government-issued ID (driver's license, state ID, or passport).</p>
          <p><strong>Financial information:</strong> for drivers withdrawing earnings, we collect a bank name, account number's last four digits, and routing number. We do not store full bank account numbers or card numbers. Your in-app wallet balance and transaction history (deposits, withdrawals, payments, fees) are stored as part of your account.</p>
          <p><strong>Trip and job information:</strong> pickup and delivery locations, vehicle information, job pricing and bids, photographs of vehicle condition at pickup and delivery, expense receipts, and in-app messages between you and the other party to a job.</p>
          <p><strong>Location information:</strong> while an active trip is in progress and only after you separately opt in on that trip, we collect your device's GPS location so the broker can track delivery progress. Location sharing stops when you pause, complete, or stop it, or when the trip ends. We do not collect your location outside of an active, consented trip.</p>
          <p><strong>Reviews and ratings:</strong> star ratings and written reviews left about you by counterparties after a completed job.</p>
          <p><strong>Usage and device information:</strong> standard technical data such as IP address, device and browser type, and how you interact with the app, collected automatically.</p>
        </Section>

        <Section title="Background checks and driving history">
          <p>If you apply as a driver, we ask you to authorize us to review your driving history / motor vehicle record as part of deciding whether to approve you to accept jobs on Relay. You'll be shown a separate authorization screen describing this in more detail and asking for your explicit consent before we proceed — see our <a href="/data-consent" style={{ color: 'var(--db-blue)', fontWeight: 700 }}>Background Check &amp; Data Authorization</a> disclosure. [If Relay begins using a third-party consumer reporting agency to run these checks, this section must be updated to reflect Fair Credit Reporting Act (FCRA) disclosure and adverse-action requirements, and a lawyer should confirm the standalone-disclosure format is compliant.]</p>
        </Section>

        <Section title="How we use your information">
          <ul>
            <li>To create and manage your account, and to verify your identity and eligibility to use Relay as a driver, broker, or individual poster.</li>
            <li>To operate the marketplace — matching brokers/individuals with drivers, processing bids and job assignments, and tracking jobs from pickup to delivery.</li>
            <li>To process payments through your in-app wallet, including deposits, withdrawals, job payments, and fees.</li>
            <li>To enable communication between drivers and brokers/individuals about a specific job.</li>
            <li>To promote safety — reviewing driving history, displaying vetting status, collecting vehicle-condition photos, and supporting live location sharing during active trips.</li>
            <li>To investigate and resolve disputes, incidents, and cancellations, and to prevent fraud and abuse of the platform.</li>
            <li>To send you service messages (job updates, payment confirmations, reminders) and, where you've agreed, other communications.</li>
            <li>To comply with legal obligations and enforce our Terms of Service.</li>
          </ul>
        </Section>

        <Section title="What we don't show other users">
          <p>Before a broker or individual accepts your bid, they see only your first name and last initial, your general operating area, your vetted status, your rating, and your delivery/reliability history — never your email, phone number, home address, or uploaded documents. After a job is assigned, you and the other party can message each other in-app about that job.</p>
        </Section>

        <Section title="Who we share information with">
          <ul>
            <li><strong>Other Relay users, limited as described above</strong> — a broker sees a driver's public profile info and, after assignment, the driver's name in trip records; a driver sees the broker's company name/name.</li>
            <li><strong>Service providers</strong> who help us run Relay, including our application hosting and backend infrastructure provider, and Google (if you sign in with Google). These providers only receive the information needed to perform their function and are not permitted to use it for their own purposes.</li>
            <li><strong>Legal and safety</strong> — we may disclose information if required by law, subpoena, or other legal process, or where we believe disclosure is necessary to protect the rights, property, or safety of Relay, our users, or the public.</li>
            <li><strong>Business transfers</strong> — if Relay is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction; we'll notify you if this happens and your information becomes subject to a different privacy policy.</li>
          </ul>
          <p>We do not sell your personal information.</p>
        </Section>

        <Section title="How long we keep your information">
          <p>We keep your information for as long as your account is active, plus a period afterward as needed to comply with legal, tax, and recordkeeping obligations, resolve disputes, and enforce our agreements. You can request deletion of your account and data at any time from your profile page — see "Your choices" below.</p>
        </Section>

        <Section title="Your choices">
          <ul>
            <li><strong>Access and correction:</strong> you can view and update most of your account information directly from your Relay profile.</li>
            <li><strong>Deletion:</strong> you can permanently delete your account and associated data (profile, trips, bids, wallet, documents, messages, and reviews) at any time from your profile page. This action cannot be undone.</li>
            <li><strong>Location:</strong> live location sharing is opt-in per trip; you can decline or stop it at any time from an active trip.</li>
            <li><strong>Communications:</strong> you can ask us to stop non-essential communications by contacting us at {CONTACT_EMAIL}; we may still send you service messages necessary to operate your account.</li>
          </ul>
          <p>Depending on where you live, you may have additional rights over your personal information under laws like the California Consumer Privacy Act. [This section should be expanded with jurisdiction-specific rights and request procedures once a lawyer confirms which state/national privacy laws apply to Relay's user base.]</p>
        </Section>

        <Section title="Security">
          <p>We use reasonable administrative, technical, and physical safeguards to protect your information, including storing sensitive documents (licenses, IDs, driving history reports, W-9s) in private storage that is not publicly accessible and is only viewable by you and authorized administrators. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.</p>
        </Section>

        <Section title="Children's privacy">
          <p>Relay is not directed to, and may not be used by, anyone under the age of 18. We do not knowingly collect personal information from children. If we learn we've collected information from someone under 18, we will delete it.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>We may update this Privacy Policy from time to time. If we make material changes, we'll notify you by email or through the app before the changes take effect. Your continued use of Relay after a change takes effect means you accept the updated policy.</p>
        </Section>

        <Section title="Contact us">
          <p>Questions about this Privacy Policy or your personal information? Contact us at {CONTACT_EMAIL}. This policy is governed by the laws of {GOVERNING_STATE}. [Confirm governing law with a lawyer once the company's home jurisdiction is finalized.]</p>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }) {
  return <section className="db-panel" style={{ padding: 24, marginBottom: 18 }}>
    <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>{title}</h2>
    <div style={{ color: 'var(--db-ink)', lineHeight: 1.6, fontSize: '.92rem' }}>{children}</div>
  </section>;
}
