"use client";

import { useLocale } from "next-intl";
import {
  ArrowRight,
  CheckCircle2,
  Layers3,
  Link2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const locale = useLocale();
  const router = useRouter();

  function continueSetup() {
    router.push(`/onboarding/workspace`);
  }

  return (
    <main className="min-h-screen bg-[#080b12] text-white">
      <div className="min-h-screen flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[760px]">
          <div className="mb-8 flex items-center justify-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              <ShieldCheck className="h-5 w-5 text-blue-400" />
            </div>

            <div>
              <div className="font-semibold tracking-tight">
                <img src="/logo-hotwifesonyc.png" alt="HotwifeSonyC" className="h-14 w-auto max-w-full object-contain"/>
              </div>

              <div className="text-xs text-white/35">
                Workspace setup
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-7 sm:p-10 lg:p-12">
            <div className="mx-auto max-w-[620px] text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/[0.08]">
                <Sparkles className="h-6 w-6 text-blue-400" />
              </div>

              <div className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
                Step 1 of 5
              </div>

              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                Let&apos;s set up your workspace
              </h1>

              <p className="mx-auto mt-4 max-w-[560px] text-sm leading-7 text-white/45 sm:text-base">
                We&apos;ll guide you through the essential setup before you
                start using the platform. This only takes a few minutes.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <SetupCard
                icon={<Layers3 className="h-5 w-5" />}
                title="Workspace"
                description="Confirm your operation and workspace settings."
              />

              <SetupCard
                icon={<Link2 className="h-5 w-5" />}
                title="Platforms"
                description="Connect at least one platform before continuing."
              />

              <SetupCard
                icon={<CheckCircle2 className="h-5 w-5" />}
                title="Connection check"
                description="We verify that your connected account is working."
              />
            </div>

            <div className="mt-10 rounded-2xl border border-white/10 bg-[#0b0f17] p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/[0.08]">
                  <ShieldCheck className="h-4 w-4 text-blue-400" />
                </div>

                <div>
                  <div className="text-sm font-medium text-white">
                    Why is platform connection required?
                  </div>

                  <p className="mt-1.5 text-sm leading-6 text-white/40">
                    The platform needs an active connection to publish,
                    schedule and manage content. You won&apos;t finish setup
                    until at least one supported platform is connected and
                    verified.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={continueSetup}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-[#080b12] transition hover:bg-white/90"
            >
              Start setup
              <ArrowRight className="h-4 w-4" />
            </button>

            <p className="mt-4 text-center text-xs text-white/25">
              Setup must be completed before accessing the workspace.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function SetupCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-blue-400">
        {icon}
      </div>

      <div className="mt-4 text-sm font-semibold">
        {title}
      </div>

      <p className="mt-2 text-xs leading-5 text-white/35">
        {description}
      </p>
    </div>
  );
}