"use client";

import {
  FormEvent,
  useState,
} from "react";

import {
  ArrowLeft,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { useLocale, useTranslations } from "next-intl";



export default function ForgotPasswordPage() {
  const locale =
    useLocale();

  const t = useTranslations("auth.forgot");
  const authT = useTranslations("auth");

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (
      !email.trim() ||
      !email.includes("@")
    ) {
      setError(
        t("invalid"),
      );

      return;
    }

    try {
      setIsSubmitting(
        true,
      );

      const response =
        await fetch(
          "/api/auth/forgot-password",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                email:
                  email.trim(),
                locale:
                  locale,
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

      setMessage(
        t("success"),
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
            </div>
          </div>

          <div className="rounded-[20px] border border-white/10 bg-white/[0.025] p-6 sm:p-8">
            <div className="mb-6">

              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-blue-500/15 bg-blue-500/[0.07]">
                <Mail className="h-5 w-5 text-blue-300" />
              </div>

              <h1 className="text-2xl font-semibold tracking-[-0.03em]">
                {t("title")}
              </h1>

              <p className="mt-2 text-sm leading-6 text-white/40">
                {t("subtitle")}
              </p>
            </div>

            <form
              onSubmit={
                handleSubmit
              }
              className="space-y-5"
            >
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm text-white/65"
                >
                  {t("email")}
                </label>

                <input
                  id="email"
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

                    setError("");
                    setMessage("");
                  }}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3.5 text-sm text-white outline-none transition focus:border-blue-500/60"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {message && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3 text-sm text-emerald-300">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={
                  isSubmitting
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-[#080b12] transition hover:bg-white/90 disabled:opacity-40"
              >
                {isSubmitting && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}

                {isSubmitting
                  ? t("sending")
                  : t("send")}
              </button>
            </form>

            <a
              href={`/login`}
              className="mt-6 flex items-center justify-center gap-2 text-xs text-white/40 transition hover:text-white/70"
            >
              <ArrowLeft className="h-3.5 w-3.5" />

              {t("back")}
            </a>

          </div>
        </div>
      </div>
    </main>
  );
}