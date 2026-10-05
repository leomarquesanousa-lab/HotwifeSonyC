"use client";

import { FormEvent, useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Check,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

type AccountType = "CREATOR" | "AGENCY";

export default function SignUpPage() {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const locale = useLocale();

  const [returnTo, setReturnTo] = useState('/app');
  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get('next');
    if (next === '/account' || next === '/my-videos') setReturnTo(next);
  }, []);
  const customerQuery = returnTo === '/app' ? '' : '?next=' + encodeURIComponent(returnTo);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");


  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [accountCreated, setAccountCreated] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  function clearMessages() {
    if (errorMessage) {
      setErrorMessage("");
    }

    if (successMessage) {
      setSuccessMessage("");
    }
  }


  function validatePassword(value: string) {
    if (value.length < 12) {
      return t("validationPasswordMin");
    }

    if (!/[a-z]/.test(value)) {
      return t("validationPasswordLowercase");
    }

    if (!/[A-Z]/.test(value)) {
      return t("validationPasswordUppercase");
    }

    if (!/[0-9]/.test(value)) {
      return t("validationPasswordNumber");
    }

    if (!/[^A-Za-z0-9]/.test(value)) {
      return t("validationPasswordSymbol");
    }

    return null;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (accountCreated || isSubmitting) return;

    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      setErrorMessage(t("validationRequiredFields"));
      return;
    }

    const passwordError = validatePassword(password);

    if (passwordError) {
      setErrorMessage(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(t("validationPasswordMismatch"));
      return;
    }

    if (!acceptedTerms) {
      setErrorMessage(t("validationTermsRequired"));
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          confirmPassword,
          acceptedTerms: true,
          locale,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data?.error === "RATE_LIMITED") { setErrorMessage(t("rateLimited")); return; }
        if (data?.error === "EMAIL_ALREADY_EXISTS") {
          setErrorMessage(t("emailAlreadyExists"));
          return;
        }

        if (data?.error === "PASSWORD_MISMATCH") {
          setErrorMessage(t("validationPasswordMismatch"));
          return;
        }

        setErrorMessage(t("unableToCreateAccount"));
        return;
      }

      setAccountCreated(true);
      setSuccessMessage("Your account is ready. Opening your dashboard...");

      window.location.replace(returnTo === "/my-videos" ? returnTo : "/account");
    } catch {
      

      setErrorMessage(t("unableToConnectServer"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080b12] text-white">
      <div className="min-h-screen">
        <section className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[540px]">
            <a href="/" className="mb-10 inline-block"><img src="/logo-hotwifesonyc.png" alt="HotwifeSonyC" className="h-14 w-auto max-w-full object-contain"/></a>

            <div className="mb-8">
              <h2 className="text-3xl font-semibold tracking-[-0.03em]">
                {t("createYourAccount")}
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/45">
                {t("createAccountDescription")}
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
              noValidate
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <ControlledField
                  label={t("firstName")}
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(value) => {
                    setFirstName(value);
                    clearMessages();
                  }}
                />

                <ControlledField
                  label={t("lastName")}
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(value) => {
                    setLastName(value);
                    clearMessages();
                  }}
                />
              </div>

              <ControlledField
                label={t("email")}
                name="email"
                type="email"
                  readOnly={accountCreated}
                autoComplete="email"
                value={email}
                onChange={(value) => {
                  setEmail(value);
                  clearMessages();
                }}
              />

              <ControlledPasswordField
                label={t("password")}
                name="password"
                autoComplete="new-password"
                value={password}
                visible={showPassword}
                onChange={(value) => {
                  setPassword(value);
                  clearMessages();
                }}
                onToggle={() =>
                  setShowPassword((value) => !value)
                }
              />

              <div className="-mt-2 text-xs leading-5 text-white/35">
                {t("passwordRequirement")}
              </div>

              <ControlledPasswordField
                label={t("confirmPassword")}
                name="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                visible={showConfirmPassword}
                onChange={(value) => {
                  setConfirmPassword(value);
                  clearMessages();
                }}
                onToggle={() =>
                  setShowConfirmPassword((value) => !value)
                }
              />

              <label className="flex items-start gap-3 cursor-pointer pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setAcceptedTerms((value) => !value);
                    clearMessages();
                  }}
                  className={`mt-0.5 h-5 w-5 shrink-0 rounded-md border flex items-center justify-center transition ${
                    acceptedTerms
                      ? "border-blue-500 bg-blue-500"
                      : "border-white/15 bg-white/[0.03]"
                  }`}
                >
                  {acceptedTerms && (
                    <Check className="h-3.5 w-3.5" />
                  )}
                </button>

                <span className="text-sm leading-6 text-white/45">
                  {t("acceptTermsPrefix")}{" "}
                  <a
                    href="#"
                    className="text-white/75 hover:text-white"
                    onClick={(event) => event.preventDefault()}
                  >
                    {t("termsOfService")}
                  </a>{" "}
                  {t("and")}{" "}
                  <a
                    href="#"
                    className="text-white/75 hover:text-white"
                    onClick={(event) => event.preventDefault()}
                  >
                    {t("privacyPolicy")}
                  </a>
                  .
                </span>
              </label>

              {errorMessage && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3 text-sm text-emerald-300">
                  {successMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={!acceptedTerms || isSubmitting || accountCreated}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-[#080b12] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmitting && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}

                {isSubmitting
                  ? common("loading")
                  : t("createAccount")}
              </button>
            </form>

            <div className="mt-8 text-center text-sm text-white/40">
              {t("alreadyHaveAccount")}{" "}
              <a
                href={`/login${customerQuery}`}
                className="font-medium text-white/80 hover:text-white"
              >
                {t("signInHere")}
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function ControlledField({
  label,
  name,
  type,
  autoComplete,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm text-white/65"
      >
        {label}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        readOnly={readOnly}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3.5 text-sm text-white outline-none transition focus:border-blue-500/60 focus:bg-white/[0.05]"
      />
    </div>
  );
}

function ControlledPasswordField({
  label,
  name,
  autoComplete,
  value,
  visible,
  onChange,
  onToggle,
}: {
  label: string;
  name: string;
  autoComplete: string;
  value: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm text-white/65"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3.5 pr-12 text-sm text-white outline-none transition focus:border-blue-500/60 focus:bg-white/[0.05]"
        />

        <button
          type="button"
          onClick={onToggle}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
