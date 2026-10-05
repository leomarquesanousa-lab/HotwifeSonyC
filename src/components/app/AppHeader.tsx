"use client";

import Link from "next/link";

import {
  Bell,
  CheckCircle2,
  FileVideo2,
  Loader2,
  Menu,
  Search,
  Send,
  Settings,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";

import {
  useParams,
} from "next/navigation";

import {
  useState,
} from "react";

import {
  useTranslations,
} from "next-intl";

import {
  useUploadManager,
} from "@/src/components/app/UploadManagerProvider";

export default function AppHeader() {
  const params =
    useParams<{
      locale: string;
    }>();

  const locale =
    params.locale ||
    "en-US";

  const t =
    useTranslations(
      "appHeader",
    );

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);

  const [
    uploadPanelOpen,
    setUploadPanelOpen,
  ] = useState(false);

  const {
    uploads,
    isUploading,
    activeCount,
    completedCount,
    overallProgress,
    cancelUpload,
    clearCompleted,
  } = useUploadManager();

  const visibleUploads =
    uploads.filter(
      (upload) =>
        upload.status !==
        "CANCELLED",
    );

  const hasUploads =
    visibleUploads.length >
    0;

  const hasActiveUploads =
    activeCount >
    0 ||
    isUploading;

  const mobileLinks = [
    {
      label:
        t("dashboard"),
      href:
        `/${locale}/app`,
    },
    {
      label:
        t("mediaLibrary"),
      href:
        `/${locale}/app/media`,
    },
    {
      label:
        t("publishEverywhere"),
      href:
        `/${locale}/app/distribution`,
    },
    {
      label:
        t("platforms"),
      href:
        `/${locale}/app/platforms`,
    },
    {
      label:
        t("analytics"),
      href:
        `/${locale}/app/analytics`,
    },
    {
      label:
        t("settings"),
      href:
        `/${locale}/app/settings`,
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 h-[64px] border-b border-white/[0.07] bg-[#080b12]/95 backdrop-blur-xl">
        <div className="flex h-full w-full items-center px-5 lg:px-6">
          <Link
            href={`/${locale}/app`}
            className="flex w-auto shrink-0 items-center gap-3 lg:w-[194px]"
          >
            <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 shadow-[0_0_25px_rgba(99,102,241,0.2)]">
              <Send className="relative z-10 h-4 w-4 text-white" />

              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
            </div>

            <div className="hidden sm:block">
              <div className="text-[13px] font-semibold tracking-[-0.02em] text-white">
                Creator Platform
              </div>

              <div className="mt-0.5 text-[8px] uppercase tracking-[0.16em] text-white/25">
                {t("brandTagline")}
              </div>
            </div>
          </Link>

          <div className="hidden h-7 w-px bg-white/[0.06] lg:block" />

          <button
            type="button"
            className="ml-5 hidden items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[11px] text-white/55 transition hover:bg-white/[0.045] lg:flex"
          >
            <div className="h-2 w-2 rounded-full bg-emerald-400" />

            {t("myWorkspace")}

            <span className="ml-1 text-[9px] text-white/20">
              ▼
            </span>
          </button>

          <div className="mx-auto hidden w-full max-w-[420px] px-8 xl:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />

              <input
                type="text"
                placeholder={t("searchMedia")}
                className="h-9 w-full rounded-xl border border-white/[0.07] bg-white/[0.025] pl-9 pr-12 text-[11px] text-white outline-none placeholder:text-white/20 focus:border-blue-500/30"
              />

              <div className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-white/[0.06] bg-white/[0.025] px-1.5 py-1 text-[8px] text-white/20">
                CTRL K
              </div>
            </div>
          </div>

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            {hasUploads && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setUploadPanelOpen(
                      (current) =>
                        !current,
                    )
                  }
                  className={`flex h-9 items-center gap-2 rounded-xl border px-3 text-[10px] font-medium transition ${
                    hasActiveUploads
                      ? "border-blue-500/25 bg-blue-500/[0.08] text-blue-200 hover:bg-blue-500/[0.13]"
                      : "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300 hover:bg-emerald-500/[0.1]"
                  }`}
                >
                  {hasActiveUploads ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}

                  <span>
                    {hasActiveUploads
                      ? t(
                          (activeCount || 1) === 1
                            ? "uploadActiveSingular"
                            : "uploadActivePlural",
                          {
                            count:
                              activeCount || 1,
                            progress:
                              overallProgress,
                          },
                        )
                      : t(
                          completedCount === 1
                            ? "uploadCompleteSingular"
                            : "uploadCompletePlural",
                          {
                            count:
                              completedCount,
                          },
                        )}
                  </span>
                </button>

                {uploadPanelOpen && (
                  <UploadHeaderPanel
                    uploads={
                      visibleUploads
                    }
                    overallProgress={
                      overallProgress
                    }
                    activeCount={
                      activeCount
                    }
                    onCancel={
                      cancelUpload
                    }
                    onClearCompleted={
                      clearCompleted
                    }
                    onClose={() =>
                      setUploadPanelOpen(
                        false,
                      )
                    }
                    mediaHref={`/${locale}/app/media`}
                    t={t}
                  />
                )}
              </div>
            )}

            <button
              type="button"
              aria-label={t("notifications")}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-white/35 transition hover:bg-white/[0.05] hover:text-white"
            >
              <Bell className="h-4 w-4" />

              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-400 ring-2 ring-[#080b12]" />
            </button>

            <Link
              href={`/${locale}/app/settings`}
              aria-label={t("settings")}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-white/35 transition hover:bg-white/[0.05] hover:text-white"
            >
              <Settings className="h-4 w-4" />
            </Link>

            <button
              type="button"
              className="ml-1 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-2 py-1.5 transition hover:bg-white/[0.05]"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/25 to-violet-500/25">
                <UserRound className="h-3.5 w-3.5 text-white/60" />
              </div>

              <div className="hidden text-left 2xl:block">
                <div className="text-[10px] font-medium text-white/75">
                  {t("myAccount")}
                </div>

                <div className="text-[9px] text-white/25">
                  {t("creator")}
                </div>
              </div>
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2 lg:hidden">
            {hasUploads && (
              <button
                type="button"
                onClick={() =>
                  setUploadPanelOpen(
                    (current) =>
                      !current,
                  )
                }
                aria-label={t("uploads")}
                className={`relative flex h-9 min-w-9 items-center justify-center rounded-xl border px-2.5 ${
                  hasActiveUploads
                    ? "border-blue-500/25 bg-blue-500/[0.08] text-blue-300"
                    : "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300"
                }`}
              >
                {hasActiveUploads ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}

                {hasActiveUploads && (
                  <span className="ml-1.5 text-[9px] font-semibold">
                    {overallProgress}%
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              aria-label={t("openMenu")}
              onClick={() =>
                setMobileOpen(
                  (current) =>
                    !current,
                )
              }
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-white/50"
            >
              {mobileOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {uploadPanelOpen &&
        hasUploads && (
        <div className="fixed inset-x-3 top-[72px] z-[70] lg:hidden">
          <UploadHeaderPanel
            uploads={
              visibleUploads
            }
            overallProgress={
              overallProgress
            }
            activeCount={
              activeCount
            }
            onCancel={
              cancelUpload
            }
            onClearCompleted={
              clearCompleted
            }
            onClose={() =>
              setUploadPanelOpen(
                false,
              )
            }
            mediaHref={`/${locale}/app/media`}
            mobile
            t={t}
          />
        </div>
      )}

      {mobileOpen && (
        <div className="fixed inset-x-0 top-[64px] z-40 border-b border-white/[0.07] bg-[#090d15] p-4 shadow-2xl lg:hidden">
          <div className="grid gap-1">
            {mobileLinks.map(
              (item) => (
                <Link
                  key={
                    item.href
                  }
                  href={
                    item.href
                  }
                  onClick={() =>
                    setMobileOpen(
                      false,
                    )
                  }
                  className="rounded-xl px-4 py-3 text-xs text-white/50 transition hover:bg-white/[0.04] hover:text-white"
                >
                  {
                    item.label
                  }
                </Link>
              ),
            )}
          </div>
        </div>
      )}
    </>
  );
}

function UploadHeaderPanel({
  uploads,
  overallProgress,
  activeCount,
  onCancel,
  onClearCompleted,
  onClose,
  mediaHref,
  mobile = false,
  t,
}: {
  uploads: {
    localId: string;
    file: File;
    progress: number;
    uploadedBytes: number;
    status: string;
    error: string;
  }[];
  overallProgress: number;
  activeCount: number;
  onCancel: (
    localId: string,
  ) => void;
  onClearCompleted: () => void;
  onClose: () => void;
  mediaHref: string;
  mobile?: boolean;
  t: (
    key: string,
    values?: Record<
      string,
      string | number
    >,
  ) => string;
}) {
  const completedCount =
    uploads.filter(
      (upload) =>
        upload.status ===
        "DONE",
    ).length;

  return (
    <div
      className={
        mobile
          ? "w-full overflow-hidden rounded-[18px] border border-white/[0.09] bg-[#0b1018] shadow-[0_24px_70px_rgba(0,0,0,0.5)]"
          : "absolute right-0 top-[46px] w-[390px] overflow-hidden rounded-[18px] border border-white/[0.09] bg-[#0b1018] shadow-[0_24px_70px_rgba(0,0,0,0.5)]"
      }
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <UploadCloud className="h-4 w-4 text-blue-300" />

            <div className="text-xs font-semibold text-white/80">
              {t("uploadManager")}
            </div>
          </div>

          <div className="mt-1 text-[9px] text-white/25">
            {activeCount >
            0
              ? t(
                  activeCount === 1
                    ? "panelActiveSingular"
                    : "panelActivePlural",
                  {
                    count:
                      activeCount,
                    progress:
                      overallProgress,
                  },
                )
              : t(
                  completedCount === 1
                    ? "panelCompletedSingular"
                    : "panelCompletedPlural",
                  {
                    count:
                      completedCount,
                  },
                )}
          </div>
        </div>

        <button
          type="button"
          onClick={
            onClose
          }
          className="rounded-lg p-1.5 text-white/25 transition hover:bg-white/[0.05] hover:text-white"
          aria-label={t("closeUploadManager")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="max-h-[340px] overflow-y-auto">
        {uploads.map(
          (upload) => {
            const isActive =
              upload.status ===
                "STARTING" ||
              upload.status ===
                "UPLOADING" ||
              upload.status ===
                "COMPLETING";

            return (
              <div
                key={
                  upload.localId
                }
                className="border-b border-white/[0.05] px-4 py-3 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.035]">
                    {upload.status ===
                    "DONE" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                    ) : upload.status ===
                      "ERROR" ? (
                      <FileVideo2 className="h-3.5 w-3.5 text-red-300" />
                    ) : (
                      <FileVideo2 className="h-3.5 w-3.5 text-blue-300" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[10px] font-medium text-white/70">
                      {upload.file.name}
                    </div>

                    <div className="mt-0.5 flex items-center justify-between gap-3">
                      <div className="text-[8px] text-white/25">
                        {getUploadLabel(
                          upload.status,
                          t,
                        )}
                      </div>

                      <div className="text-[8px] font-medium text-white/30">
                        {upload.progress}%
                      </div>
                    </div>
                  </div>

                  {isActive && (
                    <button
                      type="button"
                      onClick={() =>
                        onCancel(
                          upload.localId,
                        )
                      }
                      className="rounded-lg border border-red-500/15 bg-red-500/[0.04] px-2 py-1 text-[8px] font-medium text-red-300/80 transition hover:bg-red-500/[0.08]"
                    >
                      {t("cancel")}
                    </button>
                  )}
                </div>

                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ${
                      upload.status ===
                      "DONE"
                        ? "bg-emerald-400"
                        : upload.status ===
                          "ERROR"
                          ? "bg-red-400"
                          : "bg-blue-400"
                    }`}
                    style={{
                      width:
                        `${upload.progress}%`,
                    }}
                  />
                </div>

                {upload.error && (
                  <div className="mt-1.5 text-[8px] leading-4 text-red-300/70">
                    {upload.error}
                  </div>
                )}
              </div>
            );
          },
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-3">
        <Link
          href={
            mediaHref
          }
          onClick={
            onClose
          }
          className="text-[9px] font-medium text-blue-300 transition hover:text-blue-200"
        >
          {t("openMediaLibrary")}
        </Link>

        {completedCount >
          0 && (
          <button
            type="button"
            onClick={
              onClearCompleted
            }
            className="text-[9px] text-white/30 transition hover:text-white/60"
          >
            {t("clearCompleted")}
          </button>
        )}
      </div>
    </div>
  );
}

function getUploadLabel(
  status: string,
  t: (
    key: string,
  ) => string,
) {
  switch (status) {
    case "READY":
      return t("statusWaiting");

    case "STARTING":
      return t("statusPreparing");

    case "UPLOADING":
      return t("statusUploading");

    case "COMPLETING":
      return t("statusFinalizing");

    case "DONE":
      return t("statusComplete");

    case "ERROR":
      return t("statusFailed");

    case "CANCELLED":
      return t("statusCancelled");

    default:
      return status;
  }
}
