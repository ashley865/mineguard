import { Link } from "react-router-dom";

// A standing legal document, not a translated UI screen — kept in one authoritative
// language (unlike the rest of the app, which runs through i18n) so its wording can't
// drift from what counsel actually reviewed in each of the 5 locales. Update the "Last
// updated" date whenever the content below changes.
const LAST_UPDATED = "18 August 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-mine-50">{title}</h2>
      <div className="text-sm text-mine-300 space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-mine-950 text-mine-100">
      <div className="max-w-3xl mx-auto px-5 py-10 space-y-8">
        <div>
          <Link to="/login" className="text-xs text-mine-400 hover:text-mine-100 underline">
            ← Back to sign in
          </Link>
          <h1 className="text-2xl font-bold text-mine-50 mt-3">Privacy Policy</h1>
          <p className="text-xs text-mine-400 mt-1">Last updated: {LAST_UPDATED}</p>
          <div className="mt-4 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            This is a template privacy notice prepared for the MineGuard platform. It is
            written to align with South Africa's Protection of Personal Information Act 4
            of 2013 ("POPIA"), the primary data protection law applicable to this
            deployment. It is not a substitute for legal advice — the mine operator using
            MineGuard should have this reviewed and adapted by qualified counsel before
            relying on it as a binding policy, particularly if staff, buyers, or
            contractors are located outside South Africa.
          </div>
        </div>

        <Section title="1. Who this policy covers">
          <p>
            This policy explains how MineGuard collects, uses, stores, and protects
            personal information belonging to mine staff and executives, contractors,
            marketplace buyers, site visitors, and anyone else whose information is
            captured through the platform (together, "you").
          </p>
          <p>
            The mine operator that deployed this MineGuard instance is the "responsible
            party" under POPIA for the personal information processed through it. Where
            MineGuard is provided as software to that operator, MineGuard acts as an
            "operator" (processor) processing information on the mine's instruction and
            under a written agreement with the mine, as POPIA requires.
          </p>
        </Section>

        <Section title="2. Information we collect">
          <p>Depending on your relationship with the mine, this can include:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Identity and contact details</strong> — name, email address, phone number, ID or registration number, job title.</li>
            <li><strong>Account and security data</strong> — password (stored as a salted hash, never in plain text), multi-factor authentication status, login timestamps, IP addresses, device/browser information, and login success/failure events, used to detect and block suspicious access.</li>
            <li><strong>Employment and compliance records</strong> — attendance, training, certifications, incident reports (including photo evidence you or others submit), medical surveillance and safety records required by mining regulations.</li>
            <li><strong>Buyer and contractor onboarding information</strong> — legal/trading name, tax and VAT numbers, dealer license details, banking details, source-of-funds declarations, and supporting documents, collected to meet FICA, AML, and mineral-trading regulatory obligations.</li>
            <li><strong>Visitor records</strong> — name, company, host, and site visited, for site access control.</li>
            <li><strong>Communications</strong> — messages you send within the platform, and support requests.</li>
          </ul>
        </Section>

        <Section title="3. Why we process your information">
          <p>We process personal information where at least one of the following applies, consistent with POPIA's lawful processing conditions:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>It is necessary to perform a contract with you (e.g. your employment, contractor agreement, or marketplace participation).</li>
            <li>It is necessary to comply with a legal obligation (e.g. mine health-and-safety regulation, FICA/AML record-keeping, tax law).</li>
            <li>You have given consent (e.g. the POPIA, FICA, and AML declarations completed during buyer registration).</li>
            <li>It is necessary for the mine's or MineGuard's legitimate interests — principally, keeping the platform and the mine site secure — provided this does not unreasonably override your own privacy rights. Login IP/device recording, brute-force detection, and automatic blocking of suspicious IP addresses fall under this basis.</li>
          </ul>
        </Section>

        <Section title="4. How we protect your information">
          <p>Security measures built into the platform include, among others:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Passwords stored as salted bcrypt hashes, never in plain text or a reversible form.</li>
            <li>Multi-factor authentication (TOTP) available for staff accounts.</li>
            <li>Role-based access control, so users only see information relevant to their role and mine.</li>
            <li>IP address logging on every login, automatic blocking of IP addresses after repeated failed login attempts, and an admin-managed IP blocklist.</li>
            <li>Configured integration secrets (API keys, webhook URLs) are never exposed to the browser once saved — only whether one is configured is shown, not the value itself.</li>
            <li>Encrypted data transport (HTTPS/TLS) between your browser and our servers.</li>
            <li>Rate limiting on authentication and API endpoints to reduce automated abuse.</li>
          </ul>
          <p>No system is completely immune to risk. If we become aware of a security compromise affecting your personal information, we will take reasonable steps to notify affected individuals and the Information Regulator as required by POPIA.</p>
        </Section>

        <Section title="5. Who we share information with">
          <p>
            We do not sell personal information. It may be shared with: other authorized
            users at your mine who need it to do their jobs; service providers who host
            our infrastructure; and, only where a mine's administrator has explicitly
            configured such an integration, a third-party AI provider (for AI-assisted
            analysis features), a commodity price data provider, or a notification
            webhook endpoint (e.g. Slack). These integrations are opt-in and controlled
            per deployment — if none are configured, no data is sent to them.
          </p>
          <p>We may also disclose information where required by law, regulation, or a valid legal process (e.g. a mining regulator, tax authority, or court order).</p>
        </Section>

        <Section title="6. Cross-border transfers">
          <p>
            Where a service provider (such as our hosting or database provider, or an
            optional AI integration) is located outside South Africa, we take reasonable
            steps to ensure that recipient is subject to a data protection standard that
            provides adequate protection substantially similar to POPIA, consistent with
            section 72 of POPIA.
          </p>
        </Section>

        <Section title="7. How long we keep your information">
          <p>
            We retain personal information only for as long as necessary for the purposes
            described above, or as required by applicable law — for example, mining
            safety and health records, and FICA/AML records for buyers, are typically
            subject to statutory minimum retention periods. Login and security event
            records are retained for a limited period sufficient for threat detection
            before being eligible for deletion.
          </p>
        </Section>

        <Section title="8. Your rights">
          <p>Subject to POPIA, you have the right to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Be informed that your personal information is being collected and processed.</li>
            <li>Access the personal information we hold about you.</li>
            <li>Request correction of inaccurate, incomplete, or outdated information.</li>
            <li>Request deletion or destruction of personal information that we are no longer authorized to retain.</li>
            <li>Object to processing of your personal information for reasons relating to your particular situation, or to direct marketing.</li>
            <li>Withdraw consent, where processing is based on consent, without affecting processing that already occurred.</li>
            <li>Lodge a complaint with the Information Regulator (South Africa) if you believe your information has been processed unlawfully.</li>
          </ul>
          <p>To exercise these rights, contact your mine's designated Information Officer (typically the mine owner or IT Manager account holder for your MineGuard deployment).</p>
        </Section>

        <Section title="9. Cookies and local storage">
          <p>
            The MineGuard web application stores a session token in your browser's local
            storage to keep you signed in. We do not use third-party advertising or
            tracking cookies.
          </p>
        </Section>

        <Section title="10. Children's information">
          <p>
            MineGuard is a workplace and industry platform and is not directed at, nor
            knowingly used to collect information from, children. Where a minor's details
            appear incidentally (for example, as an emergency contact), they are processed
            only for that limited purpose.
          </p>
        </Section>

        <Section title="11. Changes to this policy">
          <p>
            We may update this policy from time to time. Material changes will be
            reflected by updating the "Last updated" date above.
          </p>
        </Section>

        <Section title="12. Contact">
          <p>
            For questions about this policy or to exercise your rights, contact your
            mine's Information Officer through your usual MineGuard account contact, or
            your organization's designated privacy contact. You may also lodge a complaint
            with South Africa's Information Regulator directly — current contact details
            are published on the Information Regulator's official website.
          </p>
        </Section>
      </div>
    </div>
  );
}
