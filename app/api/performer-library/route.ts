import {
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCurrentSession,
} from "@/src/lib/auth/session";

import {
  getR2Client,
} from "@/src/lib/storage/r2";

import {
  db,
} from "@/src/prisma/db";

type FolderAction =
  | "RENAME"
  | "MOVE";

type DeleteMode =
  | "EMPTY"
  | "MOVE"
  | "DELETE_ALL";

function cleanFolderName(
  value: unknown,
) {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value
    .trim()
    .replace(
      /\s+/g,
      " ",
    );
}

function normalizeFolderName(
  value: string,
) {
  return value
    .normalize(
      "NFKD",
    )
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .trim()
    .replace(
      /\s+/g,
      " ",
    )
    .toLowerCase();
}

function isProtectedStructuralRoot(
  folder: {
    parentId: string | null;
    systemKey: string | null;
  },
) {
  return (
    folder.parentId ===
      null &&
    (
      folder.systemKey ===
        "SAFE" ||
      folder.systemKey ===
        "UNSAFE"
    )
  );
}

async function getWorkspaceMember() {
  const session =
    await getCurrentSession();

  if (!session) {
    return {
      response:
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
      workspaceMember:
        null,
    };
  }

  const workspaceMember =
    await db.orm.public.WorkspaceMember
      .where({
        userId:
          session.user.id,
      })
      .first();

  if (!workspaceMember) {
    return {
      response:
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
      workspaceMember:
        null,
    };
  }

  return {
    response: null,
    workspaceMember,
  };
}

async function getPerformer(
  workspaceId: string,
  performerId: string,
) {
  return db.orm.public.Performer
    .where({
      id:
        performerId,
      workspaceId,
    })
    .first();
}

async function getFolder(
  workspaceId: string,
  performerId: string,
  folderId: string,
) {
  return db.orm.public.PerformerLibraryFolder
    .where({
      id:
        folderId,
      workspaceId,
      performerId,
    })
    .first();
}

async function getAllFolders(
  workspaceId: string,
  performerId: string,
) {
  return db.orm.public.PerformerLibraryFolder
    .where({
      workspaceId,
      performerId,
    })
    .all();
}

function collectSubtreeIds(
  folders: Array<{
    id: string;
    parentId: string | null;
  }>,
  rootFolderId: string,
) {
  const result =
    new Set<string>([
      rootFolderId,
    ]);

  let changed =
    true;

  while (changed) {
    changed =
      false;

    for (
      const folder of
      folders
    ) {
      if (
        folder.parentId &&
        result.has(
          folder.parentId,
        ) &&
        !result.has(
          folder.id,
        )
      ) {
        result.add(
          folder.id,
        );

        changed =
          true;
      }
    }
  }

  return result;
}

function folderDepth(
  foldersById: Map<
    string,
    {
      id: string;
      parentId: string | null;
    }
  >,
  folderId: string,
) {
  let depth =
    0;

  let current =
    foldersById.get(
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

    depth +=
      1;

    current =
      foldersById.get(
        current.parentId,
      );
  }

  return depth;
}

export async function GET(
  request: NextRequest,
) {
  try {
    const {
      response,
      workspaceMember,
    } =
      await getWorkspaceMember();

    if (
      response ||
      !workspaceMember
    ) {
      return response;
    }

    const performerId =
      request.nextUrl.searchParams.get(
        "performerId",
      );

    if (!performerId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PERFORMER_ID_REQUIRED",
        },
        {
          status: 400,
        },
      );
    }

    const performer =
      await getPerformer(
        workspaceMember.workspaceId,
        performerId,
      );

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

    const folders =
      await getAllFolders(
        workspaceMember.workspaceId,
        performer.id,
      );

    const sortedFolders =
      [...folders].sort(
        (
          a,
          b,
        ) => {
          if (
            a.parentId ===
              null &&
            b.parentId !==
              null
          ) {
            return -1;
          }

          if (
            a.parentId !==
              null &&
            b.parentId ===
              null
          ) {
            return 1;
          }

          if (
            a.parentId ===
            b.parentId
          ) {
            return (
              a.sortOrder -
              b.sortOrder
            );
          }

          return String(
            a.parentId,
          ).localeCompare(
            String(
              b.parentId,
            ),
          );
        },
      );

    return NextResponse.json({
      success: true,

      performer: {
        id:
          performer.id,
        displayName:
          performer.displayName,
      },

      folders:
        sortedFolders.map(
          (
            folder,
          ) => ({
            id:
              folder.id,

            parentId:
              folder.parentId,

            name:
              folder.name,

            normalizedName:
              folder.normalizedName,

            folderType:
              folder.folderType,

            systemKey:
              folder.systemKey,

            isSystem:
              folder.isSystem,

            isRequired:
              folder.isRequired,

            sortOrder:
              folder.sortOrder,

            status:
              folder.status,
          }),
        ),
    });
  } catch (error) {
    console.error(
      "PERFORMER_LIBRARY_LOAD_ERROR",
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
    const {
      response,
      workspaceMember,
    } =
      await getWorkspaceMember();

    if (
      response ||
      !workspaceMember
    ) {
      return response;
    }

    const body =
      (await request.json()) as {
        performerId?: string;
        parentId?: string;
        name?: string;
      };

    const performerId =
      body.performerId?.trim() ||
      "";

    const parentId =
      body.parentId?.trim() ||
      "";

    const name =
      cleanFolderName(
        body.name,
      );

    if (
      !performerId ||
      !parentId ||
      !name
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "FOLDER_DATA_REQUIRED",
          message:
            "Performer, parent folder and folder name are required.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      name.length >
      120
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "FOLDER_NAME_TOO_LONG",
          message:
            "Folder name must be 120 characters or fewer.",
        },
        {
          status: 400,
        },
      );
    }

    const performer =
      await getPerformer(
        workspaceMember.workspaceId,
        performerId,
      );

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

    const parent =
      await getFolder(
        workspaceMember.workspaceId,
        performer.id,
        parentId,
      );

    if (
      !parent ||
      parent.status !==
        "ACTIVE"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PARENT_FOLDER_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    const normalizedName =
      normalizeFolderName(
        name,
      );

    const duplicate =
      await db.orm.public.PerformerLibraryFolder
        .where({
          workspaceId:
            workspaceMember.workspaceId,
          performerId:
            performer.id,
          parentId:
            parent.id,
          normalizedName,
        })
        .first();

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          error:
            "FOLDER_ALREADY_EXISTS",
          message:
            "A folder with this name already exists in this location.",
        },
        {
          status: 409,
        },
      );
    }

    const siblings =
      await db.orm.public.PerformerLibraryFolder
        .where({
          workspaceId:
            workspaceMember.workspaceId,
          performerId:
            performer.id,
          parentId:
            parent.id,
        })
        .all();

    const nextSortOrder =
      siblings.reduce(
        (
          highest,
          folder,
        ) =>
          Math.max(
            highest,
            folder.sortOrder,
          ),
        0,
      ) +
      10;

    const folder =
      await db.orm.public.PerformerLibraryFolder
        .create({
          workspaceId:
            workspaceMember.workspaceId,
          performerId:
            performer.id,
          parentId:
            parent.id,
          name,
          normalizedName,
          folderType:
            "CUSTOM",
          systemKey:
            null,
          isSystem:
            false,
          isRequired:
            false,
          sortOrder:
            nextSortOrder,
          status:
            "ACTIVE",
        });

    return NextResponse.json(
      {
        success: true,
        folder: {
          id:
            folder.id,
          parentId:
            folder.parentId,
          name:
            folder.name,
          normalizedName:
            folder.normalizedName,
          folderType:
            folder.folderType,
          systemKey:
            folder.systemKey,
          isSystem:
            folder.isSystem,
          isRequired:
            folder.isRequired,
          sortOrder:
            folder.sortOrder,
          status:
            folder.status,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "PERFORMER_LIBRARY_CREATE_ERROR",
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
) {
  try {
    const {
      response,
      workspaceMember,
    } =
      await getWorkspaceMember();

    if (
      response ||
      !workspaceMember
    ) {
      return response;
    }

    const body =
      (await request.json()) as {
        performerId?: string;
        folderId?: string;
        action?: FolderAction;
        name?: string;
        parentId?: string;
      };

    const performerId =
      body.performerId?.trim() ||
      "";

    const folderId =
      body.folderId?.trim() ||
      "";

    const action =
      body.action;

    if (
      !performerId ||
      !folderId ||
      !action
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "FOLDER_ACTION_REQUIRED",
        },
        {
          status: 400,
        },
      );
    }

    const performer =
      await getPerformer(
        workspaceMember.workspaceId,
        performerId,
      );

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

    const folder =
      await getFolder(
        workspaceMember.workspaceId,
        performer.id,
        folderId,
      );

    if (!folder) {
      return NextResponse.json(
        {
          success: false,
          error:
            "FOLDER_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    if (
      isProtectedStructuralRoot(
        folder,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "STRUCTURAL_FOLDER_PROTECTED",
          message:
            "SAFE FOR WORK and NOT SAFE FOR WORK cannot be renamed, moved or deleted.",
        },
        {
          status: 409,
        },
      );
    }

    if (
      action ===
      "RENAME"
    ) {
      const name =
        cleanFolderName(
          body.name,
        );

      if (!name) {
        return NextResponse.json(
          {
            success: false,
            error:
              "FOLDER_NAME_REQUIRED",
          },
          {
            status: 400,
          },
        );
      }

      if (
        name.length >
        120
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "FOLDER_NAME_TOO_LONG",
          },
          {
            status: 400,
          },
        );
      }

      const normalizedName =
        normalizeFolderName(
          name,
        );

      const duplicate =
        await db.orm.public.PerformerLibraryFolder
          .where({
            workspaceId:
              workspaceMember.workspaceId,
            performerId:
              performer.id,
            parentId:
              folder.parentId,
            normalizedName,
          })
          .first();

      if (
        duplicate &&
        duplicate.id !==
          folder.id
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "FOLDER_ALREADY_EXISTS",
            message:
              "A folder with this name already exists in this location.",
          },
          {
            status: 409,
          },
        );
      }

      await db.orm.public.PerformerLibraryFolder
        .where({
          id:
            folder.id,
          workspaceId:
            workspaceMember.workspaceId,
          performerId:
            performer.id,
        })
        .update({
          name,
          normalizedName,
        });

      return NextResponse.json({
        success: true,
        folderId:
          folder.id,
        name,
        message:
          "Folder renamed. Files were not changed or moved.",
      });
    }

    if (
      action ===
      "MOVE"
    ) {
      const parentId =
        body.parentId?.trim() ||
        "";

      if (!parentId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "DESTINATION_FOLDER_REQUIRED",
          },
          {
            status: 400,
          },
        );
      }

      if (
        parentId ===
        folder.id
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "INVALID_FOLDER_DESTINATION",
            message:
              "A folder cannot be moved inside itself.",
          },
          {
            status: 409,
          },
        );
      }

      const destination =
        await getFolder(
          workspaceMember.workspaceId,
          performer.id,
          parentId,
        );

      if (
        !destination ||
        destination.status !==
          "ACTIVE"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "DESTINATION_FOLDER_NOT_FOUND",
          },
          {
            status: 404,
          },
        );
      }

      const folders =
        await getAllFolders(
          workspaceMember.workspaceId,
          performer.id,
        );

      const subtreeIds =
        collectSubtreeIds(
          folders,
          folder.id,
        );

      if (
        subtreeIds.has(
          destination.id,
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "INVALID_FOLDER_DESTINATION",
            message:
              "A folder cannot be moved inside one of its own subfolders.",
          },
          {
            status: 409,
          },
        );
      }

      const duplicate =
        await db.orm.public.PerformerLibraryFolder
          .where({
            workspaceId:
              workspaceMember.workspaceId,
            performerId:
              performer.id,
            parentId:
              destination.id,
            normalizedName:
              folder.normalizedName,
          })
          .first();

      if (
        duplicate &&
        duplicate.id !==
          folder.id
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "FOLDER_ALREADY_EXISTS",
            message:
              "A folder with this name already exists in the destination.",
          },
          {
            status: 409,
          },
        );
      }

      await db.orm.public.PerformerLibraryFolder
        .where({
          id:
            folder.id,
          workspaceId:
            workspaceMember.workspaceId,
          performerId:
            performer.id,
        })
        .update({
          parentId:
            destination.id,
        });

      return NextResponse.json({
        success: true,
        folderId:
          folder.id,
        parentId:
          destination.id,
        message:
          "Folder moved. Files and subfolders remain attached to the same folder.",
      });
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "UNSUPPORTED_FOLDER_ACTION",
      },
      {
        status: 400,
      },
    );
  } catch (error) {
    console.error(
      "PERFORMER_LIBRARY_UPDATE_ERROR",
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
) {
  try {
    const {
      response,
      workspaceMember,
    } =
      await getWorkspaceMember();

    if (
      response ||
      !workspaceMember
    ) {
      return response;
    }

    const body =
      (await request.json()) as {
        performerId?: string;
        folderId?: string;
        mode?: DeleteMode;
        destinationFolderId?: string;
        confirmation?: string;
      };

    const performerId =
      body.performerId?.trim() ||
      "";

    const folderId =
      body.folderId?.trim() ||
      "";

    const mode =
      body.mode;

    if (
      !performerId ||
      !folderId ||
      !mode
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "DELETE_FOLDER_DATA_REQUIRED",
        },
        {
          status: 400,
        },
      );
    }

    const performer =
      await getPerformer(
        workspaceMember.workspaceId,
        performerId,
      );

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

    const folder =
      await getFolder(
        workspaceMember.workspaceId,
        performer.id,
        folderId,
      );

    if (!folder) {
      return NextResponse.json(
        {
          success: false,
          error:
            "FOLDER_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    if (
      isProtectedStructuralRoot(
        folder,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "STRUCTURAL_FOLDER_PROTECTED",
          message:
            "SAFE FOR WORK and NOT SAFE FOR WORK cannot be deleted.",
        },
        {
          status: 409,
        },
      );
    }

    const folders =
      await getAllFolders(
        workspaceMember.workspaceId,
        performer.id,
      );

    const subtreeIds =
      collectSubtreeIds(
        folders,
        folder.id,
      );

    const workspaceMedia =
      await db.orm.public.MediaAsset
        .where({
          workspaceId:
            workspaceMember.workspaceId,
        })
        .all();

    const subtreeMedia =
      workspaceMedia.filter(
        (
          media,
        ) =>
          Boolean(
            media.folderId &&
            subtreeIds.has(
              media.folderId,
            ),
          ),
      );

    const childFolders =
      folders.filter(
        (
          candidate,
        ) =>
          candidate.id !==
            folder.id &&
          subtreeIds.has(
            candidate.id,
          ),
      );

    if (
      mode ===
      "EMPTY"
    ) {
      if (
        subtreeMedia.length >
          0 ||
        childFolders.length >
          0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "FOLDER_NOT_EMPTY",
            message:
              "This folder contains files or subfolders. Choose Move content or Delete all.",
            counts: {
              files:
                subtreeMedia.length,
              subfolders:
                childFolders.length,
            },
          },
          {
            status: 409,
          },
        );
      }

      await db.orm.public.PerformerLibraryFolder
        .where({
          id:
            folder.id,
          workspaceId:
            workspaceMember.workspaceId,
          performerId:
            performer.id,
        })
        .delete();

      return NextResponse.json({
        success: true,
        deletedFolderId:
          folder.id,
        counts: {
          files: 0,
          subfolders: 0,
        },
      });
    }

    if (
      mode ===
      "MOVE"
    ) {
      const destinationFolderId =
        body.destinationFolderId?.trim() ||
        "";

      if (!destinationFolderId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "DESTINATION_FOLDER_REQUIRED",
          },
          {
            status: 400,
          },
        );
      }

      const destination =
        await getFolder(
          workspaceMember.workspaceId,
          performer.id,
          destinationFolderId,
        );

      if (
        !destination ||
        destination.status !==
          "ACTIVE"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "DESTINATION_FOLDER_NOT_FOUND",
          },
          {
            status: 404,
          },
        );
      }

      if (
        subtreeIds.has(
          destination.id,
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "INVALID_FOLDER_DESTINATION",
            message:
              "Choose a destination outside the folder being deleted.",
          },
          {
            status: 409,
          },
        );
      }

      const directChildren =
        folders.filter(
          (
            candidate,
          ) =>
            candidate.parentId ===
            folder.id,
        );

      for (
        const child of
        directChildren
      ) {
        const conflictingFolder =
          await db.orm.public.PerformerLibraryFolder
            .where({
              workspaceId:
                workspaceMember.workspaceId,
              performerId:
                performer.id,
              parentId:
                destination.id,
              normalizedName:
                child.normalizedName,
            })
            .first();

        if (
          conflictingFolder &&
          conflictingFolder.id !==
            child.id
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "FOLDER_MOVE_CONFLICT",
              message:
                `A subfolder named "${child.name}" already exists in the destination.`,
            },
            {
              status: 409,
            },
          );
        }
      }

      const directMedia =
        subtreeMedia.filter(
          (
            media,
          ) =>
            media.folderId ===
            folder.id,
        );

      const destinationMedia =
        workspaceMedia.filter(
          (
            media,
          ) =>
            media.folderId ===
            destination.id,
        );

      for (
        const media of
        directMedia
      ) {
        const hasDuplicate =
          destinationMedia.some(
            (
              existing,
            ) =>
              existing.originalFileName.toLowerCase() ===
                media.originalFileName.toLowerCase() &&
              existing.status !==
                "FAILED" &&
              existing.status !==
                "CANCELLED",
          );

        if (hasDuplicate) {
          return NextResponse.json(
            {
              success: false,
              error:
                "MEDIA_MOVE_CONFLICT",
              message:
                `A file named "${media.originalFileName}" already exists in the destination folder.`,
            },
            {
              status: 409,
            },
          );
        }
      }

      for (
        const media of
        directMedia
      ) {
        await db.orm.public.MediaAsset
          .where({
            id:
              media.id,
            workspaceId:
              workspaceMember.workspaceId,
          })
          .update({
            folderId:
              destination.id,
          });
      }

      for (
        const child of
        directChildren
      ) {
        await db.orm.public.PerformerLibraryFolder
          .where({
            id:
              child.id,
            workspaceId:
              workspaceMember.workspaceId,
            performerId:
              performer.id,
          })
          .update({
            parentId:
              destination.id,
          });
      }

      await db.orm.public.PerformerLibraryFolder
        .where({
          id:
            folder.id,
          workspaceId:
            workspaceMember.workspaceId,
          performerId:
            performer.id,
        })
        .delete();

      return NextResponse.json({
        success: true,
        deletedFolderId:
          folder.id,
        movedToFolderId:
          destination.id,
        moved: {
          files:
            directMedia.length,
          subfolders:
            directChildren.length,
        },
      });
    }

    if (
      mode ===
      "DELETE_ALL"
    ) {
      if (
        body.confirmation !==
        "DELETE"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "DELETE_CONFIRMATION_REQUIRED",
            message:
              'Type "DELETE" exactly to confirm permanent deletion.',
          },
          {
            status: 400,
          },
        );
      }

      const mediaWithPublicationHistory: {
        id: string;
        fileName: string;
      }[] = [];

      for (
        const media of
        subtreeMedia
      ) {
        const distributionJob =
          await db.orm.public.DistributionJob
            .where({
              workspaceId:
                workspaceMember.workspaceId,
              mediaAssetId:
                media.id,
            })
            .first();

        if (
          distributionJob
        ) {
          mediaWithPublicationHistory.push({
            id:
              media.id,
            fileName:
              media.originalFileName,
          });
        }
      }

      if (
        mediaWithPublicationHistory.length >
        0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "FOLDER_HAS_PUBLISHED_MEDIA",
            message:
              "This folder contains media with publication history. Those files are protected from permanent deletion.",
            protectedMedia:
              mediaWithPublicationHistory,
            counts: {
              files:
                subtreeMedia.length,
              subfolders:
                childFolders.length,
              protectedFiles:
                mediaWithPublicationHistory.length,
            },
          },
          {
            status: 409,
          },
        );
      }

      const r2 =
        getR2Client();

      for (
        const media of
        subtreeMedia
      ) {
        try {
          await r2.send(
            new DeleteObjectCommand({
              Bucket:
                media.bucketName,
              Key:
                media.objectKey,
            }),
          );

          if (
            media.thumbnailObjectKey
          ) {
            await r2.send(
              new DeleteObjectCommand({
                Bucket:
                  media.bucketName,
                Key:
                  media.thumbnailObjectKey,
              }),
            );
          }
        } catch (error) {
          console.error(
            "PERFORMER_LIBRARY_R2_DELETE_ERROR",
            {
              folderId:
                folder.id,
              mediaId:
                media.id,
              objectKey:
                media.objectKey,
              error,
            },
          );

          return NextResponse.json(
            {
              success: false,
              error:
                "STORAGE_DELETE_FAILED",
              message:
                "A storage object could not be deleted. Database deletion was stopped.",
              failedMediaId:
                media.id,
            },
            {
              status: 502,
            },
          );
        }
      }

      for (
        const media of
        subtreeMedia
      ) {
        const categoryLinks =
          await db.orm.public.MediaAssetCategory
            .where({
              mediaAssetId:
                media.id,
            })
            .all();

        for (
          const link of
          categoryLinks
        ) {
          await db.orm.public.MediaAssetCategory
            .where({
              mediaAssetId:
                link.mediaAssetId,
              categoryId:
                link.categoryId,
            })
            .delete();
        }

        const performerLinks =
          await db.orm.public.MediaAssetPerformer
            .where({
              workspaceId:
                workspaceMember.workspaceId,
              mediaAssetId:
                media.id,
            })
            .all();

        for (
          const link of
          performerLinks
        ) {
          await db.orm.public.MediaAssetPerformer
            .where({
              workspaceId:
                link.workspaceId,
              mediaAssetId:
                link.mediaAssetId,
              performerId:
                link.performerId,
            })
            .delete();
        }

        await db.orm.public.MediaAsset
          .where({
            id:
              media.id,
            workspaceId:
              workspaceMember.workspaceId,
          })
          .delete();
      }

      const foldersById =
        new Map(
          folders.map(
            (
              item,
            ) => [
              item.id,
              {
                id:
                  item.id,
                parentId:
                  item.parentId,
              },
            ],
          ),
        );

      const foldersToDelete =
        folders
          .filter(
            (
              candidate,
            ) =>
              subtreeIds.has(
                candidate.id,
              ),
          )
          .sort(
            (
              left,
              right,
            ) =>
              folderDepth(
                foldersById,
                right.id,
              ) -
              folderDepth(
                foldersById,
                left.id,
              ),
          );

      for (
        const folderToDelete of
        foldersToDelete
      ) {
        await db.orm.public.PerformerLibraryFolder
          .where({
            id:
              folderToDelete.id,
            workspaceId:
              workspaceMember.workspaceId,
            performerId:
              performer.id,
          })
          .delete();
      }

      return NextResponse.json({
        success: true,
        deletedFolderId:
          folder.id,
        deleted: {
          files:
            subtreeMedia.length,
          subfolders:
            childFolders.length,
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "UNSUPPORTED_DELETE_MODE",
      },
      {
        status: 400,
      },
    );
  } catch (error) {
    console.error(
      "PERFORMER_LIBRARY_DELETE_ERROR",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "INTERNAL_ERROR",
        message:
          error instanceof
          Error
            ? error.message
            : "Unable to update the performer library.",
      },
      {
        status: 500,
      },
    );
  }
}
