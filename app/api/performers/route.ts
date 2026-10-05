import crypto from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCurrentSession,
} from "@/src/lib/auth/session";

import {
  createDefaultPerformerLibrary,
} from "@/src/lib/performers/library";

import {
  db,
} from "@/src/prisma/db";

type CreatePerformerRequest = {
  displayName?: string;
  legalName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  status?: string;
  notes?: string;
};

function cleanOptionalText(
  value: unknown,
  maxLength: number,
) {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  const cleaned =
    value
      .trim()
      .replace(
        /\s+/g,
        " ",
      );

  if (!cleaned) {
    return null;
  }

  if (
    cleaned.length >
    maxLength
  ) {
    return undefined;
  }

  return cleaned;
}

function isValidEmail(
  value: string,
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function isValidDateOfBirth(
  value: string,
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    return false;
  }

  const parsed =
    new Date(
      `${value}T00:00:00.000Z`,
    );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return false;
  }

  return (
    parsed
      .toISOString()
      .slice(
        0,
        10,
      ) === value
  );
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
      await db.orm.public.WorkspaceMember
        .where({
          userId:
            session.user.id,
        })
        .first();

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

    const performers =
      await db.orm.public.Performer
        .where({
          workspaceId:
            workspaceMember.workspaceId,
        })
        .all();

    const sorted =
      [...performers].sort(
        (
          a,
          b,
        ) =>
          a.displayName.localeCompare(
            b.displayName,
            undefined,
            {
              sensitivity:
                "base",
            },
          ),
      );

    return NextResponse.json({
      success: true,

      performers:
        sorted.map(
          (
            performer,
          ) => ({
            id:
              performer.id,

            displayName:
              performer.displayName,

            legalName:
              performer.legalName,

            email:
              performer.email,

            phone:
              performer.phone,

            dateOfBirth:
              performer.dateOfBirth,

            status:
              performer.status,

            notes:
              performer.notes,

            createdAt:
              performer.createdAt,

            updatedAt:
              performer.updatedAt,
          }),
        ),
    });
  } catch (error) {
    console.error(
      "PERFORMER_LIST_ERROR",
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
      (
        await request.json()
      ) as CreatePerformerRequest;

    const displayName =
      cleanOptionalText(
        body.displayName,
        120,
      );

    if (
      !displayName ||
      displayName ===
        undefined
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_DISPLAY_NAME",
          message:
            "Display name must contain between 1 and 120 characters.",
        },
        {
          status: 400,
        },
      );
    }

    const legalName =
      cleanOptionalText(
        body.legalName,
        160,
      );

    if (
      legalName ===
      undefined
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_LEGAL_NAME",
          message:
            "Legal name must contain at most 160 characters.",
        },
        {
          status: 400,
        },
      );
    }

    const email =
      cleanOptionalText(
        body.email,
        254,
      );

    if (
      email ===
      undefined
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_EMAIL",
          message:
            "Email must contain at most 254 characters.",
        },
        {
          status: 400,
        },
      );
    }

    const normalizedEmail =
      email
        ? email.toLowerCase()
        : null;

    if (
      normalizedEmail &&
      !isValidEmail(
        normalizedEmail,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_EMAIL",
          message:
            "Enter a valid email address.",
        },
        {
          status: 400,
        },
      );
    }

    const phone =
      cleanOptionalText(
        body.phone,
        40,
      );

    if (
      phone ===
      undefined
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_PHONE",
          message:
            "Phone must contain at most 40 characters.",
        },
        {
          status: 400,
        },
      );
    }

    const notes =
      typeof body.notes ===
      "string"
        ? body.notes.trim()
        : null;

    if (
      notes &&
      notes.length >
        4000
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_NOTES",
          message:
            "Notes must contain at most 4000 characters.",
        },
        {
          status: 400,
        },
      );
    }

    const dateOfBirth =
      typeof body.dateOfBirth ===
      "string"
        ? body.dateOfBirth.trim()
        : "";

    if (
      dateOfBirth &&
      !isValidDateOfBirth(
        dateOfBirth,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_DATE_OF_BIRTH",
          message:
            "Date of birth must use YYYY-MM-DD.",
        },
        {
          status: 400,
        },
      );
    }

    const status =
      typeof body.status ===
      "string"
        ? body.status
            .trim()
            .toUpperCase()
        : "ACTIVE";

    if (
      ![
        "ACTIVE",
        "INACTIVE",
      ].includes(
        status,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_STATUS",
          message:
            "Status must be ACTIVE or INACTIVE.",
        },
        {
          status: 400,
        },
      );
    }

    const workspaceMember =
      await db.orm.public.WorkspaceMember
        .where({
          userId:
            session.user.id,
        })
        .first();

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

    const performer =
      await db.orm.public.Performer
        .create({
          id:
            crypto.randomUUID(),

          workspaceId:
            workspaceMember.workspaceId,

          displayName,

          legalName,

          email:
            normalizedEmail,

          phone,

          dateOfBirth:
            dateOfBirth || null,

          status,

          notes:
            notes || null,
        });

    await createDefaultPerformerLibrary({
      workspaceId:
        workspaceMember.workspaceId,

      performerId:
        performer.id,
    });

    return NextResponse.json(
      {
        success: true,

        performer: {
          id:
            performer.id,

          displayName:
            performer.displayName,

          legalName:
            performer.legalName,

          email:
            performer.email,

          phone:
            performer.phone,

          dateOfBirth:
            performer.dateOfBirth,

          status:
            performer.status,

          notes:
            performer.notes,

          createdAt:
            performer.createdAt,

          updatedAt:
            performer.updatedAt,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "PERFORMER_CREATE_ERROR",
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