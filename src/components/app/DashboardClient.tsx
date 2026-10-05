"use client";

import Link from "next/link";

import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileVideo2,
  Loader2,
  Send,
  Upload,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useTranslations,
} from "next-intl";

type DashboardResponse = {
  success: boolean;

  workspace: {
    id: string;
    name: string;
    type: string;
  };

  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    locale: string;
    timezone: string;
  };

  summary: {
    mediaUploaded: number;
    connectedPlatforms: number;
    published: number;
    scheduled: number;
    failed: number;
    creators: number;
  };

  networkStatus: Array<{
    platform: string;
    status: string;
    accounts: Array<{
      id: string;
      username: string | null;
      displayName: string | null;
    }>;
  }>;

  publishingActivity: Array<{
    date: string;
    published: number;
  }>;

  recentActivity: Array<{
    id: string;
    type:
      | "MEDIA_UPLOADED"
      | "PUBLICATION_PUBLISHED"
      | "PUBLICATION_FAILED"
      | "PUBLICATION_SCHEDULED";
    title: string;
    subtitle: string | null;
    platform: string | null;
    date: string;
  }>;

  upcomingPublications: Array<{
    id: string;
    platform: string;
    status: string;
    scheduledAt: string;
    caption: string | null;
  }>;

  distribution: {
    totalJobs: number;
    queued: number;
    scheduled: number;
    completed: number;
    failed: number;
  };
};

type DashboardClientProps = {
  locale: string;
  firstName: string | null;
};

export default function DashboardClient({
  locale,
  firstName,
}: DashboardClientProps) {
  const t =
    useTranslations(
      "dashboard",
    );

  const [
    data,
    setData,
  ] = useState<DashboardResponse | null>(
    null,
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response =
        await fetch(
          "/api/dashboard",
          {
            method: "GET",
            cache: "no-store",
          },
        );

      const result =
        (await response.json()) as
          | DashboardResponse
          | {
              success: false;
              error?: string;
            };

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          t("unableToLoad"),
        );
      }

      setData(
        result as DashboardResponse,
      );
    } catch (error) {
      console.error(
        "DASHBOARD_CLIENT_ERROR",
        error,
      );

      setErrorMessage(
        t("unableToLoad"),
      );
    } finally {
      setIsLoading(false);
    }
  }

  const maxPublished =
    useMemo(() => {
      if (
        !data ||
        data.publishingActivity.length ===
          0
      ) {
        return 1;
      }

      return Math.max(
        1,
        ...data.publishingActivity.map(
          (item) =>
            item.published,
        ),
      );
    }, [
      data,
    ]);

  if (isLoading) {
    return (
      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[#080b12]">
        <div className="text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-400" />

          <div className="mt-3 text-xs text-white/30">
            {t(
              "loadingDashboard",
            )}
          </div>
        </div>
      </main>
    );
  }

  if (
    !data ||
    errorMessage
  ) {
    return (
      <main className="min-h-[calc(100vh-64px)] bg-[#080b12] px-5 py-6 text-white sm:px-7 lg:px-8">
        <div className="mx-auto max-w-[1540px]">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">
            {
              errorMessage ||
              t(
                "unableToLoad",
              )
            }
          </div>
        </div>
      </main>
    );
  }

  const greetingName =
    firstName ||
    data.user.firstName ||
    t("creatorFallback");

  return (
    <main className="min-h-[calc(100vh-64px)] bg-[#080b12] text-white">
      <div className="mx-auto w-full max-w-[1540px] px-5 py-6 sm:px-7 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300/70">
              {t("title")}
            </div>

            <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.04em]">
              {t(
                "welcome",
                {
                  name:
                    greetingName,
                },
              )}
            </h1>

            <p className="mt-1 text-xs text-white/35">
              {t(
                "networkOverview",
              )}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href={`/${locale}/app/media`}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-2.5 text-[11px] font-medium text-white/60 transition hover:bg-white/[0.05] hover:text-white"
            >
              <Upload className="h-3.5 w-3.5" />

              {t(
                "uploadMedia",
              )}
            </Link>

            <Link
              href={`/${locale}/app/distribution`}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-2.5 text-[11px] font-semibold text-white shadow-[0_10px_30px_rgba(99,102,241,0.16)] transition hover:brightness-110"
            >
              <Send className="h-3.5 w-3.5" />

              {t(
                "publishEverywhere",
              )}
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <SummaryCard
            label={t(
              "mediaUploaded",
            )}
            value={
              data.summary
                .mediaUploaded
            }
            icon={
              <FileVideo2 className="h-4 w-4 text-blue-300" />
            }
          />

          <SummaryCard
            label={t(
              "published",
            )}
            value={
              data.summary.published
            }
            icon={
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            }
          />

          <SummaryCard
            label={t(
              "scheduled",
            )}
            value={
              data.summary.scheduled
            }
            icon={
              <CalendarClock className="h-4 w-4 text-violet-300" />
            }
          />

          <SummaryCard
            label={t(
              "failed",
            )}
            value={
              data.summary.failed
            }
            icon={
              <AlertTriangle className="h-4 w-4 text-red-300" />
            }
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.65fr_0.75fr]">
          <section className="rounded-[18px] border border-white/[0.07] bg-white/[0.018] p-4">
            <div className="mb-4">
              <div className="text-xs font-semibold text-white/80">
                {t(
                  "publishingActivity",
                )}
              </div>

              <div className="mt-1 text-[10px] text-white/25">
                {t(
                  "publicationsLast30Days",
                )}
              </div>
            </div>

            <div className="flex h-[220px] items-end gap-[3px]">
              {data.publishingActivity.map(
                (item) => {
                  const height =
                    Math.max(
                      item.published >
                        0
                        ? 8
                        : 2,
                      (
                        item.published /
                        maxPublished
                      ) *
                        100,
                    );

                  return (
                    <div
                      key={
                        item.date
                      }
                      className="group relative flex h-full min-w-0 flex-1 items-end"
                    >
                      <div
                        className={`w-full rounded-t-sm transition ${
                          item.published >
                          0
                            ? "bg-gradient-to-t from-blue-500/70 to-violet-400/80"
                            : "bg-white/[0.035]"
                        }`}
                        style={{
                          height:
                            `${height}%`,
                        }}
                      />

                      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/[0.08] bg-[#111722] px-2 py-1.5 text-[9px] text-white/70 shadow-xl group-hover:block">
                        <div>
                          {formatShortDate(
                            item.date,
                            locale,
                          )}
                        </div>

                        <div className="mt-0.5 text-white/35">
                          {t(
                            item.published ===
                              1
                              ? "publishedCountSingular"
                              : "publishedCountPlural",
                            {
                              count:
                                item.published,
                            },
                          )}
                        </div>
                      </div>
                    </div>
                  );
                },
              )}
            </div>

            <div className="mt-3 flex items-center justify-between text-[9px] text-white/20">
              <span>
                {formatShortDate(
                  data
                    .publishingActivity[0]
                    ?.date,
                  locale,
                )}
              </span>

              <span>
                {t(
                  "last30Days",
                )}
              </span>

              <span>
                {formatShortDate(
                  data
                    .publishingActivity[
                    data
                      .publishingActivity
                      .length -
                      1
                  ]?.date,
                  locale,
                )}
              </span>
            </div>
          </section>

          <section className="rounded-[18px] border border-white/[0.07] bg-white/[0.018] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white/80">
                  {t(
                    "networkStatus",
                  )}
                </div>

                <div className="mt-1 text-[10px] text-white/25">
                  {t(
                    "connectedDestinations",
                  )}
                </div>
              </div>

              <div className="rounded-full border border-emerald-500/15 bg-emerald-500/[0.06] px-2 py-1 text-[9px] font-medium text-emerald-300">
                {t(
                  data.summary
                    .connectedPlatforms ===
                    1
                    ? "connectedCountSingular"
                    : "connectedCountPlural",
                  {
                    count:
                      data.summary
                        .connectedPlatforms,
                  },
                )}
              </div>
            </div>

            <div className="max-h-[220px] space-y-1 overflow-y-auto pr-1">
              {data.networkStatus.map(
                (platform) => (
                  <div
                    key={
                      platform.platform
                    }
                    className="flex items-center justify-between rounded-lg px-2 py-2.5 transition hover:bg-white/[0.025]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.35)]" />

                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-medium text-white/70">
                          {formatPlatformName(
                            platform.platform,
                          )}
                        </div>

                        <div className="mt-0.5 truncate text-[9px] text-white/22">
                          {getAccountLabel(
                            platform.accounts,
                            t(
                              "connected",
                            ),
                            t(
                              "connectedAccount",
                            ),
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="ml-3 text-[9px] text-emerald-300/70">
                      {t(
                        "connected",
                      )}
                    </div>
                  </div>
                ),
              )}

              {data.networkStatus
                .length ===
                0 && (
                <div className="flex min-h-[150px] items-center justify-center text-center text-[10px] text-white/25">
                  {t(
                    "noConnectedPlatforms",
                  )}
                </div>
              )}
            </div>

            <Link
              href={`/${locale}/app/platforms`}
              className="mt-3 flex h-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-[9px] font-medium text-white/35 transition hover:bg-white/[0.04] hover:text-white"
            >
              {t(
                "managePlatforms",
              )}
            </Link>
          </section>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <section className="rounded-[18px] border border-white/[0.07] bg-white/[0.018] p-4">
            <div className="mb-4">
              <div className="text-xs font-semibold text-white/80">
                {t(
                  "recentActivity",
                )}
              </div>

              <div className="mt-1 text-[10px] text-white/25">
                {t(
                  "latestUploadsPublications",
                )}
              </div>
            </div>

            <div className="space-y-1">
              {data.recentActivity
                .slice(
                  0,
                  6,
                )
                .map(
                  (item) => (
                    <ActivityRow
                      key={
                        item.id
                      }
                      item={
                        item
                      }
                      locale={
                        locale
                      }
                    />
                  ),
                )}

              {data.recentActivity
                .length ===
                0 && (
                <EmptyState
                  text={t(
                    "noRecentActivity",
                  )}
                />
              )}
            </div>
          </section>

          <section className="rounded-[18px] border border-white/[0.07] bg-white/[0.018] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white/80">
                  {t(
                    "upcomingPublications",
                  )}
                </div>

                <div className="mt-1 text-[10px] text-white/25">
                  {t(
                    "nextScheduledPosts",
                  )}
                </div>
              </div>

              <Clock3 className="h-4 w-4 text-violet-300/60" />
            </div>

            <div className="space-y-1">
              {data.upcomingPublications
                .slice(
                  0,
                  6,
                )
                .map(
                  (item) => (
                    <div
                      key={
                        item.id
                      }
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition hover:bg-white/[0.025]"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-white/65">
                          {formatPlatformName(
                            item.platform,
                          )}
                        </div>

                        <div className="mt-0.5 truncate text-[9px] text-white/22">
                          {item.caption ||
                            t(
                              "scheduledPublication",
                            )}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-[9px] font-medium text-violet-300/75">
                          {formatDateTime(
                            item.scheduledAt,
                            locale,
                          )}
                        </div>
                      </div>
                    </div>
                  ),
                )}

              {data
                .upcomingPublications
                .length ===
                0 && (
                <EmptyState
                  text={t(
                    "noPublicationsScheduled",
                  )}
                />
              )}
            </div>

            <Link
              href={`/${locale}/app/distribution`}
              className="mt-3 flex h-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-[9px] font-medium text-white/35 transition hover:bg-white/[0.04] hover:text-white"
            >
              {t(
                "schedulePublication",
              )}
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-white/[0.07] bg-white/[0.018] px-3 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.035]">
        {icon}
      </div>

      <div>
        <div className="text-[9px] uppercase tracking-[0.09em] text-white/25">
          {label}
        </div>

        <div className="mt-0.5 text-lg font-semibold text-white/85">
          {value}
        </div>
      </div>
    </div>
  );
}

function ActivityRow({
  item,
  locale,
}: {
  item: DashboardResponse["recentActivity"][number];
  locale: string;
}) {
  const icon =
    getActivityIcon(
      item.type,
    );

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition hover:bg-white/[0.025]">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.025]">
          {icon}
        </div>

        <div className="min-w-0">
          <div className="truncate text-[11px] font-medium text-white/65">
            {item.title}
          </div>

          <div className="mt-0.5 truncate text-[9px] text-white/22">
            {item.platform
              ? `${formatPlatformName(
                  item.platform,
                )}${
                  item.subtitle
                    ? ` · ${item.subtitle}`
                    : ""
                }`
              : item.subtitle ||
                ""}
          </div>
        </div>
      </div>

      <div className="shrink-0 text-[9px] text-white/20">
        {formatDateTime(
          item.date,
          locale,
        )}
      </div>
    </div>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex min-h-[150px] items-center justify-center rounded-xl border border-dashed border-white/[0.06] text-[10px] text-white/22">
      {text}
    </div>
  );
}

function getActivityIcon(
  type: DashboardResponse["recentActivity"][number]["type"],
) {
  switch (type) {
    case "MEDIA_UPLOADED":
      return (
        <Upload className="h-3.5 w-3.5 text-blue-300" />
      );

    case "PUBLICATION_PUBLISHED":
      return (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
      );

    case "PUBLICATION_FAILED":
      return (
        <AlertTriangle className="h-3.5 w-3.5 text-red-300" />
      );

    case "PUBLICATION_SCHEDULED":
      return (
        <CalendarClock className="h-3.5 w-3.5 text-violet-300" />
      );

    default:
      return (
        <Clock3 className="h-3.5 w-3.5 text-white/40" />
      );
  }
}

function formatPlatformName(
  platform: string,
) {
  const map:
    Record<
      string,
      string
    > = {
      INSTAGRAM:
        "Instagram",
      FANVUE:
        "Fanvue",
      FACEBOOK:
        "Facebook",
      MANYVIDS:
        "ManyVids",
      REDDIT:
        "Reddit",
      X:
        "X",
      PORNHUB:
        "Pornhub",
      ONLYFANS:
        "OnlyFans",
      FANSLY:
        "Fansly",
      LOYALFANS:
        "LoyalFans",
      MYM:
        "MYM",
    };

  return (
    map[platform] ||
    platform
  );
}

function getAccountLabel(
  accounts: DashboardResponse["networkStatus"][number]["accounts"],
  connectedLabel: string,
  connectedAccountLabel: string,
) {
  if (
    accounts.length ===
    0
  ) {
    return connectedLabel;
  }

  const first =
    accounts[0];

  const label =
    first.username ||
    first.displayName ||
    connectedAccountLabel;

  if (
    accounts.length ===
    1
  ) {
    return label.startsWith(
      "@",
    )
      ? label
      : `@${label}`;
  }

  return `${label} +${
    accounts.length -
    1
  }`;
}

function formatShortDate(
  value: string | undefined,
  locale: string,
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(
      `${value}T12:00:00`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    locale,
    {
      month: "short",
      day: "numeric",
    },
  ).format(date);
}

function formatDateTime(
  value: string,
  locale: string,
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    locale,
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(date);
}