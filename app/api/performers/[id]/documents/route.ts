import crypto from "node:crypto";
import path from "node:path";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCurrentSession,
} from "@/src/lib/auth/session";

import {
  getR2BucketName,
  uploadBufferToR2,
} from "@/src/lib/storage/r2";

import {
  db,
} from "@/src/prisma/db";

const MAX_FILE_SIZE =
  5 * 1024 * 1024;

const ALLOWED_MIME_TYPES =
  new Set([
    "application/pdf",
    "text/plain",
    "image/jpeg",
    "image/png",
  ]);

const ALLOWED_DOCUMENT_TYPES =
  new Set([
    "PHOTO_ID",
    "PROOF_OF_ADDRESS",
    "RELEASE_FORM",
    "TEST_RESULT",
    "OTHER",
  ]);

function cleanText(
  value: FormDataEntryValue | null,
  maxLength: number,
) {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value
    .trim()
    .slice(
      0,
      maxLength,
    );
}

function sanitizeFileName(
  value: string,
) {
  const extension =
    path
      .extname(
        value,
      )
      .toLowerCase()
      .slice(
        0,
        12,
      );

  const base =
    path
      .basename(
        value,
        extension,
      )
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        "-",
      )
      .replace(
        /-+/g,
        "-",
      )
      .replace(
        /^[-.]+|[-.]+$/g,
        "",
      )
      .slice(
        0,
        90,
      ) ||
    "document";

  return {
    base,
    extension,
  };
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

    const documents =
      await db.orm.public.PerformerDocument.where({
        performerId,
        workspaceId:
          auth.workspaceMember.workspaceId,
      }).all();

    const sorted =
      [...documents].sort(
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
      documents:
        sorted.map(
          (document) => ({
            id:
              document.id,
            documentType:
              document.documentType,
            title:
              document.title,
            status:
              document.status,
            contentType:
              document.contentType,
            fileSize:
              Number(
                document.fileSize,
              ),
            documentNumber:
              document.documentNumber,
            issuedAt:
              document.issuedAt,
            expiresAt:
              document.expiresAt,
            notes:
              document.notes,
            createdAt:
              document.createdAt,
            updatedAt:
              document.updatedAt,
          }),
        ),
    });
  } catch (error) {
    console.error(
      "PERFORMER_DOCUMENT_LIST_ERROR",
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

    const formData =
      await request.formData();

    const file =
      formData.get(
        "file",
      );

    if (
      !(file instanceof File)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "FILE_REQUIRED",
          message:
            "Select a document to upload.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      file.size <=
        0 ||
      file.size >
        MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_FILE_SIZE",
          message:
            "Document must be between 1 byte and 5 MB.",
        },
        {
          status: 400,
        },
      );
    }

    const contentType =
      file.type
        .trim()
        .toLowerCase();

    if (
      !ALLOWED_MIME_TYPES.has(
        contentType,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_FILE_TYPE",
          message:
            "Use PDF, TXT, JPG or PNG.",
        },
        {
          status: 400,
        },
      );
    }

    const documentType =
      cleanText(
        formData.get(
          "documentType",
        ),
        40,
      ).toUpperCase();

    if (
      !ALLOWED_DOCUMENT_TYPES.has(
        documentType,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_DOCUMENT_TYPE",
        },
        {
          status: 400,
        },
      );
    }

    const title =
      cleanText(
        formData.get(
          "title",
        ),
        160,
      ) ||
      file.name;

    const documentNumber =
      cleanText(
        formData.get(
          "documentNumber",
        ),
        120,
      ) ||
      null;

    const issuedAt =
      cleanText(
        formData.get(
          "issuedAt",
        ),
        30,
      ) ||
      null;

    const expiresAt =
      cleanText(
        formData.get(
          "expiresAt",
        ),
        30,
      ) ||
      null;

    const notes =
      cleanText(
        formData.get(
          "notes",
        ),
        2000,
      ) ||
      null;

    const {
      base,
      extension,
    } =
      sanitizeFileName(
        file.name,
      );

    const documentId =
      crypto.randomUUID();

    const objectKey =
      [
        "workspace",
        auth.workspaceMember.workspaceId,
        "performers",
        performerId,
        "documents",
        `${documentId}-${base}${extension}`,
      ].join(
        "/",
      );

    const buffer =
      Buffer.from(
        await file.arrayBuffer(),
      );

    await uploadBufferToR2({
      objectKey,
      buffer,
      contentType,
    });

    const document =
      await db.orm.public.PerformerDocument.create({
        id:
          documentId,
        workspaceId:
          auth.workspaceMember.workspaceId,
        performerId,
        documentType,
        title,
        status:
          "ACTIVE",
        objectKey,
        bucketName:
          getR2BucketName(),
        storageProvider:
          "R2",
        contentType,
        fileSize:
          BigInt(
            file.size,
          ),
        documentNumber,
        issuedAt,
        expiresAt,
        notes,
      });

    return NextResponse.json(
      {
        success: true,
        document: {
          id:
            document.id,
          documentType:
            document.documentType,
          title:
            document.title,
          status:
            document.status,
          contentType:
            document.contentType,
          fileSize:
            Number(
              document.fileSize,
            ),
          documentNumber:
            document.documentNumber,
          issuedAt:
            document.issuedAt,
          expiresAt:
            document.expiresAt,
          notes:
            document.notes,
          createdAt:
            document.createdAt,
          updatedAt:
            document.updatedAt,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "PERFORMER_DOCUMENT_UPLOAD_ERROR",
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
