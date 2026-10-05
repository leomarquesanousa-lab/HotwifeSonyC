import { NextResponse } from "next/server";

import { db } from "@/src/prisma/db";
import { getCurrentSession } from "@/src/lib/auth/session";

type ActivityItem = {
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
};

type PublishingActivityPoint = {
  date: string;
  published: number;
};

export async function GET() {
  try {
    const session =
      await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
        },
        {
          status: 401,
        },
      );
    }

    const membership =
      await db.orm.public.WorkspaceMember
        .where({
          userId:
            session.user.id,
        })
        .first();

    if (!membership) {
      return NextResponse.json(
        {
          success: false,
          error:
            "WORKSPACE_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    const workspace =
      await db.orm.public.Workspace
        .where({
          id:
            membership.workspaceId,
        })
        .first();

    if (!workspace) {
      return NextResponse.json(
        {
          success: false,
          error:
            "WORKSPACE_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    const [
      mediaAssets,
      platformAccounts,
      distributionJobs,
      publications,
      creators,
    ] =
      await Promise.all([
        db.orm.public.MediaAsset
          .where({
            workspaceId:
              workspace.id,
          })
          .all(),

        db.orm.public.PlatformAccount
          .where({
            workspaceId:
              workspace.id,
          })
          .all(),

        db.orm.public.DistributionJob
          .where({
            workspaceId:
              workspace.id,
          })
          .all(),

        db.orm.public.PlatformPublication
          .where({
            workspaceId:
              workspace.id,
          })
          .all(),

        db.orm.public.Creator
          .where({
            workspaceId:
              workspace.id,
          })
          .all(),
      ]);

    const uploadedMedia =
      mediaAssets.filter(
        (item) =>
          item.status ===
          "UPLOADED",
      );

    const connectedAccounts =
      platformAccounts.filter(
        (item) =>
          item.status ===
          "CONNECTED",
      );

    const publishedPublications =
      publications.filter(
        (item) =>
          item.status ===
          "PUBLISHED",
      );

    const scheduledPublications =
      publications.filter(
        (item) =>
          item.status ===
            "SCHEDULED" ||
          Boolean(
            item.scheduledAt,
          ),
      );

    const failedPublications =
      publications.filter(
        (item) =>
          item.status ===
          "FAILED",
      );

    const platformStatus =
      buildPlatformStatus(
        connectedAccounts,
      );

    const publishingActivity =
      buildPublishingActivity(
        publishedPublications,
      );

    const recentActivity =
      buildRecentActivity({
        mediaAssets,
        publications,
      });

    const upcomingPublications =
      publications
        .filter(
          (item) => {
            if (
              !item.scheduledAt
            ) {
              return false;
            }

            if (
              item.status ===
                "PUBLISHED" ||
              item.status ===
                "FAILED"
            ) {
              return false;
            }

            const date =
              new Date(
                item.scheduledAt,
              );

            return (
              !Number.isNaN(
                date.getTime(),
              ) &&
              date.getTime() >
                Date.now()
            );
          },
        )
        .sort(
          (a, b) =>
            new Date(
              a.scheduledAt!,
            ).getTime() -
            new Date(
              b.scheduledAt!,
            ).getTime(),
        )
        .slice(
          0,
          8,
        )
        .map(
          (item) => ({
            id:
              item.id,
            platform:
              item.platform,
            status:
              item.status,
            scheduledAt:
              item.scheduledAt,
            caption:
              item.caption,
          }),
        );

    return NextResponse.json({
      success: true,

      workspace: {
        id:
          workspace.id,
        name:
          workspace.name,
        type:
          workspace.type,
      },

      user: {
        id:
          session.user.id,
        firstName:
          session.user.firstName,
        lastName:
          session.user.lastName,
        locale:
          session.user.locale,
        timezone:
          session.user.timezone,
      },

      summary: {
        mediaUploaded:
          uploadedMedia.length,

        connectedPlatforms:
          connectedAccounts.length,

        published:
          publishedPublications.length,

        scheduled:
          scheduledPublications.length,

        failed:
          failedPublications.length,

        creators:
          creators.filter(
            (creator) =>
              creator.status ===
              "ACTIVE",
          ).length,
      },

      networkStatus:
        platformStatus,

      publishingActivity,

      recentActivity,

      upcomingPublications,

      distribution: {
        totalJobs:
          distributionJobs.length,

        queued:
          distributionJobs.filter(
            (job) =>
              job.status ===
              "QUEUED",
          ).length,

        scheduled:
          distributionJobs.filter(
            (job) =>
              job.status ===
              "SCHEDULED",
          ).length,

        completed:
          distributionJobs.filter(
            (job) =>
              job.status ===
              "COMPLETED",
          ).length,

        failed:
          distributionJobs.filter(
            (job) =>
              job.status ===
              "FAILED",
          ).length,
      },
    });
  } catch (error) {
    console.error(
      "DASHBOARD_API_ERROR",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "DASHBOARD_LOAD_FAILED",
      },
      {
        status: 500,
      },
    );
  }
}

function buildPlatformStatus(
  accounts: Array<{
    id: string;
    platform: string;
    status: string;
    externalUsername:
      | string
      | null;
    externalDisplayName:
      | string
      | null;
  }>,
) {
  const grouped =
    new Map<
      string,
      {
        platform: string;
        status: string;
        accounts: Array<{
          id: string;
          username:
            | string
            | null;
          displayName:
            | string
            | null;
        }>;
      }
    >();

  for (
    const account of
    accounts
  ) {
    const existing =
      grouped.get(
        account.platform,
      );

    if (existing) {
      existing.accounts.push({
        id:
          account.id,
        username:
          account.externalUsername,
        displayName:
          account.externalDisplayName,
      });

      continue;
    }

    grouped.set(
      account.platform,
      {
        platform:
          account.platform,

        status:
          "CONNECTED",

        accounts: [
          {
            id:
              account.id,

            username:
              account.externalUsername,

            displayName:
              account.externalDisplayName,
          },
        ],
      },
    );
  }

  return Array.from(
    grouped.values(),
  ).sort(
    (a, b) =>
      a.platform.localeCompare(
        b.platform,
      ),
  );
}

function buildPublishingActivity(
  publications: Array<{
    publishedAt:
      | string
      | null;
    createdAt: string;
  }>,
): PublishingActivityPoint[] {
  const today =
    new Date();

  const days:
    PublishingActivityPoint[] =
    [];

  for (
    let index = 29;
    index >= 0;
    index -= 1
  ) {
    const date =
      new Date(
        today,
      );

    date.setHours(
      0,
      0,
      0,
      0,
    );

    date.setDate(
      date.getDate() -
        index,
    );

    days.push({
      date:
        getDateKey(
          date,
        ),
      published: 0,
    });
  }

  const map =
    new Map(
      days.map(
        (item) => [
          item.date,
          item,
        ],
      ),
    );

  for (
    const publication of
    publications
  ) {
    const rawDate =
      publication.publishedAt ||
      publication.createdAt;

    const date =
      new Date(
        rawDate,
      );

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      continue;
    }

    const key =
      getDateKey(
        date,
      );

    const item =
      map.get(
        key,
      );

    if (item) {
      item.published +=
        1;
    }
  }

  return days;
}

function buildRecentActivity({
  mediaAssets,
  publications,
}: {
  mediaAssets: Array<{
    id: string;
    originalFileName: string;
    status: string;
    createdAt: string;
    uploadCompletedAt:
      | string
      | null;
  }>;

  publications: Array<{
    id: string;
    platform: string;
    status: string;
    caption:
      | string
      | null;
    scheduledAt:
      | string
      | null;
    publishedAt:
      | string
      | null;
    failedAt:
      | string
      | null;
    createdAt: string;
  }>;
}): ActivityItem[] {
  const activity:
    ActivityItem[] = [];

  for (
    const media of
    mediaAssets
  ) {
    if (
      media.status !==
      "UPLOADED"
    ) {
      continue;
    }

    activity.push({
      id:
        `media-${media.id}`,

      type:
        "MEDIA_UPLOADED",

      title:
        "Media uploaded",

      subtitle:
        media.originalFileName,

      platform:
        null,

      date:
        media.uploadCompletedAt ||
        media.createdAt,
    });
  }

  for (
    const publication of
    publications
  ) {
    if (
      publication.status ===
      "PUBLISHED"
    ) {
      activity.push({
        id:
          `publication-${publication.id}`,

        type:
          "PUBLICATION_PUBLISHED",

        title:
          "Content published",

        subtitle:
          publication.caption,

        platform:
          publication.platform,

        date:
          publication.publishedAt ||
          publication.createdAt,
      });

      continue;
    }

    if (
      publication.status ===
      "FAILED"
    ) {
      activity.push({
        id:
          `publication-${publication.id}`,

        type:
          "PUBLICATION_FAILED",

        title:
          "Publication failed",

        subtitle:
          publication.caption,

        platform:
          publication.platform,

        date:
          publication.failedAt ||
          publication.createdAt,
      });

      continue;
    }

    if (
      publication.scheduledAt
    ) {
      activity.push({
        id:
          `publication-${publication.id}`,

        type:
          "PUBLICATION_SCHEDULED",

        title:
          "Publication scheduled",

        subtitle:
          publication.caption,

        platform:
          publication.platform,

        date:
          publication.createdAt,
      });
    }
  }

  return activity
    .sort(
      (a, b) =>
        new Date(
          b.date,
        ).getTime() -
        new Date(
          a.date,
        ).getTime(),
    )
    .slice(
      0,
      10,
    );
}

function getDateKey(
  date: Date,
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
        1,
    ).padStart(
      2,
      "0",
    );

  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      "0",
    );

  return `${year}-${month}-${day}`;
}