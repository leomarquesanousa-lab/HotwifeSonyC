import {
  NextResponse,
} from "next/server";

import {
  getCurrentSession,
} from "@/src/lib/auth/session";

import {
  db,
} from "@/src/prisma/db";

export async function GET() {
  try {
    const session =
      await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error:
            "UNAUTHORIZED",
        },
        {
          status: 401,
        },
      );
    }

    const workspaceMember =
      await db.orm.public.WorkspaceMember.where({
        userId:
          session.user.id,
      }).first();

    if (!workspaceMember) {
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

    const workspaceId =
      workspaceMember.workspaceId;

    const [
      creators,
      mediaAssets,
      platformAccounts,
      categories,
      mediaCategoryAssignments,
    ] =
      await Promise.all([
        db.orm.public.Creator.where({
          workspaceId,
          status:
            "ACTIVE",
        }).all(),

        db.orm.public.MediaAsset.where({
          workspaceId,
          status:
            "UPLOADED",
        }).all(),

        db.orm.public.PlatformAccount.where({
          workspaceId,
          status:
            "CONNECTED",
        }).all(),

        db.orm.public.MediaCategory.where({
          workspaceId,
        }).all(),

        db.orm.public.MediaAssetCategory.all(),
      ]);

    const categoryById =
      new Map(
        categories.map(
          (category) => [
            category.id,
            {
              id:
                category.id,
              name:
                category.name,
              normalizedName:
                category.normalizedName,
              createdAt:
                category.createdAt,
            },
          ],
        ),
      );

    const mediaIds =
      new Set(
        mediaAssets.map(
          (media) =>
            media.id,
        ),
      );

    const categoriesByMediaId =
      new Map<
        string,
        Array<{
          id: string;
          name: string;
          normalizedName: string;
          createdAt: string;
        }>
      >();

    for (
      const assignment of
      mediaCategoryAssignments
    ) {
      if (
        !mediaIds.has(
          assignment.mediaAssetId,
        )
      ) {
        continue;
      }

      const category =
        categoryById.get(
          assignment.categoryId,
        );

      if (!category) {
        continue;
      }

      const current =
        categoriesByMediaId.get(
          assignment.mediaAssetId,
        ) ?? [];

      current.push(
        category,
      );

      categoriesByMediaId.set(
        assignment.mediaAssetId,
        current,
      );
    }

    for (
      const [
        mediaId,
        assignedCategories,
      ] of categoriesByMediaId
    ) {
      categoriesByMediaId.set(
        mediaId,
        assignedCategories.sort(
          (a, b) =>
            a.name.localeCompare(
              b.name,
              undefined,
              {
                sensitivity:
                  "base",
              },
            ),
        ),
      );
    }

    const sortedMedia =
      [...mediaAssets].sort(
        (a, b) =>
          String(
            b.createdAt,
          ).localeCompare(
            String(
              a.createdAt,
            ),
          ),
      );

    const sortedCategories =
      [...categories].sort(
        (a, b) =>
          a.name.localeCompare(
            b.name,
            undefined,
            {
              sensitivity:
                "base",
            },
          ),
      );

    return NextResponse.json({
      success: true,
      timeZone: session.user.timezone,

      creators:
        creators.map(
          (creator) => ({
            id:
              creator.id,
            displayName:
              creator.displayName,
            status:
              creator.status,
          }),
        ),

      media:
        sortedMedia.map(
          (media) => ({
            id:
              media.id,
            creatorId:
              media.creatorId,
            originalFileName:
              media.originalFileName,
            contentType:
              media.contentType,
            fileSize:
              media.fileSize.toString(),
            mediaType:
              media.mediaType,
            status:
              media.status,
            durationSeconds:
              media.durationSeconds,
            width:
              media.width,
            height:
              media.height,
            thumbnailObjectKey:
              media.thumbnailObjectKey,
            createdAt:
              media.createdAt,
            categories:
              categoriesByMediaId.get(
                media.id,
              ) ?? [],
          }),
        ),

      mediaCategories:
        sortedCategories.map(
          (category) => ({
            id:
              category.id,
            name:
              category.name,
            normalizedName:
              category.normalizedName,
            createdAt:
              category.createdAt,
          }),
        ),

      platformAccounts:
        platformAccounts.map(
          (account) => ({
            id:
              account.id,
            creatorId:
              account.creatorId,
            platform:
              account.platform,
            status:
              account.status,
            externalAccountId:
              account.externalAccountId,
            externalUsername:
              account.externalUsername,
            externalDisplayName:
              account.externalDisplayName,
          }),
        ),
    });
  } catch (error) {
    console.error(
      "DISTRIBUTION_OPTIONS_ERROR",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "INTERNAL_ERROR",
      },
      {
        status: 500,
      },
    );
  }
}
