import Link from "next/link";

export default function PrivacyPolicyPage() {
  const updatedAt = "September 10, 2026";

  return (
    <main className="min-h-screen bg-[#080b12] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-300/70">
            Creator Platform
          </div>

          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
            Privacy Policy
          </h1>

          <p className="mt-3 text-sm leading-6 text-white/45">
            Last updated: {updatedAt}
          </p>
        </div>

        <div className="space-y-7 rounded-[20px] border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
          <Section title="1. Overview">
            Creator Platform provides tools for creators, agencies, and authorized team members to manage media, connected platforms, publishing workflows, documents, and related account activity.
          </Section>

          <Section title="2. Information we collect">
            We may collect account information such as name, email address, workspace information, creator or performer profile data, uploaded media metadata, connected platform account identifiers, publishing activity, and technical information necessary to operate and secure the service.
          </Section>

          <Section title="3. Connected platform data">
            When you choose to connect a third-party platform such as Instagram, Facebook, Fanvue, or other supported services, we may receive information authorized by you through that platform&apos;s login or authorization process. We use this information only to provide the features you request, such as account connection, publishing, synchronization, and status verification.
          </Section>

          <Section title="4. How we use information">
            We use information to provide and maintain the service, authenticate users, manage workspaces, process publishing requests, display platform connection status, improve reliability, prevent abuse, and provide customer support.
          </Section>

          <Section title="5. Data sharing">
            We do not sell personal information. Data may be shared with service providers that are necessary to operate the platform, such as hosting, database, storage, email, and connected third-party platforms when you explicitly request an integration or publishing action.
          </Section>

          <Section title="6. Data storage and security">
            We use reasonable technical and organizational safeguards to protect account and workspace information. Access to private media, documents, and integration credentials is restricted to authorized workflows and users.
          </Section>

          <Section title="7. Data retention">
            We retain information for as long as necessary to provide the service, comply with legal obligations, resolve disputes, and maintain security. Users may request deletion of their account data subject to applicable legal and operational requirements.
          </Section>

          <Section title="8. Your choices">
            You may disconnect supported third-party platforms, stop using the service, or contact us to request access, correction, or deletion of personal information, subject to applicable law.
          </Section>

          <Section title="9. Third-party services">
            Third-party platforms and services have their own privacy policies and terms. Creator Platform is not responsible for the privacy practices of those third parties.
          </Section>

          <Section title="10. Changes to this policy">
            We may update this Privacy Policy from time to time. The updated version will be posted on this page with a revised effective date.
          </Section>

          <Section title="11. Contact">
            For privacy questions or data requests, contact the operator of Creator Platform through the support contact provided within the application.
          </Section>
        </div>

        <div className="mt-6 text-center text-xs text-white/25">
          <Link
            href="/login"
            className="transition hover:text-white/60"
          >
            Return to Creator Platform
          </Link>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-white/80">
        {title}
      </h2>

      <p className="mt-2 text-sm leading-6 text-white/45">
        {children}
      </p>
    </section>
  );
}
