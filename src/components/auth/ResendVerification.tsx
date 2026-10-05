"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

export function ResendVerification({ email }: { email: string }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function resend() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), locale }),
      });
      setMessage(
        t(
          response.ok
            ? "resendAccepted"
            : response.status === 429
              ? "rateLimited"
              : "recoveryRequestFailed",
        ),
      );
    } catch {
      setMessage(t("networkFailed"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-5 space-y-3">
      <button
        type="button"
        disabled={busy || !email.trim()}
        onClick={resend}
        className="text-sm text-blue-300 disabled:opacity-40"
      >
        {t("resendVerification")}
      </button>
      <p role="status" className="text-sm text-white/70">
        {message}
      </p>
    </div>
  );
}
