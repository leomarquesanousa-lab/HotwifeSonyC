"use client";

import { FormEvent, useState } from "react";
import { useLocale } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";

type CreatorItem = {
  id: string;
  displayName: string;
};

export default function CreatorsOnboardingPage() {
  const locale = useLocale();
  const router = useRouter();

  const [mode, setMode] =
    useState<"CREATOR" | "AGENCY">("CREATOR");

  const [creatorName, setCreatorName] = useState("");
  const [agencyCreatorName, setAgencyCreatorName] =
    useState("");

  const [creators, setCreators] =
    useState<CreatorItem[]>([]);

  const [errorMessage, setErrorMessage] =
    useState("");

  function addAgencyCreator() {
    const name = agencyCreatorName.trim();

    if (!name) {
      setErrorMessage(
        "Enter the creator name before adding.",
      );
      return;
    }

    const newCreator: CreatorItem = {
      id: crypto.randomUUID(),
      displayName: name,
    };

    setCreators((current) => [
      ...current,
      newCreator,
    ]);

    setAgencyCreatorName("");
    setErrorMessage("");
  }

  function removeCreator(id: string) {
    setCreators((current) =>
      current.filter(
        (creator) => creator.id !== id,
      ),
    );
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setErrorMessage("");

    if (
      mode === "CREATOR" &&
      !creatorName.trim()
    ) {
      setErrorMessage(
        "Enter your creator display name.",
      );
      return;
    }

    if (
      mode === "AGENCY" &&
      creators.length === 0
    ) {
      setErrorMessage(
        "Add at least one creator before continuing.",
      );
      return;
    }

    router.push(
      `/${locale}/onboarding/platforms`,
    );
  }

  return (
    <main className="min-h-screen bg-[#080b12] text-white">
      <div className="min-h-screen flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[820px]">
          <div className="mb-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/${locale}/onboarding/workspace`,
                )
              }
              className="flex items-center gap-2 text-sm text-white/40 transition hover:text-white/70"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
              Step 3 of 5
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-7 sm:p-10 lg:p-12">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em]">
                Set up your creators
              </h1>

              <p className="mt-3 max-w-[650px] text-sm leading-7 text-white/45">
                Confirm whether this workspace belongs to
                an individual creator or an agency managing
                multiple creators.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <ModeCard
                active={mode === "CREATOR"}
                icon={
                  <UserRound className="h-5 w-5" />
                }
                title="Individual creator"
                description="Set up your own creator profile."
                onClick={() => {
                  setMode("CREATOR");
                  setErrorMessage("");
                }}
              />

              <ModeCard
                active={mode === "AGENCY"}
                icon={
                  <Building2 className="h-5 w-5" />
                }
                title="Agency"
                description="Add the creators your team manages."
                onClick={() => {
                  setMode("AGENCY");
                  setErrorMessage("");
                }}
              />
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-8"
              noValidate
            >
              {mode === "CREATOR" && (
                <div>
                  <label
                    htmlFor="creatorName"
                    className="mb-2 block text-sm text-white/65"
                  >
                    Creator display name
                  </label>

                  <input
                    id="creatorName"
                    type="text"
                    value={creatorName}
                    onChange={(event) => {
                      setCreatorName(
                        event.target.value,
                      );

                      if (errorMessage) {
                        setErrorMessage("");
                      }
                    }}
                    placeholder="Example: Sophia Lane"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-blue-500/60 focus:bg-white/[0.05]"
                  />

                  <div className="mt-4 rounded-2xl border border-white/10 bg-[#0b0f17] p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/[0.08]">
                        <UserRound className="h-4 w-4 text-blue-400" />
                      </div>

                      <div>
                        <div className="text-sm font-medium">
                          Your creator profile
                        </div>

                        <p className="mt-1.5 text-sm leading-6 text-white/40">
                          Content, platform accounts,
                          schedules and analytics will be
                          organized under this creator.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {mode === "AGENCY" && (
                <div>
                  <label
                    htmlFor="agencyCreatorName"
                    className="mb-2 block text-sm text-white/65"
                  >
                    Add creator
                  </label>

                  <div className="flex gap-3">
                    <input
                      id="agencyCreatorName"
                      type="text"
                      value={agencyCreatorName}
                      onChange={(event) => {
                        setAgencyCreatorName(
                          event.target.value,
                        );

                        if (errorMessage) {
                          setErrorMessage("");
                        }
                      }}
                      placeholder="Creator display name"
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-blue-500/60 focus:bg-white/[0.05]"
                    />

                    <button
                      type="button"
                      onClick={addAgencyCreator}
                      className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  </div>

                  <div className="mt-5">
                    {creators.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
                        <Building2 className="mx-auto h-6 w-6 text-white/20" />

                        <div className="mt-3 text-sm text-white/35">
                          No creators added yet
                        </div>

                        <p className="mt-1 text-xs text-white/25">
                          Add at least one creator to
                          continue.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {creators.map(
                          (creator, index) => (
                            <div
                              key={creator.id}
                              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm font-semibold text-white/60">
                                  {index + 1}
                                </div>

                                <div>
                                  <div className="text-sm font-medium">
                                    {
                                      creator.displayName
                                    }
                                  </div>

                                  <div className="mt-0.5 text-xs text-white/30">
                                    Creator
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  removeCreator(
                                    creator.id,
                                  )
                                }
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-white/30 transition hover:bg-red-500/[0.08] hover:text-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-[#080b12] transition hover:bg-white/90"
              >
                Continue to platforms
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}

function ModeCard({
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