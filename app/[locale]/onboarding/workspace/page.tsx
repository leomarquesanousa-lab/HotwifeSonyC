"use client";

import { FormEvent, useState } from "react";
import { useLocale } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Clock3,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";

type AccountType = "CREATOR" | "AGENCY";

export default function WorkspaceOnboardingPage() {
  const locale = useLocale();
  const router = useRouter();

  const [workspaceName, setWorkspaceName] = useState("");
  const [accountType, setAccountType] =
    useState<AccountType>("CREATOR");
  const [timezone, setTimezone] =
    useState("America/Los_Angeles");
  const [errorMessage, setErrorMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");

    if (!workspaceName.trim()) {
      setErrorMessage("Enter a workspace name.");
      return;
    }

    router.push(`/${locale}/onboarding/creators`);
  }

  return (
    <main className="min-h-screen bg-[#080b12] text-white">
      <div className="min-h-screen flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[760px]">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  router.push(`/${locale}/onboarding`)
                }
                className="flex items-center gap-2 text-sm text-white/40 transition hover:text-white/70"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
                Step 2 of 5
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-7 sm:p-10 lg:p-12">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em]">
                Configure your workspace
              </h1>

              <p className="mt-3 max-w-[620px] text-sm leading-7 text-white/45">
                Confirm how your operation should be organized. You can
                change these settings later.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-10 space-y-7"
              noValidate
            >
              <div>
                <label
                  htmlFor="workspaceName"
                  className="mb-2 block text-sm text-white/65"
                >
                  Workspace name
                </label>

                <input
                  id="workspaceName"
                  name="workspaceName"
                  type="text"
                  value={workspaceName}
                  onChange={(event) => {
                    setWorkspaceName(event.target.value);

                    if (errorMessage) {
                      setErrorMessage("");
                    }
                  }}
                  placeholder="Example: Creator Studio"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-blue-500/60 focus:bg-white/[0.05]"
                />
              </div>

              <div>
                <div className="mb-2 text-sm text-white/65">
                  Operation type
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <AccountTypeCard
                    active={accountType === "CREATOR"}
                    icon={<UserRound className="h-5 w-5" />}
                    title="Creator"
                    description="For an individual creator managing their own operation."
                    onClick={() =>
                      setAccountType("CREATOR")
                    }
                  />

                  <AccountTypeCard
                    active={accountType === "AGENCY"}
                    icon={<Building2 className="h-5 w-5" />}
                    title="Agency"
                    description="For teams managing multiple creators and platform accounts."
                    onClick={() =>
                      setAccountType("AGENCY")
                    }
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="timezone"
                  className="mb-2 block text-sm text-white/65"
                >
                  Time zone
                </label>

                <div className="relative">
                  <Clock3 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />

                  <select
                    id="timezone"
                    name="timezone"
                    value={timezone}
                    onChange={(event) =>
                      setTimezone(event.target.value)
                    }
                    className="w-full appearance-none rounded-xl border border-white/10 bg-white/[0.035] py-3.5 pl-11 pr-4 text-sm text-white outline-none transition focus:border-blue-500/60 focus:bg-white/[0.05]"
                  >
                    <option
                      value="America/Los_Angeles"
                      className="bg-[#10141e]"
                    >
                      Pacific Time — Los Angeles
                    </option>

                    <option
                      value="America/New_York"
                      className="bg-[#10141e]"
                    >
                      Eastern Time — New York
                    </option>

                    <option
                      value="America/Sao_Paulo"
                      className="bg-[#10141e]"
                    >
                      Brasília Time — São Paulo
                    </option>

                    <option
                      value="Europe/London"
                      className="bg-[#10141e]"
                    >
                      London
                    </option>

                    <option
                      value="Europe/Paris"
                      className="bg-[#10141e]"
                    >
                      Paris
                    </option>

                    <option
                      value="UTC"
                      className="bg-[#10141e]"
                    >
                      UTC
                    </option>
                  </select>
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
                  {errorMessage}
                </div>
              )}

              <div className="rounded-2xl border border-blue-500/15 bg-blue-500/[0.05] p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/[0.08]">
                    <Check className="h-4 w-4 text-blue-400" />
                  </div>

                  <div>
                    <div className="text-sm font-medium">
                      Why does the time zone matter?
                    </div>

                    <p className="mt-1.5 text-sm leading-6 text-white/40">
                      Scheduled posts will use this time zone by default,
                      which helps avoid publishing content at the wrong
                      time.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-[#080b12] transition hover:bg-white/90"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}

function AccountTypeCard({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-5 text-left transition ${
        active
          ? "border-blue-500/60 bg-blue-500/[0.08]"
          : "border-white/10 bg-white/[0.025] hover:bg-white/[0.045]"
      }`}
    >
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
          active
            ? "border-blue-500/20 bg-blue-500/[0.08] text-blue-400"
            : "border-white/10 bg-white/[0.04] text-white/40"
        }`}
      >
        {icon}
      </div>

      <div className="mt-4 text-sm font-semibold">
        {title}
      </div>

      <p className="mt-2 text-xs leading-5 text-white/35">
        {description}
      </p>
    </button>
  );
}