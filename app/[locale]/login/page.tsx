"use client";

import {
  FormEvent,
  useState,
  useEffect,
} from "react";

import {
  useTranslations,
} from "next-intl";

import {
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

export default function LoginPage() {
  const t =
    useTranslations(
      "auth",
    );

  const common =
    useTranslations(
      "common",
    );

  const router =
    useRouter();

  const [returnTo, setReturnTo] = useState('/app');
  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get('next');
    if (next === '/account' || next === '/my-videos') setReturnTo(next);
  }, []);
  const customerQuery = returnTo === '/app' ? '' : '?next=' + encodeURIComponent(returnTo);

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
      `/forgot-password${customerQuery}`,
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


      window.location.replace(
        returnTo !== "/app" ? returnTo : data.destination === "APP" ? "/app" : "/account",
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
      <div className="min-h-screen">

        <section className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[460px]">

            <a href="/" className="mb-10 inline-block"><img src="/logo-hotwifesonyc.png" alt="HotwifeSonyC" className="h-14 w-auto max-w-full object-contain"/></a>

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

            <div className="mt-8 text-center text-sm text-white/40">

              {t(
                "createYourAccount",
              )}

              {" "}

              <a
                href={`/sign-up${customerQuery}`}
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
