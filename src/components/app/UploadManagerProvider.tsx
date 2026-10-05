"use client";

import { useTranslations } from "next-intl";

import { readVideoMetadata } from "@/src/lib/media/read-video-metadata";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type MultipartStartResponse = {
  success: boolean;
  mediaId?: string;
  uploadId?: string;
  error?: string;
  message?: string;
  existingMedia?: {
    id: string;
    originalFileName: string;
    status: string;
  };
};

type PartUrlResponse = {
  success: boolean;
  uploadUrl?: string;
  error?: string;
};

type CompleteResponse = {
  success: boolean;
  error?: string;
  message?: string;
};

export type UploadManagerStatus =
  | "READY"
  | "STARTING"
  | "UPLOADING"
  | "COMPLETING"
  | "DONE"
  | "ERROR"
  | "CANCELLED";

export type UploadTarget = {
  performerId: string;
  folderId: string;
};

export type ManagedUpload = {
  localId: string;
  file: File;
  performerId: string;
  folderId: string;
  mediaId: string | null;
  uploadId: string | null;
  progress: number;
  uploadedBytes: number;
  status: UploadManagerStatus;
  error: string;
};

type AddFilesResult = {
  success: boolean;
  added: number;
  error?: string;
};

type UploadManagerContextValue = {
  uploads: ManagedUpload[];
  isUploading: boolean;
  activeCount: number;
  completedCount: number;
  overallProgress: number;
  addFiles: (
    files: File[],
    target: UploadTarget,
  ) => AddFilesResult;
  startAll: () => Promise<void>;
  cancelUpload: (
    localId: string,
  ) => void;
  removeUpload: (
    localId: string,
  ) => void;
  clearCompleted: () => void;
  clearQueue: () => void;
};

const PART_SIZE =
  32 * 1024 * 1024;

const CONCURRENT_PART_UPLOADS =
  3;

const CONCURRENT_FILE_UPLOADS =
  3;

const MAX_FILES_PER_BATCH =
  10;

const ACCEPTED_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-m4v",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const API_REQUEST_TIMEOUT_MS =
  30 * 1000;

const PART_UPLOAD_TIMEOUT_MS =
  3 * 60 * 1000;

const ABORT_REQUEST_TIMEOUT_MS =
  15 * 1000;

function describeError(
  error: unknown,
) {
  if (
    error instanceof Error
  ) {
    return {
      errorName:
        error.name,
      errorMessage:
        error.message,
      errorStack:
        error.stack ??
        null,
    };
  }

  return {
    errorName:
      typeof error,
    errorMessage:
      String(
        error,
      ),
    errorStack:
      null,
  };
}

async function fetchWithTimeout(
  input:
    | RequestInfo
    | URL,
  init: RequestInit,
  timeoutMs: number,
  timeoutMessage: string,
) {
  const controller =
    new AbortController();

  const timeout =
    window.setTimeout(
      () => {
        controller.abort();
      },
      timeoutMs,
    );

  try {
    return await fetch(
      input,
      {
        ...init,
        signal:
          controller.signal,
      },
    );
  } catch (error) {
    if (
      controller.signal.aborted
    ) {
      throw new Error(
        timeoutMessage,
      );
    }

    throw error;
  } finally {
    window.clearTimeout(
      timeout,
    );
  }
}

async function readJsonResponse<
  T,
>(
  response: Response,
  context: string,
): Promise<T> {
  const bodyText =
    await response.text();

  if (!bodyText) {
    throw new Error(
      `${context} returned an empty response (HTTP ${response.status}).`,
    );
  }

  try {
    return JSON.parse(
      bodyText,
    ) as T;
  } catch {
    const preview =
      bodyText
        .replace(
          /\s+/g,
          " ",
        )
        .slice(
          0,
          300,
        );

    throw new Error(
      `${context} returned invalid JSON (HTTP ${response.status}): ${preview}`,
    );
  }
}

const UploadManagerContext =
  createContext<
    UploadManagerContextValue | undefined
  >(undefined);

export function UploadManagerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const metadataT = useTranslations("videoUploadMetadata");
  const [
    uploads,
    setUploads,
  ] = useState<
    ManagedUpload[]
  >([]);

  const [
    isUploading,
    setIsUploading,
  ] = useState(false);

  const cancelRefs =
    useRef<
      Record<string, boolean>
    >({});

  const updateUpload =
    useCallback(
      (
        localId: string,
        updater: (
          current: ManagedUpload,
        ) => ManagedUpload,
      ) => {
        setUploads(
          (current) =>
            current.map(
              (upload) =>
                upload.localId ===
                localId
                  ? updater(
                      upload,
                    )
                  : upload,
            ),
        );
      },
      [],
    );

  const abortUpload =
    useCallback(
      async (
        mediaId: string,
        uploadId: string,
      ) => {
        try {
          await fetchWithTimeout(
            "/api/media/multipart/abort",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
                  mediaId,
                  uploadId,
                }),
            },
            ABORT_REQUEST_TIMEOUT_MS,
            "Timed out while aborting the multipart upload.",
          );
        } catch (error) {
          console.error(
            "MEDIA_ABORT_ERROR",
            {
              mediaId,
              uploadId,
              ...describeError(
                error,
              ),
            },
          );
        }
      },
      [],
    );

  const uploadOne =
    useCallback(
      async (
        upload: ManagedUpload,
      ) => {
        const {
          localId,
          file,
          performerId,
          folderId,
        } = upload;

        let currentMediaId:
          | string
          | null = null;

        let currentUploadId:
          | string
          | null = null;

        let uploadStage =
          "INITIALIZING";

        cancelRefs.current[
          localId
        ] = false;

        try {
          updateUpload(
            localId,
            (current) => ({
              ...current,
              status:
                "STARTING",
              progress: 0,
              uploadedBytes: 0,
              error: "",
            }),
          );

          uploadStage = "READ_VIDEO_METADATA";
          const videoMetadata = file.type.startsWith("video/") ? await readVideoMetadata(file) : undefined;
          if (cancelRefs.current[localId]) throw new Error("UPLOAD_CANCELLED");

          uploadStage = "START_REQUEST";

          const startResponse =
            await fetchWithTimeout(
              "/api/media/multipart/start",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify({
                    fileName:
                      file.name,
                    contentType:
                      file.type,
                    fileSize:
                      file.size,
                    videoMetadata,
                    performerId,
                    folderId,
                  }),
              },
              API_REQUEST_TIMEOUT_MS,
              "Timed out while starting the multipart upload.",
            );

          const startData =
            await readJsonResponse<MultipartStartResponse>(
              startResponse,
              "Multipart start",
            );

          if (
            !startResponse.ok ||
            !startData.success ||
            !startData.mediaId ||
            !startData.uploadId
          ) {
            if (
              startData.error ===
              "DUPLICATE_MEDIA"
            ) {
              throw new Error(
                startData.message ||
                  `${file.name} already exists in the Media Library. Duplicate videos are not allowed.`,
              );
            }

            throw new Error(
              (startData.error === "VIDEO_METADATA_REQUIRED" ? startData.error : startData.message || startData.error) ||
                "Unable to start upload.",
            );
          }

          currentMediaId =
            startData.mediaId;

          currentUploadId =
            startData.uploadId;

          updateUpload(
            localId,
            (current) => ({
              ...current,
              mediaId:
                currentMediaId,
              uploadId:
                currentUploadId,
              status:
                "UPLOADING",
            }),
          );

          const totalParts =
            Math.ceil(
              file.size /
                PART_SIZE,
            );

          const completedParts: {
            partNumber: number;
            etag: string;
          }[] = [];

          let uploadedBytes = 0;
          let nextPartIndex = 0;

          async function uploadPart(
            index: number,
          ) {
            if (
              cancelRefs.current[
                localId
              ]
            ) {
              throw new Error(
                "UPLOAD_CANCELLED",
              );
            }

            const partNumber =
              index + 1;

            const startByte =
              index *
              PART_SIZE;

            const endByte =
              Math.min(
                startByte +
                  PART_SIZE,
                file.size,
              );

            const blob =
              file.slice(
                startByte,
                endByte,
              );

            const maxAttempts = 4;
            let lastError: unknown = null;

            for (
              let attempt = 1;
              attempt <=
                maxAttempts;
              attempt += 1
            ) {
              if (
                cancelRefs.current[
                  localId
                ]
              ) {
                throw new Error(
                  "UPLOAD_CANCELLED",
                );
              }

              try {
                uploadStage =
                  `PART_${partNumber}_URL_ATTEMPT_${attempt}`;

                const urlResponse =
                  await fetchWithTimeout(
                    "/api/media/multipart/part-url",
                    {
                      method:
                        "POST",
                      headers: {
                        "Content-Type":
                          "application/json",
                      },
                      body:
                        JSON.stringify({
                          mediaId:
                            currentMediaId,
                          uploadId:
                            currentUploadId,
                          partNumber,
                        }),
                    },
                    API_REQUEST_TIMEOUT_MS,
                    `Timed out while preparing part ${partNumber}.`,
                  );

                const urlData =
                  await readJsonResponse<PartUrlResponse>(
                    urlResponse,
                    `Multipart part-url for part ${partNumber}`,
                  );

                if (
                  !urlResponse.ok ||
                  !urlData.success ||
                  !urlData.uploadUrl
                ) {
                  throw new Error(
                    urlData.error ||
                      `Unable to prepare part ${partNumber}.`,
                  );
                }

                if (
                  cancelRefs.current[
                    localId
                  ]
                ) {
                  throw new Error(
                    "UPLOAD_CANCELLED",
                  );
                }

                uploadStage =
                  `PART_${partNumber}_PUT_ATTEMPT_${attempt}`;

                const uploadResponse =
                  await fetchWithTimeout(
                    urlData.uploadUrl,
                    {
                      method:
                        "PUT",
                      body:
                        blob,
                    },
                    PART_UPLOAD_TIMEOUT_MS,
                    `Part ${partNumber} upload timed out after ${Math.round(
                      PART_UPLOAD_TIMEOUT_MS /
                        1000,
                    )} seconds.`,
                  );

                if (
                  !uploadResponse.ok
                ) {
                  const responseText =
                    (await uploadResponse.text())
                      .replace(
                        /\s+/g,
                        " ",
                      )
                      .slice(
                        0,
                        300,
                      );

                  throw new Error(
                    `Part ${partNumber} upload failed with HTTP ${uploadResponse.status}${
                      responseText
                        ? `: ${responseText}`
                        : ""
                    }.`,
                  );
                }

                const etag =
                  uploadResponse.headers.get(
                    "etag",
                  );

                if (!etag) {
                  throw new Error(
                    `R2 did not return an ETag for part ${partNumber}.`,
                  );
                }

                completedParts.push({
                  partNumber,
                  etag,
                });

                uploadedBytes +=
                  blob.size;

                const progress =
                  Math.min(
                    100,
                    Math.round(
                      (uploadedBytes /
                        file.size) *
                        100,
                    ),
                  );

                updateUpload(
                  localId,
                  (current) => ({
                    ...current,
                    uploadedBytes,
                    progress,
                  }),
                );

                return;
              } catch (error) {
                if (
                  error instanceof Error &&
                  error.message ===
                    "UPLOAD_CANCELLED"
                ) {
                  throw error;
                }

                lastError = error;

                console.warn(
                  "MEDIA_PART_UPLOAD_RETRY",
                  {
                    fileName:
                      file.name,
                    performerId,
                    folderId,
                    mediaId:
                      currentMediaId,
                    uploadId:
                      currentUploadId,
                    partNumber,
                    attempt,
                    maxAttempts,
                    ...describeError(
                      error,
                    ),
                  },
                );

                if (
                  attempt >=
                  maxAttempts
                ) {
                  break;
                }

                const retryDelay =
                  Math.min(
                    1000 *
                      2 **
                        (attempt - 1),
                    8000,
                  );

                await new Promise<void>(
                  (resolve) => {
                    setTimeout(
                      resolve,
                      retryDelay,
                    );
                  },
                );
              }
            }

            const finalMessage =
              lastError instanceof Error
                ? lastError.message
                : "Unknown upload error.";

            throw new Error(
              `Part ${partNumber} failed after ${maxAttempts} attempts: ${finalMessage}`,
            );
          }

          async function partWorker() {
            while (true) {
              if (
                cancelRefs.current[
                  localId
                ]
              ) {
                throw new Error(
                  "UPLOAD_CANCELLED",
                );
              }

              const index =
                nextPartIndex;

              nextPartIndex += 1;

              if (
                index >=
                totalParts
              ) {
                return;
              }

              await uploadPart(
                index,
              );
            }
          }

          const partWorkerCount =
            Math.min(
              CONCURRENT_PART_UPLOADS,
              totalParts,
            );

          await Promise.all(
            Array.from(
              {
                length:
                  partWorkerCount,
              },
              () =>
                partWorker(),
            ),
          );

          completedParts.sort(
            (
              left,
              right,
            ) =>
              left.partNumber -
              right.partNumber,
          );

          updateUpload(
            localId,
            (current) => ({
              ...current,
              status:
                "COMPLETING",
              progress: 100,
            }),
          );

          uploadStage =
            "COMPLETE_REQUEST";

          const completeResponse =
            await fetchWithTimeout(
              "/api/media/multipart/complete",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify({
                    mediaId:
                      currentMediaId,
                    uploadId:
                      currentUploadId,
                    parts:
                      completedParts,
                    videoMetadata,
                  }),
              },
              API_REQUEST_TIMEOUT_MS,
              "Timed out while completing the multipart upload.",
            );

          const completeData =
            await readJsonResponse<CompleteResponse>(
              completeResponse,
              "Multipart complete",
            );

          if (
            !completeResponse.ok ||
            !completeData.success
          ) {
            throw new Error(
              (["VIDEO_METADATA_REQUIRED", "MEDIA_SIZE_MISMATCH"].includes(completeData.error ?? "") ? completeData.error : completeData.message || completeData.error) ||
                "Unable to complete upload.",
            );
          }

          updateUpload(
            localId,
            (current) => ({
              ...current,
              status:
                "DONE",
              progress: 100,
              uploadedBytes:
                file.size,
              error: "",
            }),
          );

          window.dispatchEvent(
            new CustomEvent(
              "creator-platform:media-updated",
            ),
          );

          return true;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Upload failed.";

          if (
            message ===
            "UPLOAD_CANCELLED"
          ) {
            if (
              currentMediaId &&
              currentUploadId
            ) {
              await abortUpload(
                currentMediaId,
                currentUploadId,
              );
            }

            updateUpload(
              localId,
              (current) => ({
                ...current,
                status:
                  "CANCELLED",
                error:
                  "Upload cancelled.",
              }),
            );

            return false;
          }

          const errorDetails = {
            stage:
              uploadStage,
            fileName:
              file.name,
            fileSize:
              file.size,
            contentType:
              file.type,
            performerId,
            folderId,
            mediaId:
              currentMediaId,
            uploadId:
              currentUploadId,
            ...describeError(
              error,
            ),
          };

          /*
           * Next.js' development overlay can render an Error object
           * nested inside console.error as "{}". Keep the first
           * console.error argument fully textual so the real failure
           * appears directly in the overlay.
           */
          console.error(
            `MEDIA_UPLOAD_ERROR | stage=${errorDetails.stage} | file=${errorDetails.fileName} | message=${errorDetails.errorMessage} | error=${errorDetails.errorName} | mediaId=${errorDetails.mediaId ?? "null"} | uploadId=${errorDetails.uploadId ?? "null"}`,
          );

          console.debug(
            "MEDIA_UPLOAD_ERROR_DETAILS",
            errorDetails,
          );

          if (
            currentMediaId &&
            currentUploadId
          ) {
            await abortUpload(
              currentMediaId,
              currentUploadId,
            );
          }

          updateUpload(
            localId,
            (current) => ({
              ...current,
              status:
                "ERROR",
              error: message === "VIDEO_METADATA_READ_FAILED" ? metadataT("readFailed")
                : message === "VIDEO_METADATA_REQUIRED" ? metadataT("required")
                : message === "MEDIA_SIZE_MISMATCH" ? metadataT("sizeMismatch")
                : message,
            }),
          );

          return false;
        }
      },
      [abortUpload, updateUpload, metadataT],
    );

  const addFiles =
    useCallback(
      (
        files: File[],
        target: UploadTarget,
      ): AddFilesResult => {
        if (
          !target.performerId ||
          !target.folderId
        ) {
          return {
            success: false,
            added: 0,
            error:
              "Select a performer and a destination folder first.",
          };
        }

        if (
          files.length ===
          0
        ) {
          return {
            success: false,
            added: 0,
            error:
              "No files selected.",
          };
        }

        if (
          files.length >
          MAX_FILES_PER_BATCH
        ) {
          return {
            success: false,
            added: 0,
            error:
              `You can select up to ${MAX_FILES_PER_BATCH} videos at a time.`,
          };
        }

        const unsupported =
          files.find(
            (file) =>
              !ACCEPTED_TYPES.includes(
                file.type,
              ),
          );

        if (unsupported) {
          return {
            success: false,
            added: 0,
            error:
              `${unsupported.name} has an unsupported format. Use MP4, MOV, M4V, JPG, PNG or WebP.`,
          };
        }

        const nextUploads =
          files.map(
            (file) => ({
              localId:
                crypto.randomUUID(),
              file,
              performerId:
                target.performerId,
              folderId:
                target.folderId,
              mediaId: null,
              uploadId: null,
              progress: 0,
              uploadedBytes: 0,
              status:
                "READY" as const,
              error: "",
            }),
          );

        setUploads(
          (current) => {
            const activeOrPending =
              current.filter(
                (upload) =>
                  upload.status !==
                  "DONE" &&
                  upload.status !==
                  "CANCELLED",
              );

            if (
              activeOrPending.length +
                nextUploads.length >
              MAX_FILES_PER_BATCH
            ) {
              return current;
            }

            return [
              ...current,
              ...nextUploads,
            ];
          },
        );

        return {
          success: true,
          added:
            nextUploads.length,
        };
      },
      [],
    );

  const startAll =
    useCallback(
      async () => {
        if (isUploading) {
          return;
        }

        const pending =
          uploads.filter(
            (upload) =>
              upload.status ===
                "READY" ||
              upload.status ===
                "ERROR",
          );

        if (
          pending.length ===
          0
        ) {
          return;
        }

        setIsUploading(
          true,
        );

        let nextFileIndex = 0;

        async function fileWorker() {
          while (true) {
            const index =
              nextFileIndex;

            nextFileIndex += 1;

            if (
              index >=
              pending.length
            ) {
              return;
            }

            await uploadOne(
              pending[index],
            );
          }
        }

        try {
          const fileWorkerCount =
            Math.min(
              CONCURRENT_FILE_UPLOADS,
              pending.length,
            );

          await Promise.all(
            Array.from(
              {
                length:
                  fileWorkerCount,
              },
              () =>
                fileWorker(),
            ),
          );
        } finally {
          setIsUploading(
            false,
          );
        }
      },
      [
        isUploading,
        uploads,
        uploadOne,
      ],
    );

  const cancelUpload =
    useCallback(
      (
        localId: string,
      ) => {
        cancelRefs.current[
          localId
        ] = true;
      },
      [],
    );

  const removeUpload =
    useCallback(
      (
        localId: string,
      ) => {
        setUploads(
          (current) =>
            current.filter(
              (upload) =>
                upload.localId !==
                localId ||
                upload.status ===
                  "STARTING" ||
                upload.status ===
                  "UPLOADING" ||
                upload.status ===
                  "COMPLETING",
            ),
        );
      },
      [],
    );

  const clearCompleted =
    useCallback(() => {
      setUploads(
        (current) =>
          current.filter(
            (upload) =>
              upload.status !==
                "DONE" &&
              upload.status !==
                "CANCELLED",
          ),
      );
    }, []);

  const clearQueue =
    useCallback(() => {
      setUploads(
        (current) =>
          current.filter(
            (upload) =>
              upload.status ===
                "STARTING" ||
              upload.status ===
                "UPLOADING" ||
              upload.status ===
                "COMPLETING",
          ),
      );
    }, []);

  const activeCount =
    useMemo(
      () =>
        uploads.filter(
          (upload) =>
            upload.status ===
              "STARTING" ||
            upload.status ===
              "UPLOADING" ||
            upload.status ===
              "COMPLETING",
        ).length,
      [uploads],
    );

  const completedCount =
    useMemo(
      () =>
        uploads.filter(
          (upload) =>
            upload.status ===
            "DONE",
        ).length,
      [uploads],
    );

  const overallProgress =
    useMemo(() => {
      if (
        uploads.length ===
        0
      ) {
        return 0;
      }

      const totalBytes =
        uploads.reduce(
          (
            total,
            upload,
          ) =>
            total +
            upload.file.size,
          0,
        );

      if (
        totalBytes <=
        0
      ) {
        return 0;
      }

      const uploadedBytes =
        uploads.reduce(
          (
            total,
            upload,
          ) =>
            total +
            Math.min(
              upload.uploadedBytes,
              upload.file.size,
            ),
          0,
        );

      return Math.min(
        100,
        Math.round(
          (uploadedBytes /
            totalBytes) *
            100,
        ),
      );
    }, [uploads]);

  const value =
    useMemo<
      UploadManagerContextValue
    >(
      () => ({
        uploads,
        isUploading,
        activeCount,
        completedCount,
        overallProgress,
        addFiles,
        startAll,
        cancelUpload,
        removeUpload,
        clearCompleted,
        clearQueue,
      }),
      [
        uploads,
        isUploading,
        activeCount,
        completedCount,
        overallProgress,
        addFiles,
        startAll,
        cancelUpload,
        removeUpload,
        clearCompleted,
        clearQueue,
      ],
    );

  return (
    <UploadManagerContext.Provider
      value={value}
    >
      {children}
    </UploadManagerContext.Provider>
  );
}

export function useUploadManager() {
  const context =
    useContext(
      UploadManagerContext,
    );

  if (!context) {
    throw new Error(
      "useUploadManager must be used inside UploadManagerProvider.",
    );
  }

  return context;
}
