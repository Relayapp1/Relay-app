import React from 'react';
import Logo from '@/components/Logo';
import { useNavigate } from 'react-router-dom';
import '@/drivebid.css';

const EFFECTIVE_DATE = '[DATE NOT YET SET]';
const COMPANY_NAME = '[LEGAL ENTITY NAME]';
const CONTACT_EMAIL = '[support@yourdomain.com]';
const GOVERNING_STATE = '[STATE]';

export default function TermsOfService() {
  const navigate = useNavigate();
  return (
    <div className="db-shell">
      <header className="db-topbar">
        <div className="db-brand"><div className="db-brandmark"><Logo/></div><span>Relay</span></div>
        <button className="db-button secondary db-admin-back" onClick={() => navigate(-1)}>← Back</button>
      </header>
      <main className="db-page" style={{ maxWidth: 820 }}>
        <div className="db-heading-row"><div><div className="db-eyebrow">Legal</div><h1>Terms of Service</h1><p>Effective date: {EFFECTIVE_DATE}</p></div></div>
        <div className="db-alert pending" style={{ marginBottom: 22 }}>
          <div className="db-alert-icon">!</div>
          <div><strong>Draft — not yet reviewed by a lawyer</strong><p>This is a working draft, including a standard arbitration/dispute-resolution clause and independent-contractor language, matched to how Relay's marketplace actually works today. Have a licensed attorney review and finalize it — particularly the liability, indemnification, and dispute-resolution sections — before relying on it or removing this notice. Replace every bracketed placeholder first.</p></div>
        </div>

        <Section title="1. Agreement to terms">
          <p>These Terms of Service ("Terms") govern your access to and use of Relay (the "Platform"), operated by {COMPANY_NAME}. By creating an account or using Relay, you agree to these Terms and to our <a href="/privacy" style={{ color: 'var(--db-blue)', fontWeight: 700 }}>Privacy Policy</a>. If you don't agree, don't use Relay.</p>
        </Section>

        <Section title="2. Who can use Relay">
          <p>You must be at least 18 years old and able to form a binding contract to use Relay. Drivers must hold a valid driver's license. By creating an account, you confirm the information you provide is accurate and that you meet these requirements.</p>
        </Section>

        <Section title="3. What Relay is">
          <p>Relay is a marketplace that connects brokers and individuals who need vehicles transported ("Posters") with independent drivers who bid to complete that work ("Drivers"). Relay is not a party to the transport arrangement between a Poster and a Driver, does not employ Drivers, and is not a transportation carrier. Drivers operate as independent contractors, not as employees or agents of Relay, and are solely responsible for how they perform a job, including compliance with applicable traffic and licensing laws.</p>
        </Section>

        <Section title="4. Account types and vetting">
          <p>Relay offers three account types: Driver, Broker, and Individual. Each requires an application with supporting documentation (for example, a driver's license and driving history authorization for Drivers; a W-9 and business information for Brokers; a government ID for Individuals) before you can bid on or post jobs. Relay reviews applications and may approve, reject, or request more information at its discretion. Approval does not guarantee future access — Relay may suspend or revoke your approval at any time, including for policy violations, safety concerns, or repeated cancellations.</p>
        </Section>

        <Section title="5. Jobs, bidding, and cancellation">
          <p>Posters describe a job and a minimum acceptable rate; Drivers submit bids; the Poster chooses which bid to accept. Once a bid is accepted, both parties are expected to complete the job as agreed. If a Driver cancels after their bid has been accepted, a cancellation fee (currently 10% of the estimated job value) is deducted from their Relay wallet, which may result in a negative balance recovered from future earnings, and the job is automatically reposted to the marketplace. Relay may change this fee or policy at any time with notice through the app.</p>
        </Section>

        <Section title="6. Payments and the Relay wallet">
          <p>Job payments move through an in-app Relay wallet, not directly between users' bank accounts. Posters add funds to their wallet and reserve estimated job funding before a Driver departs; Drivers are paid into their wallet upon delivery approval and can request a withdrawal to their bank account (standard, or instant for an additional fee). All deposits and withdrawals are currently reviewed by a Relay administrator before funds move. Relay does not guarantee any minimum earnings for Drivers or any particular pool of available jobs for Posters.</p>
          <p>[If Relay later charges its own platform fee (e.g., a per-job or subscription fee) — see the product's internal deferred-items list — this section, and the in-app purchase/billing method used, will need review against Apple and Google's digital-goods billing rules before launch.]</p>
        </Section>

        <Section title="7. Conduct">
          <p>You agree not to: provide false information on an application or job posting; use Relay for any illegal purpose; harass, threaten, or discriminate against another user; attempt to circumvent Relay's vetting, payment, or fee systems; or interfere with the security or normal operation of the Platform. Relay may suspend or terminate your account for violating these Terms.</p>
        </Section>

        <Section title="8. Reviews and content">
          <p>You may submit reviews, ratings, messages, and other content through Relay. You're responsible for what you submit, and it must not be false, defamatory, or unlawful. You grant Relay a license to use, store, and display content you submit as needed to operate the Platform (for example, showing your rating to other users).</p>
        </Section>

        <Section title="9. Disclaimers">
          <p>Relay is provided "as is" without warranties of any kind, express or implied. Relay does not guarantee the accuracy of any Driver's or Poster's information, the condition of any vehicle, or the outcome of any job. You use Relay, and engage with other users, at your own risk.</p>
        </Section>

        <Section title="10. Limitation of liability">
          <p>To the fullest extent permitted by law, {COMPANY_NAME} will not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or data, arising from your use of Relay. [A dollar-cap on direct damages and specific carve-outs are standard here — a lawyer should set the right limits and any required state-specific exceptions.]</p>
        </Section>

        <Section title="11. Indemnification">
          <p>You agree to indemnify and hold {COMPANY_NAME} harmless from any claims, damages, or expenses (including reasonable attorneys' fees) arising from your use of Relay, your violation of these Terms, or your violation of any law or the rights of a third party.</p>
        </Section>

        <Section title="12. Dispute resolution">
          <p>[Placeholder — decide with a lawyer whether Relay wants binding arbitration with a class-action waiver (common for marketplace apps) or standard court jurisdiction, and draft this section accordingly before publishing.] Any dispute arising from these Terms or your use of Relay will be resolved in the state or federal courts located in {GOVERNING_STATE}, and you consent to that jurisdiction.</p>
        </Section>

        <Section title="13. Account termination">
          <p>You may delete your account at any time from your profile page. Relay may suspend or terminate your account at any time, with or without notice, for violating these Terms or for any other reason at Relay's discretion. Sections of these Terms that by their nature should survive termination (including Sections 9–12) will survive.</p>
        </Section>

        <Section title="14. Changes to these terms">
          <p>We may update these Terms from time to time. If we make material changes, we'll notify you by email or through the app before the changes take effect. Continuing to use Relay after a change takes effect means you accept the updated Terms.</p>
        </Section>

        <Section title="15. Contact us">
          <p>Questions about these Terms? Contact us at {CONTACT_EMAIL}.</p>
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
