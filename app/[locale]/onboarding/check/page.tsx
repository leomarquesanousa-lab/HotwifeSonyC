"use client";

import {
  Check,
  CheckCircle2,
  CircleAlert,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import {
  useLocale,
} from "next-intl";

import {
  useRouter,
} from "next/navigation";

import {
  useEffect,
  useState,
} from "react";

type PlatformAccount = {
  id: string;
  status: string;
};

type PlatformItem = {
  code: string;
  name: string;
  connected: boolean;
  accounts: PlatformAccount[];
};

type PlatformsResponse = {
  success: boolean;
  connectedCount: number;
  platforms: PlatformItem[];
};

export default function OnboardingCheckPage() {
  const locale =
    useLocale();

  const router =
    useRouter();

  const [
    platforms,
    setPlatforms,
  ] =
    useState<
      PlatformItem[]
    >([]);

  const [
    connectedCount,
    setConnectedCount,
  ] =
    useState(0);

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    isFinishing,
    setIsFinishing,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  useEffect(() => {
    void loadStatus();
  }, []);

  async function loadStatus() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response =
        await fetch(
          "/api/platforms",
          {
            method:
              "GET",
            cache:
              "no-store",
          },
        );

      const data =
        (await response.json()) as PlatformsResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        setErrorMessage(
          "Unable to verify your platform connections.",
        );

        return;
      }

      setPlatforms(
        data.platforms,
      );

      setConnectedCount(
        data.connectedCount,
      );
    } catch (error) {
      console.error(
        "ONBOARDING_CHECK_ERROR",
        error,
      );

      setErrorMessage(
        "Unable to verify your setup.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function finishOnboarding() {
    if (
      isFinishing
    ) {
      return;
    }

    try {
      setIsFinishing(
        true,
      );

      setErrorMessage(
        "",
      );

      const response =
        await fetch(
          "/api/onboarding/complete",
          {
            method:
              "POST",
          },
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        if (
          data?.error ===
          "PLATFORM_CONNECTION_REQUIRED"
        ) {
          setErrorMessage(
            "At least one verified platform connection is required.",
          );

          return;
        }

        setErrorMessage(
          "Unable to complete onboarding.",
        );

        return;
      }

      router.replace(
        `/app`,
      );

      router.refresh();
    } catch (error) {
      console.error(
        "ONBOARDING_FINISH_ERROR",
        error,
      );

      setErrorMessage(
        "Unable to complete onboarding.",
      );
    } finally {
      setIsFinishing(
        false,
      );
    }
  }

  const connectedPlatforms =
    platforms.filter(
      (platform) =>
        platform.connected ||
        platform.accounts.some(
          (account) =>
            account.status ===
            "CONNECTED",
        ),
    );

  return (
    <main className="min-h-screen bg-[#080b12] px-5 py-8 text-white sm:px-7 lg:px-8">
      <div className="mx-auto w-full max-w-[820px]">
        <div className="mb-6 text-right text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
          Step 5 of 5
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.025] shadow-2xl shadow-black/20">
          <div className="border-b border-white/[0.07] px-6 py-7 sm:px-8">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08]">
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
              </div>

              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300/70">
                  Setup check
                </div>

                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                  Your workspace is ready
                </h1>

                <p className="mt-2 max-w-[600px] text-sm leading-6 text-white/40">
                  Review your setup and enter your Creator Platform workspace.
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-8">
            {errorMessage && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />

                <span>
                  {
                    errorMessage
                  }
                </span>
              </div>
            )}

            {isLoading ? (
              <div className="flex min-h-[220px] items-center justify-center">
                <div className="text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-400" />

                  <div className="mt-3 text-xs text-white/30">
                    Checking your setup...
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatusCard
                    label="Workspace"
                    value="Ready"
                  />

                  <StatusCard
                    label="Creator"
                    value="Ready"
                  />

                  <StatusCard
                    label="Platforms"
                    value={`${connectedCount} connected`}
                  />
                </div>

                <div className="mt-6 rounded-2xl border border-white/[0.07] bg-[#0b0f17] p-4">
                  <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">
                    Connected platforms
                  </div>

                  <div className="space-y-1">
                    {connectedPlatforms.map(
                      (platform) => (
                        <div
                          key={
                            platform.code
                          }
                          className="flex items-center justify-between rounded-xl px-3 py-2.5"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-400" />

                            <span className="text-xs text-white/65">
                              {
                                platform.name
                              }
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[10px] text-emerald-300">
                            <Check className="h-3 w-3" />

                            Connected
                          </div>
                        </div>
                      ),
                    )}

                    {connectedPlatforms.length ===
                      0 && (
                      <div className="rounded-xl border border-dashed border-white/[0.07] px-4 py-6 text-center text-xs text-white/25">
                        No verified platform connection found.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.05] px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />

                  <div className="text-xs text-white/45">
                    Completing setup will make the Dashboard your default workspace after login.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={
                    finishOnboarding
                  }
                  disabled={
                    connectedCount <
                      1 ||
                    isFinishing
                  }
                  className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-[#080b12] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {isFinishing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />

                      Finishing setup...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />

                      Finish setup
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function StatusCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.018] px-4 py-3">
      <div className="text-[9px] uppercase tracking-[0.1em] text-white/25">
        {label}
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-xs font-medium text-white/70">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

        {value}
      </div>
    </div>
  );
}