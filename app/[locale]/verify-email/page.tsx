"use client";

import { useEffect, useState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CheckCircle2,
  Loader2,
  MailCheck,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

type VerificationState =
  | "LOADING"
  | "SUCCESS"
  | "ERROR";

export default function VerifyEmailPage() {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const locale = useLocale();

  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] =
    useState<VerificationState>("LOADING");

  const [message, setMessage] = useState("");

  const pending = useRef<{token: string; result: Promise<{ok: boolean; error?: string}>} | null>(null);
  useEffect(() => {
    const token = searchParams.get("token") ?? "";
    let cancelled = false;
    if (!pending.current || pending.current.token !== token) {
      pending.current = { token, result: token ? fetch("/api/auth/verify-email", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({token})
      }).then(async response => ({ok: response.ok, error: (await response.json()).error})) : Promise.resolve({ok: false}) };
    }
    pending.current.result.then(result => {
      if (cancelled) return;
      setStatus(result.ok ? "SUCCESS" : "ERROR");
      setMessage(t(result.ok ? "verificationSuccess" : result.error === "RATE_LIMITED" ? "rateLimited" : "recoveryInvalidLink"));
    }).catch(() => { if (!cancelled) { setStatus("ERROR"); setMessage(t("verificationUnable")); } });
    return () => { cancelled = true; };
  }, [searchParams, t]);

  return (
    <main className="min-h-screen bg-[#080b12] text-white">
      <meta name="referrer" content="no-referrer" />
      <div className="min-h-screen flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[520px]">
          <div className="mb-10 flex items-center justify-center gap-3">
            <div className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.04] flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-blue-400" />
            </div>

            <div>
              <div className="font-semibold tracking-tight">
                {common("appName")}
              </div>

              <div className="text-xs text-white/40">
                {t("protectedByDesign")}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-8 sm:p-10 text-center">
            {status === "LOADING" && (
              <>
                <div className="mx-auto h-14 w-14 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                </div>

                <h1 className="mt-6 text-2xl font-semibold tracking-[-0.03em]">
                  {t("verificationChecking")}
                </h1>

                <p className="mt-3 text-sm leading-6 text-white/45">
                  {t("verificationCheckingDescription")}
                </p>
              </>
            )}

            {status === "SUCCESS" && (
              <>
                <div className="mx-auto h-14 w-14 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                </div>

                <h1 className="mt-6 text-2xl font-semibold tracking-[-0.03em]">
                  {t("verificationSuccessTitle")}
                </h1>

                <p className="mt-3 text-sm leading-6 text-white/45">
                  {message}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    router.push(`/login`)
                  }
                  className="mt-7 w-full rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-[#080b12] transition hover:bg-white/90"
                >
                  {t("verificationGoToLogin")}
                </button>
              </>
            )}

            {status === "ERROR" && (
              <>
                <div className="mx-auto h-14 w-14 rounded-2xl border border-red-500/20 bg-red-500/[0.08] flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-red-400" />
                </div>

                <h1 className="mt-6 text-2xl font-semibold tracking-[-0.03em]">
                  {t("verificationErrorTitle")}
                </h1>

                <p className="mt-3 text-sm leading-6 text-white/45">
                  {message}
                </p>

                <a className="block mt-4 text-blue-300" href={`/resend-verification`}>{t("resendVerification")}</a>

                <button
                  type="button"
                  onClick={() =>
                    router.push(`/login`)
                  }
                  className="mt-7 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-white/[0.07]"
                >
                  {t("verificationBackToLogin")}
                </button>
              </>
            )}
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-white/30">
            <MailCheck className="h-3.5 w-3.5" />
            {t("secureFooter")}
          </div>
        </div>
      </div>
    </main>
  );
}