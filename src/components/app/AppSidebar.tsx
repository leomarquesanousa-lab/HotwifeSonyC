"use client";

import type {
  ComponentType,
} from "react";

import Link from "next/link";

import {
  BarChart3,
  LayoutDashboard,
  Library,
  Plug,
  Send,
  Settings,
  UsersRound,
} from "lucide-react";

import {
  useParams,
  usePathname,
} from "next/navigation";

import {
  useTranslations,
} from "next-intl";

type NavigationItem = {
  label: string;
  path: string;
  icon: ComponentType<{
    className?: string;
  }>;
};

export default function AppSidebar() {
  const pathname =
    usePathname();

  const params =
    useParams<{
      locale: string;
    }>();

  const t =
    useTranslations(
      "appShell",
    );

  const locale =
    params.locale ||
    "en-US";

  const navigation:
    NavigationItem[] = [
      {
        label:
          t("dashboard"),
        path:
          `/${locale}/app`,
        icon:
          LayoutDashboard,
      },
      {
        label:
          t("mediaLibrary"),
        path:
          `/${locale}/app/media`,
        icon:
          Library,
      },
      {
        label:
          t("people"),
        path:
          `/${locale}/app/performers`,
        icon:
          UsersRound,
      },
      {
        label:
          t(
            "publishEverywhere",
          ),
        path:
          `/${locale}/app/distribution`,
        icon:
          Send,
      },
      {
        label:
          t("platforms"),
        path:
          `/${locale}/app/platforms`,
        icon:
          Plug,
      },
      {
        label:
          t("analytics"),
        path:
          `/${locale}/app/analytics`,
        icon:
          BarChart3,
      },
      {
        label:
          t("settings"),
        path:
          `/${locale}/app/settings`,
        icon:
          Settings,
      },
    ];

  function isActive(
    path: string,
  ) {
    if (
      path ===
      `/${locale}/app`
    ) {
      return (
        pathname === path
      );
    }

    return pathname.startsWith(
      path,
    );
  }

  return (
    <aside className="hidden w-[220px] shrink-0 border-r border-white/[0.06] bg-[#090d15] lg:block">
      <div className="sticky top-[64px] flex h-[calc(100vh-64px)] flex-col px-3 py-5">
        <nav className="space-y-1">
          {navigation.map(
            (item) => {
              const Icon =
                item.icon;

              const active =
                isActive(
                  item.path,
                );

              return (
                <Link
                  key={
                    item.path
                  }
                  href={
                    item.path
                  }
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium transition ${
                    active
                      ? "bg-gradient-to-r from-blue-500/[0.13] to-violet-500/[0.06] text-white"
                      : "text-white/40 hover:bg-white/[0.035] hover:text-white/80"
                  }`}
                >
                  {active && (
                    <span className="absolute bottom-2 left-0 top-2 w-[2px] rounded-full bg-blue-400" />
                  )}

                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                      active
                        ? "bg-blue-500/[0.12] text-blue-300"
                        : "bg-white/[0.025] text-white/30 group-hover:text-white/60"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <span className="truncate">
                    {
                      item.label
                    }
                  </span>
                </Link>
              );
            },
          )}
        </nav>

        <div className="mt-auto">
          <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.035] to-transparent p-3.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-300/70">
              Creator Platform
            </div>

            <div className="mt-2 text-[11px] leading-5 text-white/28">
              {
                t(
                  "sidebarTagline",
                )
              }
            </div>

            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.05]">
              <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-blue-500 to-violet-500" />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}