import Link from "next/link";

export default function TermsOfServicePage() {
  const updatedAt = "September 14, 2026";

  return (
    <main className="min-h-screen bg-[#080b12] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-300/70">
            <img src="/logo-hotwifesonyc.png" alt="HotwifeSonyC" className="h-14 w-auto max-w-full object-contain"/>
          </div>

          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
            Terms of Service
          </h1>

          <p className="mt-3 text-sm leading-6 text-white/45">
            Last updated: {updatedAt}
          </p>
        </div>

        <div className="space-y-7 rounded-[20px] border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
          <Section title="1. Acceptance of terms">
            By accessing or using HotwifeSonyC, you agree to these Terms of
            Service. If you do not agree with these terms, you should not use
            the service.
          </Section>

          <Section title="2. Description of the service">
            HotwifeSonyC provides tools for creators, agencies, and
            authorized team members to manage media, documents, connected
            third-party platforms, publishing workflows, account activity, and
            related content management operations.
          </Section>

          <Section title="3. Account responsibility">
            You are responsible for maintaining the confidentiality and
            security of your account credentials and for all activities
            performed through your account. You must provide accurate
            information and promptly notify us of unauthorized access or
            suspected security incidents.
          </Section>

          <Section title="4. Connected third-party platforms">
            HotwifeSonyC may allow you to connect third-party services such
            as Instagram, Facebook, Fanvue, and other supported platforms. By
            connecting a third-party account, you authorize HotwifeSonyC to
            perform actions requested by you using the permissions granted
            through that platform&apos;s official authorization process.
          </Section>

          <Section title="5. Publishing and content management">
            You are responsible for all content uploaded, stored, scheduled, or
            published through HotwifeSonyC. You must have all rights,
            permissions, licenses, and consents necessary to use and distribute
            that content.
          </Section>

          <Section title="6. Acceptable use">
            You may not use HotwifeSonyC for unlawful activities, fraud,
            unauthorized access, infringement of intellectual property rights,
            distribution of prohibited content, abuse of third-party services,
            or any activity that violates applicable laws or the terms and
            policies of connected platforms.
          </Section>

          <Section title="7. Third-party platform requirements">
            Your use of connected services remains subject to the terms,
            policies, limitations, and technical requirements of those
            third-party platforms. HotwifeSonyC cannot guarantee that a
            third-party service will remain available or that its APIs,
            permissions, limits, or features will remain unchanged.
          </Section>

          <Section title="8. Availability of the service">
            We work to maintain reliable access to HotwifeSonyC, but we do
            not guarantee uninterrupted or error-free operation. Features may
            occasionally be unavailable due to maintenance, updates, security
            requirements, infrastructure issues, or changes made by third-party
            providers.
          </Section>

          <Section title="9. Suspension and termination">
            We may restrict, suspend, or terminate access to the service when
            necessary to protect the platform, other users, third-party
            services, or to comply with legal obligations. Users may also stop
            using the service and request account deletion.
          </Section>

          <Section title="10. Intellectual property">
            HotwifeSonyC and its software, interface, design, branding, and
            original technology are protected by applicable intellectual
            property laws. These Terms do not transfer ownership of Creator
            Platform intellectual property to users.
          </Section>

          <Section title="11. User content">
            You retain ownership of content that you upload or manage through
            HotwifeSonyC. You grant us only the limited rights necessary to
            process, store, transmit, and publish that content as requested by
            you through the service.
          </Section>

          <Section title="12. Limitation of liability">
            To the maximum extent permitted by applicable law, HotwifeSonyC
            is not responsible for indirect, incidental, special, or
            consequential losses resulting from the use or inability to use
            the service, including interruptions or actions of third-party
            platforms.
          </Section>

          <Section title="13. Privacy">
            Personal information and connected platform data are handled in
            accordance with our Privacy Policy. Users may also request deletion
            of their personal information as described in our Data Deletion
            Instructions.
          </Section>

          <Section title="14. Changes to these terms">
            We may update these Terms of Service from time to time. Updated
            terms will be posted on this page with a revised effective date.
            Continued use of HotwifeSonyC after an update constitutes
            acceptance of the revised terms.
          </Section>

          <Section title="15. Contact">
            For questions regarding these Terms of Service, contact the operator
            of HotwifeSonyC through the support contact provided within the
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
            href="/login"
            className="transition hover:text-white/60"
          >
            Return to HotwifeSonyC
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