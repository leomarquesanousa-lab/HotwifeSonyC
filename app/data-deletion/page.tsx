import Link from "next/link";

export default function DataDeletionPage() {
  const updatedAt = "September 14, 2026";

  return (
    <main className="min-h-screen bg-[#080b12] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-300/70">
            Creator Platform
          </div>

          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
            Data Deletion Instructions
          </h1>

          <p className="mt-3 text-sm leading-6 text-white/45">
            Last updated: {updatedAt}
          </p>
        </div>

        <div className="space-y-7 rounded-[20px] border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
          <Section title="1. Overview">
            Creator Platform respects your right to request deletion of
            personal information and data associated with your account,
            including information received from supported third-party
            platforms.
          </Section>

          <Section title="2. Requesting deletion">
            To request deletion of your Creator Platform account and associated
            personal data, contact the Creator Platform support team using the
            support contact provided within the application. Clearly state that
            you are requesting deletion of your account and personal data.
          </Section>

          <Section title="3. Information to include">
            To help us identify your account and process the request securely,
            include the email address associated with your Creator Platform
            account and any additional information reasonably necessary to
            verify account ownership. Do not send passwords, access tokens, or
            other sensitive credentials.
          </Section>

          <Section title="4. Instagram and Meta data">
            If you connected an Instagram or Meta account to Creator Platform,
            you may request deletion of data received through that connection.
            This may include account identifiers, profile information,
            connection records, access credentials, publishing activity, and
            other data authorized through the Meta or Instagram platform.
          </Section>

          <Section title="5. Disconnecting an account">
            You may disconnect a supported third-party account from Creator
            Platform when that option is available in the application.
            Disconnecting an account prevents future access using that
            connection but does not necessarily delete historical data already
            stored by Creator Platform.
          </Section>

          <Section title="6. What will be deleted">
            Subject to applicable legal and operational requirements, deletion
            may include personal account information, connected platform
            identifiers, stored integration credentials, platform connection
            records, workspace information, publishing history, and other
            personal data associated with the account.
          </Section>

          <Section title="7. Uploaded content">
            Media, documents, and other files associated with the account may
            also be deleted when the account is permanently deleted, subject to
            applicable retention requirements and any data belonging to shared
            workspaces or other authorized users.
          </Section>

          <Section title="8. Processing time">
            We will process valid deletion requests within a reasonable period
            and in accordance with applicable law. Additional verification may
            be required before deletion is completed in order to protect
            accounts from unauthorized requests.
          </Section>

          <Section title="9. Data that may be retained">
            Certain information may be retained when required by law, necessary
            to resolve disputes, prevent fraud or abuse, maintain security,
            enforce agreements, or comply with legitimate legal obligations.
            Any retained information will be limited to what is reasonably
            necessary for those purposes.
          </Section>

          <Section title="10. Third-party platforms">
            Deleting data from Creator Platform does not automatically delete
            information stored independently by Instagram, Meta, or other
            third-party services. Users should use the privacy and account
            management tools provided directly by those services when they
            also wish to delete data held by the third party.
          </Section>

          <Section title="11. Confirmation">
            After a valid deletion request has been processed, Creator Platform
            may provide confirmation that the request has been completed or
            information about any data that must legally or operationally be
            retained.
          </Section>

          <Section title="12. Contact">
            For account or data deletion requests, contact the operator of
            Creator Platform through the support contact provided within the
            application.
          </Section>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-white/25">
          <Link
            href="/privacy"
            className="transition hover:text-white/60"
          >
            Privacy Policy
          </Link>

          <Link
            href="/terms"
            className="transition hover:text-white/60"
          >
            Terms of Service
          </Link>

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