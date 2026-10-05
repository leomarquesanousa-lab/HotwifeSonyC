"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ResendVerification } from "@/src/components/auth/ResendVerification";

export default function ResendVerificationPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  return (
    <main className="min-h-screen bg-[#080b12] text-white flex items-center justify-center px-5">
      <section className="w-full max-w-md rounded-2xl border border-white/10 p-8">
        <h1 className="text-2xl mb-6">{t("resendVerification")}</h1>
        <label htmlFor="resend-email">{t("forgot.email")}</label>
        <input
          id="resend-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full mt-2 rounded-xl bg-white/5 border border-white/10 p-3"
        />
        <ResendVerification email={email} />
        <a href={`/${locale}/login`} className="block mt-6 text-sm">
          {t("verificationBackToLogin")}
        </a>
      </section>
    </main>
  );
}
