import crypto from "node:crypto";

import {
  db,
} from "@/src/prisma/db";

type CreatePerformerLibraryInput = {
  workspaceId: string;
  performerId: string;
};

type DefaultSubfolder = {
  name: string;
  normalizedName: string;
  systemKey: string;
  sortOrder: number;
};

const DEFAULT_SUBFOLDERS: DefaultSubfolder[] = [
  {
    name: "Thumbnails",
    normalizedName: "thumbnails",
    systemKey: "THUMBNAILS",
    sortOrder: 10,
  },
  {
    name: "Photos",
    normalizedName: "photos",
    systemKey: "PHOTOS",
    sortOrder: 20,
  },
  {
    name: "Full Videos",
    normalizedName: "full-videos",
    systemKey: "FULL_VIDEOS",
    sortOrder: 30,
  },
  {
    name: "Cuts / Clips",
    normalizedName: "cuts-clips",
    systemKey: "CUTS_CLIPS",
    sortOrder: 40,
  },
];

async function createRootFolder({
  workspaceId,
  performerId,
  name,
  normalizedName,
  systemKey,
  sortOrder,
}: {
  workspaceId: string;
  performerId: string;
  name: string;
  normalizedName: string;
  systemKey: string;
  sortOrder: number;
}) {
  return db.orm.public.PerformerLibraryFolder.create({
    id:
      crypto.randomUUID(),

    workspaceId,

    performerId,

    parentId:
      null,

    name,

    normalizedName,

    folderType:
      "SYSTEM_ROOT",

    systemKey,

    isSystem:
      true,

    isRequired:
      true,

    sortOrder,

    status:
      "ACTIVE",
  });
}

async function createSubfolders({
  workspaceId,
  performerId,
  parentId,
  rootSystemKey,
}: {
  workspaceId: string;
  performerId: string;
  parentId: string;
  rootSystemKey: string;
}) {
  for (
    const folder
    of DEFAULT_SUBFOLDERS
  ) {
    await db.orm.public.PerformerLibraryFolder.create({
      id:
        crypto.randomUUID(),

      workspaceId,

      performerId,

      parentId,

      name:
        folder.name,

      normalizedName:
        folder.normalizedName,

      folderType:
        "SYSTEM_FOLDER",

      systemKey:
        `${rootSystemKey}_${folder.systemKey}`,

      isSystem:
        true,

      isRequired:
        true,

      sortOrder:
        folder.sortOrder,

      status:
        "ACTIVE",
    });
  }
}

export async function createDefaultPerformerLibrary({
  workspaceId,
  performerId,
}: CreatePerformerLibraryInput) {
  const safe =
    await createRootFolder({
      workspaceId,
      performerId,
      name:
        "SAFE",
      normalizedName:
        "safe",
      systemKey:
        "SAFE",
      sortOrder:
        10,
    });

  const unsafe =
    await createRootFolder({
      workspaceId,
      performerId,
      name:
        "UNSAFE",
      normalizedName:
        "unsafe",
      systemKey:
        "UNSAFE",
      sortOrder:
        20,
    });

  await createSubfolders({
    workspaceId,
    performerId,
    parentId:
      safe.id,
    rootSystemKey:
      "SAFE",
  });

  await createSubfolders({
    workspaceId,
    performerId,
    parentId:
      unsafe.id,
    rootSystemKey:
      "UNSAFE",
  });

  return {
    safeFolderId:
      safe.id,

    unsafeFolderId:
      unsafe.id,
  };
}