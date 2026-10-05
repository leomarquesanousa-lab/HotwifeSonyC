import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCurrentSession,
} from "@/src/lib/auth/session";

import {
  db,
} from "@/src/prisma/db";

type CategoryAssignmentRequest = {
  categoryId?: string;
};

async function getWorkspaceId() {
  const session =
    await getCurrentSession();

  if (!session) {
    return {
      error:
        NextResponse.json(
          {
            success: false,
            error:
              "UNAUTHORIZED",
          },
          {
            status: 401,
          },
        ),
    };
  }

  const workspaceMember =
    await db.orm.public.WorkspaceMember.where({
      userId:
        session.user.id,
    }).first();

  if (!workspaceMember) {
    return {
      error:
        NextResponse.json(
          {
            success: false,
            error:
              "WORKSPACE_NOT_FOUND",
          },
          {
            status: 404,
          },
        ),
    };
  }

  return {
    workspaceId:
      workspaceMember.workspaceId,
  };
}

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    const workspaceResult =
      await getWorkspaceId();

    if (
      workspaceResult.error
    ) {
      return workspaceResult.error;
    }

    const {
      id,
    } =
      await context.params;

    const mediaId =
      id?.trim();

    if (!mediaId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_MEDIA_ID",
        },
        {
          status: 400,
        },
      );
    }

    const media =
      await db.orm.public.MediaAsset.where({
        id:
          mediaId,
        workspaceId:
          workspaceResult.workspaceId,
      }).first();

    if (!media) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MEDIA_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    const assignments =
      await db.orm.public.MediaAssetCategory.where({
        mediaAssetId:
          media.id,
      }).all();

    const categories =
      await Promise.all(
        assignments.map(
          async (
            assignment,
          ) => {
            const category =
              await db.orm.public.MediaCategory.where({
                id:
                  assignment.categoryId,
                workspaceId:
                  workspaceResult.workspaceId,
              }).first();

            if (!category) {
              return null;
            }

            return {
              id:
                category.id,
              name:
                category.name,
              normalizedName:
                category.normalizedName,
              createdAt:
                category.createdAt,
            };
          },
        ),
      );

    return NextResponse.json({
      success: true,
      categories:
        categories
          .filter(
            (
              category,
            ): category is NonNullable<
              typeof category
            > =>
              category !==
              null,
          )
          .sort(
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
    });
  } catch (error) {
    console.error(
      "MEDIA_CATEGORY_ASSIGNMENT_LIST_ERROR",
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

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    const workspaceResult =
      await getWorkspaceId();

    if (
      workspaceResult.error
    ) {
      return workspaceResult.error;
    }

    const {
      id,
    } =
      await context.params;

    const mediaId =
      id?.trim();

    const body =
      (await request.json()) as CategoryAssignmentRequest;

    const categoryId =
      body.categoryId?.trim();

    if (
      !mediaId ||
      !categoryId
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_REQUEST",
        },
        {
          status: 400,
        },
      );
    }

    const media =
      await db.orm.public.MediaAsset.where({
        id:
          mediaId,
        workspaceId:
          workspaceResult.workspaceId,
      }).first();

    if (!media) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MEDIA_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    const category =
      await db.orm.public.MediaCategory.where({
        id:
          categoryId,
        workspaceId:
          workspaceResult.workspaceId,
      }).first();

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          error:
            "CATEGORY_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    const existing =
      await db.orm.public.MediaAssetCategory.where({
        mediaAssetId:
          media.id,
        categoryId:
          category.id,
      }).first();

    if (!existing) {
      await db.orm.public.MediaAssetCategory.create({
        mediaAssetId:
          media.id,
        categoryId:
          category.id,
      });
    }

    return NextResponse.json({
      success: true,
      category: {
        id:
          category.id,
        name:
          category.name,
        normalizedName:
          category.normalizedName,
      },
      alreadyAssigned:
        Boolean(
          existing,
        ),
    });
  } catch (error) {
    console.error(
      "MEDIA_CATEGORY_ASSIGNMENT_CREATE_ERROR",
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

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    const workspaceResult =
      await getWorkspaceId();

    if (
      workspaceResult.error
    ) {
      return workspaceResult.error;
    }

    const {
      id,
    } =
      await context.params;

    const mediaId =
      id?.trim();

    const body =
      (await request.json()) as CategoryAssignmentRequest;

    const categoryId =
      body.categoryId?.trim();

    if (
      !mediaId ||
      !categoryId
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_REQUEST",
        },
        {
          status: 400,
        },
      );
    }

    const media =
      await db.orm.public.MediaAsset.where({
        id:
          mediaId,
        workspaceId:
          workspaceResult.workspaceId,
      }).first();

    if (!media) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MEDIA_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    const category =
      await db.orm.public.MediaCategory.where({
        id:
          categoryId,
        workspaceId:
          workspaceResult.workspaceId,
      }).first();

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          error:
            "CATEGORY_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    const existing =
      await db.orm.public.MediaAssetCategory.where({
        mediaAssetId:
          media.id,
        categoryId:
          category.id,
      }).first();

    if (!existing) {
      return NextResponse.json({
        success: true,
        removed:
          false,
      });
    }

    await db.orm.public.MediaAssetCategory.where({
      mediaAssetId:
        media.id,
      categoryId:
        category.id,
    }).delete();

    return NextResponse.json({
      success: true,
      removed:
        true,
    });
  } catch (error) {
    console.error(
      "MEDIA_CATEGORY_ASSIGNMENT_DELETE_ERROR",
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
