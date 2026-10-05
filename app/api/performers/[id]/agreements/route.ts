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

type CreateAgreementRequest = {
  agreementType?: string;
  contentDescription?: string;
  agreementDate?: string;
  governingLaw?: string;
  jurisdiction?: string;
  uploaderLegalName?: string;
  uploaderEmail?: string;
  coPerformerLegalName?: string;
  coPerformerEmail?: string;
  residentialAddress?: string;
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

  const trimmed =
    value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(
    0,
    maxLength,
  );
}

function isDateOnly(
  value: string,
) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    value,
  );
}

async function getWorkspaceContext() {
  const session =
    await getCurrentSession();

  if (!session) {
    return null;
  }

  const workspaceMember =
    await db.orm.public.WorkspaceMember.where({
      userId:
        session.user.id,
    }).first();

  if (!workspaceMember) {
    return null;
  }

  return {
    session,
    workspaceMember,
  };
}

function serializeAgreement(
  agreement: {
    id: string;
    templateKey: string;
    templateVersion: string;
    status: string;
    agreementType: string;
    contentDescription: string;
    agreementDate: string;
    governingLaw: string | null;
    jurisdiction: string | null;
    uploaderLegalName: string;
    uploaderEmail: string | null;
    coPerformerLegalName: string;
    coPerformerEmail: string | null;
    residentialAddress: string | null;
    createdAt: string;
    updatedAt: string;
  },
) {
  return {
    id:
      agreement.id,
    templateKey:
      agreement.templateKey,
    templateVersion:
      agreement.templateVersion,
    status:
      agreement.status,
    agreementType:
      agreement.agreementType,
    contentDescription:
      agreement.contentDescription,
    agreementDate:
      agreement.agreementDate,
    governingLaw:
      agreement.governingLaw,
    jurisdiction:
      agreement.jurisdiction,
    uploaderLegalName:
      agreement.uploaderLegalName,
    uploaderEmail:
      agreement.uploaderEmail,
    coPerformerLegalName:
      agreement.coPerformerLegalName,
    coPerformerEmail:
      agreement.coPerformerEmail,
    residentialAddress:
      agreement.residentialAddress,
    createdAt:
      agreement.createdAt,
    updatedAt:
      agreement.updatedAt,
  };
}

export async function GET(
  _request: NextRequest,
  context: {
    params:
      Promise<{
        id: string;
      }>;
  },
) {
  try {
    const auth =
      await getWorkspaceContext();

    if (!auth) {
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

    const {
      id: performerId,
    } =
      await context.params;

    const performer =
      await db.orm.public.Performer.where({
        id:
          performerId,
        workspaceId:
          auth.workspaceMember.workspaceId,
      }).first();

    if (!performer) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PERFORMER_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    const agreements =
      await db.orm.public.Agreement.where({
        performerId,
        workspaceId:
          auth.workspaceMember.workspaceId,
      }).all();

    const sorted =
      [...agreements].sort(
        (a, b) =>
          new Date(
            b.createdAt,
          ).getTime() -
          new Date(
            a.createdAt,
          ).getTime(),
      );

    return NextResponse.json({
      success: true,
      agreements:
        sorted.map(
          serializeAgreement,
        ),
    });
  } catch (error) {
    console.error(
      "PERFORMER_AGREEMENT_LIST_ERROR",
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
    params:
      Promise<{
        id: string;
      }>;
  },
) {
  try {
    const auth =
      await getWorkspaceContext();

    if (!auth) {
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

    const {
      id: performerId,
    } =
      await context.params;

    const performer =
      await db.orm.public.Performer.where({
        id:
          performerId,
        workspaceId:
          auth.workspaceMember.workspaceId,
      }).first();

    if (!performer) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PERFORMER_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    const body =
      (await request.json()) as CreateAgreementRequest;

    const agreementType =
      typeof body.agreementType ===
      "string"
        ? body.agreementType
            .trim()
            .toUpperCase()
        : "";

    if (
      agreementType !==
        "SINGLE_CONTENT" &&
      agreementType !==
        "MULTIPLE_CONTENT"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_AGREEMENT_TYPE",
        },
        {
          status: 400,
        },
      );
    }

    const contentDescription =
      cleanOptionalText(
        body.contentDescription,
        1000,
      );

    const agreementDate =
      typeof body.agreementDate ===
      "string"
        ? body.agreementDate.trim()
        : "";

    const uploaderLegalName =
      cleanOptionalText(
        body.uploaderLegalName,
        160,
      );

    const coPerformerLegalName =
      cleanOptionalText(
        body.coPerformerLegalName,
        160,
      );

    if (
      !contentDescription ||
      !uploaderLegalName ||
      !coPerformerLegalName ||
      !agreementDate ||
      !isDateOnly(
        agreementDate,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_AGREEMENT_DATA",
          message:
            "Agreement type, content, date and both legal names are required.",
        },
        {
          status: 400,
        },
      );
    }

    const governingLaw =
      cleanOptionalText(
        body.governingLaw,
        160,
      );

    const jurisdiction =
      cleanOptionalText(
        body.jurisdiction,
        200,
      );

    const uploaderEmail =
      cleanOptionalText(
        body.uploaderEmail,
        254,
      );

    const coPerformerEmail =
      cleanOptionalText(
        body.coPerformerEmail,
        254,
      );

    const residentialAddress =
      cleanOptionalText(
        body.residentialAddress,
        300,
      );

    const agreement =
      await db.orm.public.Agreement.create({
        workspaceId:
          auth.workspaceMember.workspaceId,
        performerId,
        templateKey:
          "CO_PERFORMER_RELEASE",
        templateVersion:
          "MV_CO_MODEL_V12",
        status:
          "DRAFT",
        agreementType,
        contentDescription,
        agreementDate,
        governingLaw,
        jurisdiction,
        uploaderLegalName,
        uploaderEmail,
        coPerformerLegalName,
        coPerformerEmail,
        residentialAddress,
        consentVersion:
          "1",
        fieldSnapshot: {
          agreementType,
          contentDescription,
          agreementDate,
          governingLaw,
          jurisdiction,
          uploaderLegalName,
          uploaderEmail,
          coPerformerLegalName,
          coPerformerEmail,
          residentialAddress,
        },
      });

    await db.orm.public.AgreementAuditEvent.create({
      workspaceId:
        auth.workspaceMember.workspaceId,
      agreementId:
        agreement.id,
      signerId:
        null,
      eventType:
        "DRAFT_CREATED",
      ipAddress:
        request.headers.get(
          "x-forwarded-for",
        )?.split(",")[0]?.trim() ||
        null,
      userAgent:
        request.headers.get(
          "user-agent",
        ),
      metadata: {
        templateKey:
          "CO_PERFORMER_RELEASE",
        templateVersion:
          "MV_CO_MODEL_V12",
      },
    });

    return NextResponse.json(
      {
        success: true,
        agreement:
          serializeAgreement(
            agreement,
          ),
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "PERFORMER_AGREEMENT_CREATE_ERROR",
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
