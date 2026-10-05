"use client";
import { ResendVerification } from "@/src/components/auth/ResendVerification";

import {
  FormEvent,
  useState,
} from "react";

import {
  useLocale,
  useTranslations,
} from "next-intl";

import {
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

export default function LoginPage() {
  const [needsVerification, setNeedsVerification] = useState(false);
  const t =
    useTranslations(
      "auth",
    );

  const common =
    useTranslations(
      "common",
    );

  const locale =
    useLocale();

  const router =
    useRouter();

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  function clearError() {
    if (
      errorMessage
    ) {
      setErrorMessage(
        "",
      );
    }
  }


  function openForgotPassword() {
    router.push(
      `/forgot-password`,
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      isSubmitting
    ) {
      return;
    }

    setErrorMessage(
      "",
    );

    if (
      !email.trim() ||
      !password
    ) {
      setErrorMessage(
        t("loginRequired"),
      );

      return;
    }

    try {
      setIsSubmitting(
        true,
      );

      const response =
        await fetch(
          "/api/auth/login",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  email:
                    email.trim(),

                  password,

                  clientType:
                    "WEB",
                },
              ),
          },
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        if (data?.error === "RATE_LIMITED") { setErrorMessage(t("rateLimited")); return; }
        if (
          data?.error ===
          "INVALID_CREDENTIALS"
        ) {
          setErrorMessage(
            t("invalidCredentials"),
          );

          return;
        }

        if (
          data?.error ===
          "EMAIL_NOT_VERIFIED"
        ) {
          setErrorMessage(
            t("emailNotVerified"),
          );
          setNeedsVerification(true);

          return;
        }

        if (
          data?.error ===
          "ACCOUNT_UNAVAILABLE"
        ) {
          setErrorMessage(
            t("accountUnavailable"),
          );

          return;
        }

        if (
          data?.error ===
          "WORKSPACE_NOT_FOUND"
        ) {
          setErrorMessage(
            t("workspaceMissing"),
          );

          return;
        }

        if (
          data?.error ===
          "WORKSPACE_UNAVAILABLE"
        ) {
          setErrorMessage(
            t("workspaceUnavailable"),
          );

          return;
        }

        setErrorMessage(
          t("loginFailed"),
        );

        return;
      }

      if (
        data?.destination ===
        "ONBOARDING"
      ) {
        window.location.replace(
          `/onboarding`,
        );

        return;
      }

      window.location.replace(
        `/app`,
      );
    } catch {
      

      setErrorMessage(
        t("networkFailed"),
      );
    } finally {
      setIsSubmitting(
        false,
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#080b12] text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">

        <section className="relative hidden overflow-hidden border-r border-white/10 lg:flex">
          <img
            src="/monitor_hero.png"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center opacity-70"
          />

          <div className="absolute inset-0 bg-[#080b12]/30" />

          <div className="absolute inset-0 bg-gradient-to-r from-[#080b12]/80 via-[#080b12]/35 to-[#080b12]/10" />

          <div className="absolute inset-0 bg-gradient-to-t from-[#080b12]/75 via-transparent to-[#080b12]/25" />

          <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/30 backdrop-blur-md">
                <ShieldCheck className="h-5 w-5 text-blue-400" />
              </div>

              <div>
                <div className="font-semibold tracking-tight">
                  {common(
                    "appName",
                  )}
                </div>

                <div className="text-xs text-white/50">
                  {t(
                    "protectedByDesign",
                  )}
                </div>
              </div>
            </div>

            <div className="max-w-xl">

              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-xs text-white/70 backdrop-blur-md">
                <LockKeyhole className="h-3.5 w-3.5 text-blue-400" />

                {t(
                  "secureAccess",
                )}
              </div>

              <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-white drop-shadow-[0_3px_18px_rgba(0,0,0,0.8)] xl:text-5xl">
                {t(
                  "loginHeadline",
                )}
              </h1>

              <p className="mt-5 max-w-lg text-base leading-7 text-white/70 drop-shadow-[0_3px_14px_rgba(0,0,0,0.8)]">
                {t(
                  "loginDescription",
                )}
              </p>

              <div className="mt-10 grid gap-4">

                <Feature
                  text={t(
                    "encryptedAccess",
                  )}
                />

                <Feature
                  text={t(
                    "privateWorkspace",
                  )}
                />

                <Feature
                  text={t(
                    "secureCreatorManagement",
                  )}
                />

              </div>
            </div>

            <div className="text-xs text-white/45">
              {t(
                "secureFooter",
              )}
            </div>

          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[460px]">

            <div className="mb-10 flex items-center justify-between">

              <div className="flex items-center gap-3 lg:hidden">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                  <ShieldCheck className="h-4 w-4 text-blue-400" />
                </div>

                <span className="font-semibold">
                  {common(
                    "appName",
                  )}
                </span>
              </div>

            </div>

            <div className="mb-8">

              <h2 className="text-3xl font-semibold tracking-[-0.03em]">
                {t(
                  "welcomeBack",
                )}
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/45">
                {t(
                  "signInToContinue",
                )}
              </p>

            </div>

            <form
              onSubmit={
                handleSubmit
              }
              className="space-y-5"
              noValidate
            >

              <div>

                <label
                  htmlFor="email"
                  className="mb-2 block text-sm text-white/65"
                >
                  {t(
                    "email",
                  )}
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={
                    email
                  }
                  onChange={(
                    event,
                  ) => {
                    setEmail(
                      event.target.value,
                    );

                    clearError();
                  }}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3.5 text-sm text-white outline-none transition focus:border-blue-500/60 focus:bg-white/[0.05]"
                />

              </div>

              <div>

                <div className="mb-2 flex items-center justify-between">

                  <label
                    htmlFor="password"
                    className="text-sm text-white/65"
                  >
                    {t(
                      "password",
                    )}
                  </label>

                  <button
                    type="button"
                    onClick={
                      openForgotPassword
                    }
                    className="text-xs text-white/40 transition hover:text-white/70"
                  >
                    {t(
                      "forgotPassword",
                    )}
                  </button>

                </div>

                <div className="relative">

                  <input
                    id="password"
                    name="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    autoComplete="current-password"
                    value={
                      password
                    }
                    onChange={(
                      event,
                    ) => {
                      setPassword(
                        event.target.value,
                      );

                      clearError();
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3.5 pr-12 text-sm text-white outline-none transition focus:border-blue-500/60 focus:bg-white/[0.05]"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (
                          value,
                        ) =>
                          !value,
                      )
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>

                </div>
              </div>

              {errorMessage && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
                  {
                    errorMessage
                  }
                </div>
              )}

              <button
                type="submit"
                disabled={
                  isSubmitting
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-[#080b12] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
              >

                {isSubmitting && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}

                {isSubmitting
                  ? common(
                      "loading",
                    )
                  : t(
                      "signIn",
                    )}

              </button>

            </form>
            {needsVerification && <ResendVerification email={email} />}

            <div className="mt-8 text-center text-sm text-white/40">

              {t(
                "createYourAccount",
              )}

              {" "}

              <a
                href={`/sign-up`}
                className="font-medium text-white/80 hover:text-white"
              >
                {t(
                  "createAccount",
                )}
              </a>

            </div>

          </div>
        </section>

      </div>
    </main>
  );
}

function Feature({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 text-sm text-white/70">

      <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-black/30 backdrop-blur-md">
        <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
      </div>

      <span className="drop-shadow-[0_3px_12px_rgba(0,0,0,0.8)]">
        {
          text
        }
      </span>

    </div>
  );
}