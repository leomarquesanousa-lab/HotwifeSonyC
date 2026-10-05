import {
  decryptPlatformToken,
} from "@/src/lib/platforms/token-crypto";

import {
  getR2ObjectDownloadUrl,
} from "@/src/lib/storage/r2";

type InstagramPlatformAccount = {
  externalAccountId: string | null;
  accessTokenEncrypted: string | null;
};

type InstagramMediaAsset = {
  objectKey: string;
  mediaType?: string | null;
  contentType?: string | null;
  thumbnailObjectKey?: string | null;
};

type InstagramPublication = {
  caption: string | null;
};

export type InstagramPublishType =
  | "POST"
  | "REEL"
  | "STORY";

type InstagramCreateContainerResponse = {
  id?: string;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

type InstagramContainerStatusResponse = {
  id?: string;
  status_code?: string;
  status?: string;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

type InstagramPublishResponse = {
  id?: string;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

export type InstagramPublishResult = {
  externalPostId: string;
  containerId: string;
  publishType: InstagramPublishType;
};

const INSTAGRAM_GRAPH_BASE_URL =
  "https://graph.instagram.com";

const R2_DOWNLOAD_URL_TTL_SECONDS =
  60 * 60;

function getInstagramApiVersion() {
  const value =
    process.env
      .INSTAGRAM_GRAPH_API_VERSION
      ?.trim();

  console.info(
    "INSTAGRAM_API_VERSION",
    {
      version:
        value ?? null,
    },
  );

  if (!value) {
    throw new Error(
      "INSTAGRAM_GRAPH_API_VERSION_MISSING",
    );
  }

  return value.startsWith(
    "v",
  )
    ? value
    : `v${value}`;
}

function getErrorMessage(
  error:
    | {
        message?: string;
        type?: string;
        code?: number;
        error_subcode?: number;
      }
    | undefined,
) {
  if (!error) {
    return null;
  }

  return [
    error.message,
    error.type,
    typeof error.code ===
    "number"
      ? `code=${error.code}`
      : null,
    typeof error.error_subcode ===
    "number"
      ? `subcode=${error.error_subcode}`
      : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function isImageMedia(
  mediaAsset: InstagramMediaAsset,
) {
  const mediaType =
    mediaAsset.mediaType
      ?.trim()
      .toUpperCase();

  if (
    mediaType ===
    "IMAGE"
  ) {
    return true;
  }

  const contentType =
    mediaAsset.contentType
      ?.trim()
      .toLowerCase();

  return Boolean(
    contentType?.startsWith(
      "image/",
    ),
  );
}

function isVideoMedia(
  mediaAsset: InstagramMediaAsset,
) {
  const mediaType =
    mediaAsset.mediaType
      ?.trim()
      .toUpperCase();

  if (
    mediaType ===
    "VIDEO"
  ) {
    return true;
  }

  const contentType =
    mediaAsset.contentType
      ?.trim()
      .toLowerCase();

  return Boolean(
    contentType?.startsWith(
      "video/",
    ),
  );
}

async function createContainer({
  instagramUserId,
  accessToken,
  mediaUrl,
  caption,
  publishType,
  isImage,
  coverUrl,
}: {
  instagramUserId: string;
  accessToken: string;
  mediaUrl: string;
  caption: string | null;
  publishType: InstagramPublishType;
  isImage: boolean;
  coverUrl?: string | null;
}) {
  const apiVersion =
    getInstagramApiVersion();

  const url =
    new URL(
      `${INSTAGRAM_GRAPH_BASE_URL}/${apiVersion}/${instagramUserId}/media`,
    );

  if (
    publishType ===
    "REEL"
  ) {
    if (isImage) {
      throw new Error(
        "INSTAGRAM_REEL_REQUIRES_VIDEO",
      );
    }

    url.searchParams.set(
      "media_type",
      "REELS",
    );

    url.searchParams.set(
      "video_url",
      mediaUrl,
    );

    url.searchParams.set(
      "share_to_feed",
      "true",
    );

    if (coverUrl) {
      url.searchParams.set(
        "cover_url",
        coverUrl,
      );
    }

    if (caption) {
      url.searchParams.set(
        "caption",
        caption,
      );
    }
  } else if (
    publishType ===
    "STORY"
  ) {
    url.searchParams.set(
      "media_type",
      "STORIES",
    );

    if (isImage) {
      url.searchParams.set(
        "image_url",
        mediaUrl,
      );
    } else {
      url.searchParams.set(
        "video_url",
        mediaUrl,
      );
    }
  } else {
    if (isImage) {
      url.searchParams.set(
        "image_url",
        mediaUrl,
      );
    } else {
      /*
       * Instagram feed video publishing is handled
       * through the Reels publishing flow.
       *
       * If a normal feed publication receives a video,
       * fail explicitly instead of silently changing
       * the selected destination.
       */
      throw new Error(
        "INSTAGRAM_POST_REQUIRES_IMAGE",
      );
    }

    if (caption) {
      url.searchParams.set(
        "caption",
        caption,
      );
    }
  }

  const response =
    await fetch(
      url.toString(),
      {
        method:
          "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
        cache:
          "no-store",
      },
    );

  const data =
    (await response.json()) as InstagramCreateContainerResponse;

  if (
    !response.ok ||
    !data.id
  ) {
    const details =
      getErrorMessage(
        data.error,
      );

    throw new Error(
      details
        ? `INSTAGRAM_CREATE_CONTAINER_FAILED: ${details}`
        : "INSTAGRAM_CREATE_CONTAINER_FAILED",
    );
  }

  return data.id;
}

async function getContainerStatus(
  containerId: string,
  accessToken: string,
) {
  const apiVersion =
    getInstagramApiVersion();

  const url =
    new URL(
      `${INSTAGRAM_GRAPH_BASE_URL}/${apiVersion}/${containerId}`,
    );

  url.searchParams.set(
    "fields",
    "status_code,status",
  );

  const response =
    await fetch(
      url.toString(),
      {
        method:
          "GET",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
        cache:
          "no-store",
      },
    );

  const data =
    (await response.json()) as InstagramContainerStatusResponse;

  if (
    !response.ok
  ) {
    const details =
      getErrorMessage(
        data.error,
      );

    throw new Error(
      details
        ? `INSTAGRAM_CONTAINER_STATUS_FAILED: ${details}`
        : "INSTAGRAM_CONTAINER_STATUS_FAILED",
    );
  }

  return data;
}

async function waitForContainer(
  containerId: string,
  accessToken: string,
) {
  const maximumAttempts =
    30;

  const delayMilliseconds =
    10_000;

  for (
    let attempt = 1;
    attempt <=
    maximumAttempts;
    attempt += 1
  ) {
    const status =
      await getContainerStatus(
        containerId,
        accessToken,
      );

    if (
      status.status_code ===
        "FINISHED" ||
      status.status_code ===
        "PUBLISHED"
    ) {
      return;
    }

    if (
      status.status_code ===
        "ERROR" ||
      status.status_code ===
        "EXPIRED"
    ) {
      throw new Error(
        `INSTAGRAM_CONTAINER_${status.status_code}${
          status.status
            ? `: ${status.status}`
            : ""
        }`,
      );
    }

    if (
      attempt <
      maximumAttempts
    ) {
      await new Promise<void>(
        (resolve) => {
          setTimeout(
            resolve,
            delayMilliseconds,
          );
        },
      );
    }
  }

  throw new Error(
    "INSTAGRAM_CONTAINER_TIMEOUT",
  );
}

async function publishContainer(
  instagramUserId: string,
  containerId: string,
  accessToken: string,
) {
  const apiVersion =
    getInstagramApiVersion();

  const url =
    new URL(
      `${INSTAGRAM_GRAPH_BASE_URL}/${apiVersion}/${instagramUserId}/media_publish`,
    );

  url.searchParams.set(
    "creation_id",
    containerId,
  );

  const response =
    await fetch(
      url.toString(),
      {
        method:
          "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
        cache:
          "no-store",
      },
    );

  const data =
    (await response.json()) as InstagramPublishResponse;

  if (
    !response.ok ||
    !data.id
  ) {
    const details =
      getErrorMessage(
        data.error,
      );

    throw new Error(
      details
        ? `INSTAGRAM_PUBLISH_FAILED: ${details}`
        : "INSTAGRAM_PUBLISH_FAILED",
    );
  }

  return data.id;
}

export async function publishInstagram({
  platformAccount,
  mediaAsset,
  publication,
  publishType,
}: {
  platformAccount:
    InstagramPlatformAccount;
  mediaAsset:
    InstagramMediaAsset;
  publication:
    InstagramPublication;
  publishType:
    InstagramPublishType;
}): Promise<InstagramPublishResult> {
  if (
    !platformAccount.externalAccountId
  ) {
    throw new Error(
      "INSTAGRAM_ACCOUNT_ID_MISSING",
    );
  }

  if (
    !platformAccount.accessTokenEncrypted
  ) {
    throw new Error(
      "INSTAGRAM_ACCESS_TOKEN_MISSING",
    );
  }

  if (
    !mediaAsset.objectKey
  ) {
    throw new Error(
      "INSTAGRAM_MEDIA_OBJECT_KEY_MISSING",
    );
  }

  const normalizedPublishType =
    publishType
      ?.trim()
      .toUpperCase() as
      InstagramPublishType;

  if (
    normalizedPublishType !==
      "POST" &&
    normalizedPublishType !==
      "REEL" &&
    normalizedPublishType !==
      "STORY"
  ) {
    throw new Error(
      "INSTAGRAM_INVALID_PUBLISH_TYPE",
    );
  }

  const image =
    isImageMedia(
      mediaAsset,
    );

  const video =
    isVideoMedia(
      mediaAsset,
    );

  if (
    !image &&
    !video
  ) {
    throw new Error(
      "INSTAGRAM_UNSUPPORTED_MEDIA_TYPE",
    );
  }

  if (
    normalizedPublishType ===
      "REEL" &&
    !video
  ) {
    throw new Error(
      "INSTAGRAM_REEL_REQUIRES_VIDEO",
    );
  }

  if (
    normalizedPublishType ===
      "POST" &&
    !image
  ) {
    throw new Error(
      "INSTAGRAM_POST_REQUIRES_IMAGE",
    );
  }

  const accessToken =
    decryptPlatformToken(
      platformAccount.accessTokenEncrypted,
    );

  const mediaUrl =
    await getR2ObjectDownloadUrl(
      mediaAsset.objectKey,
      R2_DOWNLOAD_URL_TTL_SECONDS,
    );

  const coverUrl =
    normalizedPublishType ===
      "REEL" &&
    mediaAsset.thumbnailObjectKey
      ? await getR2ObjectDownloadUrl(
          mediaAsset.thumbnailObjectKey,
          R2_DOWNLOAD_URL_TTL_SECONDS,
        )
      : null;

  const containerId =
    await createContainer({
      instagramUserId:
        platformAccount.externalAccountId,
      accessToken,
      mediaUrl,
      caption:
        publication.caption,
      publishType:
        normalizedPublishType,
      isImage:
        image,
      coverUrl,
    });

  await waitForContainer(
    containerId,
    accessToken,
  );

  const externalPostId =
    await publishContainer(
      platformAccount.externalAccountId,
      containerId,
      accessToken,
    );

  return {
    externalPostId,
    containerId,
    publishType:
      normalizedPublishType,
  };
}

/*
 * Backwards-compatible wrapper.
 *
 * The current execute route still imports
 * publishInstagramReel(). We keep this temporarily so
 * Reel publishing continues working while the route and
 * Distribution UI are migrated to POST / REEL / STORY.
 */
export async function publishInstagramReel({
  platformAccount,
  mediaAsset,
  publication,
}: {
  platformAccount:
    InstagramPlatformAccount;
  mediaAsset:
    InstagramMediaAsset;
  publication:
    InstagramPublication;
}): Promise<InstagramPublishResult> {
  return publishInstagram({
    platformAccount,
    mediaAsset,
    publication,
    publishType:
      "REEL",
  });
}