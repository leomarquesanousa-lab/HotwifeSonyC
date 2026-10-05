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

type UpdatePerformerRequest = {
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
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value !==
    "string"
  ) {
    return undefined;
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

type WorkspaceLookup =
  | {
      ok: true;
      workspaceId: string;
    }
  | {
      ok: false;
      response: NextResponse;
    };

async function getWorkspaceId(): Promise<WorkspaceLookup> {
  const session =
    await getCurrentSession();

  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
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
      ok: false,
      response: NextResponse.json(
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
    ok: true,
    workspaceId:
      workspaceMember.workspaceId,
  };
}

function serializePerformer(
  performer: {
    id: string;
    displayName: string;
    legalName: string | null;
    email: string | null;
    phone: string | null;
    dateOfBirth: string | null;
    status: string;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  },
) {
  return {
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
    const workspace =
      await getWorkspaceId();

    if (!workspace.ok) {
      return workspace.response;
    }

    const workspaceId =
      workspace.workspaceId;

    const {
      id,
    } =
      await context.params;

    const performerId =
      id?.trim();

    if (!performerId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_PERFORMER_ID",
        },
        {
          status: 400,
        },
      );
    }

    const performer =
      await db.orm.public.Performer.where({
        id:
          performerId,
        workspaceId,
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

    return NextResponse.json({
      success: true,
      performer:
        serializePerformer(
          performer,
        ),
    });
  } catch (error) {
    console.error(
      "PERFORMER_GET_ERROR",
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

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    const workspace =
      await getWorkspaceId();

    if (!workspace.ok) {
      return workspace.response;
    }

    const workspaceId =
      workspace.workspaceId;

    const {
      id,
    } =
      await context.params;

    const performerId =
      id?.trim();

    if (!performerId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_PERFORMER_ID",
        },
        {
          status: 400,
        },
      );
    }

    const existing =
      await db.orm.public.Performer.where({
        id:
          performerId,
        workspaceId,
      }).first();

    if (!existing) {
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

    let body:
      UpdatePerformerRequest;

    try {
      body =
        await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_JSON",
        },
        {
          status: 400,
        },
      );
    }

    const displayName =
      typeof body.displayName ===
      "string"
        ? body.displayName
            .trim()
            .replace(
              /\s+/g,
              " ",
            )
        : "";

    if (
      !displayName ||
      displayName.length >
        120
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_DISPLAY_NAME",
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

    const email =
      cleanOptionalText(
        body.email,
        254,
      );

    const phone =
      cleanOptionalText(
        body.phone,
        40,
      );

    const notes =
      cleanOptionalText(
        body.notes,
        4000,
      );

    if (
      legalName === undefined ||
      email === undefined ||
      phone === undefined ||
      notes === undefined
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_FIELD_LENGTH",
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
        },
        {
          status: 400,
        },
      );
    }

    let dateOfBirth:
      string | null =
      null;

    if (
      body.dateOfBirth !==
        undefined &&
      body.dateOfBirth !==
        null
    ) {
      if (
        typeof body.dateOfBirth !==
        "string"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "INVALID_DATE_OF_BIRTH",
          },
          {
            status: 400,
          },
        );
      }

      const cleanedDate =
        body.dateOfBirth.trim();

      if (cleanedDate) {
        if (
          !isValidDateOfBirth(
            cleanedDate,
          )
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "INVALID_DATE_OF_BIRTH",
            },
            {
              status: 400,
            },
          );
        }

        dateOfBirth =
          cleanedDate;
      }
    }

    const status =
      typeof body.status ===
      "string"
        ? body.status
            .trim()
            .toUpperCase()
        : "ACTIVE";

    if (
      status !== "ACTIVE" &&
      status !== "INACTIVE"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_STATUS",
        },
        {
          status: 400,
        },
      );
    }

    await db.orm.public.Performer
      .where({
        id:
          performerId,
        workspaceId,
      })
      .update({
        displayName,
        legalName,
        email:
          normalizedEmail,
        phone,
        dateOfBirth,
        status,
        notes,
      });

    const updated =
      await db.orm.public.Performer.where({
        id:
          performerId,
        workspaceId,
      }).first();

    if (!updated) {
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

    return NextResponse.json({
      success: true,
      performer:
        serializePerformer(
          updated,
        ),
    });
  } catch (error) {
    console.error(
      "PERFORMER_UPDATE_ERROR",
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
  _request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    const workspace =
      await getWorkspaceId();

    if (!workspace.ok) {
      return workspace.response;
    }

    const workspaceId =
      workspace.workspaceId;

    const {
      id,
    } =
      await context.params;

    const performerId =
      id?.trim();

    if (!performerId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_PERFORMER_ID",
        },
        {
          status: 400,
        },
      );
    }

    const performer =
      await db.orm.public.Performer.where({
        id:
          performerId,
        workspaceId,
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

    const [
      documents,
      agreements,
      mediaAssignments,
      folders,
    ] =
      await Promise.all([
        db.orm.public.PerformerDocument.where({
          workspaceId,
          performerId,
        }).all(),

        db.orm.public.Agreement.where({
          workspaceId,
          performerId,
        }).all(),

        db.orm.public.MediaAssetPerformer.where({
          workspaceId,
          performerId,
        }).all(),

        db.orm.public.PerformerLibraryFolder.where({
          workspaceId,
          performerId,
        }).all(),
      ]);

    const folderIds =
      new Set(
        folders.map(
          (folder) =>
            folder.id,
        ),
      );

    let mediaInFoldersCount =
      0;

    if (
      folderIds.size >
      0
    ) {
      const workspaceMedia =
        await db.orm.public.MediaAsset.where({
          workspaceId,
        }).all();

      mediaInFoldersCount =
        workspaceMedia.filter(
          (media) =>
            Boolean(
              media.folderId &&
                folderIds.has(
                  media.folderId,
                ),
            ),
        ).length;
    }

    const relatedData = {
      documents:
        documents.length,
      agreements:
        agreements.length,
      mediaAssignments:
        mediaAssignments.length,
      mediaInFolders:
        mediaInFoldersCount,
    };

    /*
     * Old-library media can still be linked through
     * MediaAssetPerformer even though the asset has no
     * performer library folder. Those legacy links are
     * safe to remove without deleting the MediaAsset or
     * the R2 object itself.
     *
     * New-library media is protected: if an asset points
     * to one of this performer's folders, deletion remains
     * blocked so we do not orphan current media content.
     */
    /*
     * This DELETE is a real performer deletion.
     *
     * Preserve storage objects in R2 for now, but remove
     * the database records that require the performer to
     * exist. Agreement children must be removed first
     * because of their foreign-key relationships.
     */
    for (
      const agreement of
      agreements
    ) {
      const auditEvents =
        await db.orm.public.AgreementAuditEvent.where({
          workspaceId,
          agreementId:
            agreement.id,
        }).all();

      for (
        const event of
        auditEvents
      ) {
        await db.orm.public.AgreementAuditEvent
          .where({
            id:
              event.id,
            workspaceId,
          })
          .delete();
      }

      const signers =
        await db.orm.public.AgreementSigner.where({
          workspaceId,
          agreementId:
            agreement.id,
        }).all();

      for (
        const signer of
        signers
      ) {
        await db.orm.public.AgreementSigner
          .where({
            id:
              signer.id,
            workspaceId,
          })
          .delete();
      }

      await db.orm.public.Agreement
        .where({
          id:
            agreement.id,
          workspaceId,
          performerId,
        })
        .delete();
    }

    for (
      const document of
      documents
    ) {
      await db.orm.public.PerformerDocument
        .where({
          id:
            document.id,
          workspaceId,
          performerId,
        })
        .delete();
    }

    /*
     * Preserve every MediaAsset and every R2 object.
     *
     * If an asset is currently inside one of this
     * performer's folders, detach it from that folder
     * before the folder tree is removed.
     */
    if (
      folderIds.size >
      0
    ) {
      const workspaceMedia =
        await db.orm.public.MediaAsset.where({
          workspaceId,
        }).all();

      for (
        const media of
        workspaceMedia
      ) {
        if (
          media.folderId &&
          folderIds.has(
            media.folderId,
          )
        ) {
          await db.orm.public.MediaAsset
            .where({
              id:
                media.id,
              workspaceId,
            })
            .update({
              folderId:
                null,
            });
        }
      }
    }

    /*
     * Remove performer/media relationships.
     * The media records and R2 files themselves stay.
     */
    for (
      const assignment of
      mediaAssignments
    ) {
      await db.orm.public.MediaAssetPerformer
        .where({
          workspaceId,
          performerId,
          mediaAssetId:
            assignment.mediaAssetId,
        })
        .delete();
    }

    /*
     * Empty performer library folders are generated
     * automatically and are safe to remove with the
     * performer. Delete deepest children first because
     * parentId is a self-referencing foreign key.
     */
    if (
      folders.length >
      0
    ) {
      const byId =
        new Map(
          folders.map(
            (folder) => [
              folder.id,
              folder,
            ],
          ),
        );

      const depthOf = (
        folderId: string,
      ) => {
        let depth = 0;
        let current =
          byId.get(
            folderId,
          );
        const visited =
          new Set<string>();

        while (
          current?.parentId &&
          !visited.has(
            current.id,
          )
        ) {
          visited.add(
            current.id,
          );
          depth += 1;
          current =
            byId.get(
              current.parentId,
            );
        }

        return depth;
      };

      const deepestFirst =
        [...folders].sort(
          (
            left,
            right,
          ) =>
            depthOf(
              right.id,
            ) -
            depthOf(
              left.id,
            ),
        );

      for (
        const folder of
        deepestFirst
      ) {
        await db.orm.public.PerformerLibraryFolder
          .where({
            id:
              folder.id,
            workspaceId,
            performerId,
          })
          .delete();
      }
    }

    await db.orm.public.Performer
      .where({
        id:
          performerId,
        workspaceId,
      })
      .delete();

    return NextResponse.json({
      success: true,
      deletedPerformer: {
        id:
          performer.id,
        displayName:
          performer.displayName,
      },
    });
  } catch (error) {
    console.error(
      "PERFORMER_DELETE_ERROR",
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
