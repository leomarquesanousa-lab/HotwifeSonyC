"use client";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  Globe2,
} from "lucide-react";

const languages = [
  {
    code: "en-US",
    label: "English",
  },
  {
    code: "pt-BR",
    label: "Português",
  },
  {
    code: "es-ES",
    label: "Español",
  },
  {
    code: "fr-FR",
    label: "Français",
  },
  {
    code: "cs-CZ",
    label: "Čeština",
  },
];

type LanguageSwitcherProps = {
  currentLocale: string;
};

export default function LanguageSwitcher({
  currentLocale,
}: LanguageSwitcherProps) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  function changeLanguage(
    newLocale: string,
  ) {
    const segments =
      pathname.split("/");

    if (
      segments.length >
      1
    ) {
      segments[1] =
        newLocale;
    }

    router.push(
      segments.join("/"),
    );
  }

  return (
    <div className="relative">
      <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />

      <select
        value={
          currentLocale
        }
        onChange={(
          event,
        ) =>
          changeLanguage(
            event.target
              .value,
          )
        }
        className="h-10 appearance-none rounded-full border border-white/10 bg-white/5 pl-9 pr-8 text-xs text-white/70 outline-none transition hover:bg-white/[0.08] focus:border-cyan-300/40"
        aria-label="Select language"
      >
        {languages.map(
          (
            language,
          ) => (
            <option
              key={
                language.code
              }
              value={
                language.code
              }
              className="bg-[#11141b] text-white"
            >
              {
                language.label
              }
            </option>
          ),
        )}
      </select>
    </div>
  );
}