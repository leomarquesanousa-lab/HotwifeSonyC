"use client";

import {
  FormEvent,
  useState,
} from "react";

import {
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";



export default function ResetPasswordPage() {
  const locale =
    useLocale();

  const searchParams =
    useSearchParams();

  const token =
    searchParams
      .get("token")
      ?.trim() || "";

  const t = useTranslations("auth.reset");
  const authT = useTranslations("auth");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
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
    success,
    setSuccess,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");

    if (!token) {
      setError(
        t("missing"),
      );

      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setError(
        t("mismatch"),
      );

      return;
    }

    try {
      setIsSubmitting(
        true,
      );

      const response =
        await fetch(
          "/api/auth/reset-password",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                token,
                password,
                confirmPassword,
              }),
          },
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data?.success
      ) {
        setError(
          (data?.error === "RATE_LIMITED" ? authT("rateLimited") : data?.error === "INVALID_TOKEN" ? authT("recoveryInvalidLink") : t("error")),
        );

        return;
      }

      setSuccess(
        true,
      );
    } catch {
      setError(
        t("error"),
      );
    } finally {
      setIsSubmitting(
        false,
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#080b12] text-white">
      <meta name="referrer" content="no-referrer" />
      <div className="flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-[460px]">

          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              <ShieldCheck className="h-5 w-5 text-blue-400" />
            </div>

            <div>
              <div className="font-semibold">
                Creator Platform
              </div>

              <div className="text-xs text-white/35">
                Secure account recovery
              </div>
            </div>
          </div>

          <div className="rounded-[20px] border border-white/10 bg-white/[0.025] p-6 sm:p-8">

            <div className="mb-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-blue-500/15 bg-blue-500/[0.07]">
                <LockKeyhole className="h-5 w-5 text-blue-300" />
              </div>

              <h1 className="text-2xl font-semibold tracking-[-0.03em]">
                {t("title")}
              </h1>

              <p className="mt-2 text-sm leading-6 text-white/40">
                {t("subtitle")}
              </p>
            </div>

            {success ? (
              <div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3 text-sm text-emerald-300">
                  {t("success")}
                </div>

                <a
                  href={`/${locale}/login`}
                  className="mt-5 flex w-full items-center justify-center rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-[#080b12]"
                >
                  {t("signIn")}
                </a>
              </div>
            ) : (
              <form
                onSubmit={
                  handleSubmit
                }
                className="space-y-5"
              >

                <div>
                  <label className="mb-2 block text-sm text-white/65">
                    {t("password")}
                  </label>

                  <div className="relative">
                    <input
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      autoComplete="new-password"
                      value={
                        password
                      }
                      onChange={(
                        event,
                      ) => {
                        setPassword(
                          event.target.value,
                        );

                        setError("");
                      }}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3.5 pr-12 text-sm text-white outline-none transition focus:border-blue-500/60"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          (value) =>
                            !value,
                        )
                      }
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/35 transition hover:text-white/70"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <div className="mt-2 text-[11px] leading-5 text-white/30">
                    {t("requirements")}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-white/65">
                    {t("confirm")}
                  </label>

                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    autoComplete="new-password"
                    value={
                      confirmPassword
                    }
                    onChange={(
                      event,
                    ) => {
                      setConfirmPassword(
                        event.target.value,
                      );

                      setError("");
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3.5 text-sm text-white outline-none transition focus:border-blue-500/60"
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !token
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-[#080b12] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSubmitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}

                  {isSubmitting
                    ? t("saving")
                    : t("save")}
                </button>

              </form>
            )}

          </div>
        </div>
      </div>
    </main>
  );
}