import crypto from "node:crypto";

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

type CreateCategoryRequest = {
  name?: string;
};

function normalizeCategoryName(
  value: string,
) {
  return value
    .trim()
    .normalize("NFKD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .replace(/\s+/g, " ");
}

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

    const categories =
      await db.orm.public.MediaCategory.where({
        workspaceId:
          workspaceMember.workspaceId,
      }).all();

    const sorted =
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
      categories:
        sorted.map(
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
    });
  } catch (error) {
    console.error(
      "MEDIA_CATEGORY_LIST_ERROR",
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
) {
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

    const body =
      (await request.json()) as CreateCategoryRequest;

    const name =
      body.name
        ?.trim()
        .replace(
          /\s+/g,
          " ",
        );

    if (
      !name ||
      name.length >
        80
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_CATEGORY_NAME",
          message:
            "Category name must contain between 1 and 80 characters.",
        },
        {
          status: 400,
        },
      );
    }

    const normalizedName =
      normalizeCategoryName(
        name,
      );

    if (!normalizedName) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_CATEGORY_NAME",
        },
        {
          status: 400,
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

    const existing =
      await db.orm.public.MediaCategory.where({
        workspaceId:
          workspaceMember.workspaceId,
        normalizedName,
      }).first();

    if (existing) {
      return NextResponse.json(
        {
          success: true,
          category: {
            id:
              existing.id,
            name:
              existing.name,
            normalizedName:
              existing.normalizedName,
            createdAt:
              existing.createdAt,
          },
          alreadyExists:
            true,
        },
      );
    }

    const category =
      await db.orm.public.MediaCategory.create({
        id:
          crypto.randomUUID(),
        workspaceId:
          workspaceMember.workspaceId,
        name,
        normalizedName,
      });

    return NextResponse.json(
      {
        success: true,
        category: {
          id:
            category.id,
          name:
            category.name,
          normalizedName:
            category.normalizedName,
          createdAt:
            category.createdAt,
        },
        alreadyExists:
          false,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "MEDIA_CATEGORY_CREATE_ERROR",
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
