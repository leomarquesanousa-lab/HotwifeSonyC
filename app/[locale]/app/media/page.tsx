"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  FileText,
  FileVideo2,
  Folder,
  FolderPlus,
  Grid2X2,
  List,
  Loader2,
  MoreVertical,
  Move,
  Pencil,
  Eye,
  RefreshCw,
  Play,
  Plus,
  Search,
  Send,
  Share2,
  Tag,
  Trash2,
  UploadCloud,
  Video,
  X,
} from "lucide-react";

import {
  ManagedUpload,
  useUploadManager,
} from "@/src/components/app/UploadManagerProvider";

type MediaAsset = {
  id: string;
  creatorId: string;
  folderId: string | null;
  originalFileName: string;
  objectKey: string;
  bucketName: string;
  storageProvider: string;
  contentType: string;
  fileSize: string;
  mediaType: string;
  status: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  thumbnailObjectKey: string | null;
  objectEtag: string | null;
  uploadCompletedAt: string | null;
  processingStartedAt: string | null;
  processingCompletedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type MediaResponse = {
  success: boolean;
  media?: MediaAsset[];
  total?: number;
  error?: string;
};

type PreviewResponse = {
  success: boolean;
  mediaId?: string;
  previewUrl?: string;
  expiresIn?: number;
  error?: string;
};

type MediaCategory = {
  id: string;
  name: string;
  normalizedName: string;
  createdAt?: string;
};

type CategoriesResponse = {
  success: boolean;
  categories?: MediaCategory[];
  error?: string;
  message?: string;
};

type CategoryAssignmentResponse = {
  success: boolean;
  category?: MediaCategory;
  categories?: MediaCategory[];
  error?: string;
  message?: string;
};

type Performer = {
  id: string;
  displayName: string;
};

type PerformersResponse = {
  success: boolean;
  performers?: Performer[];
  error?: string;
};


type PerformerDocument = {
  id: string;
  documentType: string;
  title: string;
  status: string;
  contentType: string;
  fileSize: number;
  documentNumber: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type PerformerDocumentsResponse = {
  success: boolean;
  documents?: PerformerDocument[];
  error?: string;
  message?: string;
};


type Agreement = {
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
};

type AgreementsResponse = {
  success: boolean;
  agreements?: Agreement[];
  error?: string;
  message?: string;
};

type DocumentFilter =
  | "ALL"
  | "CONTRACT"
  | "PHOTO_ID"
  | "PROOF_OF_ADDRESS"
  | "RELEASE_FORM"
  | "TEST_RESULT"
  | "OTHER";

type LibraryFolder = {
  id: string;
  parentId: string | null;
  name: string;
  normalizedName: string;
  folderType: string;
  systemKey: string | null;
  isSystem: boolean;
  isRequired: boolean;
  sortOrder: number;
  status: string;
};

type PerformerLibraryResponse = {
  success: boolean;
  folders?: LibraryFolder[];
  error?: string;
};


type FolderDialogMode =
  | "CREATE"
  | "RENAME"
  | "MOVE"
  | "DELETE";

type FolderDialogState = {
  mode: FolderDialogMode;
  folder: LibraryFolder;
};

type FolderMutationResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  folder?: LibraryFolder;
  counts?: {
    files?: number;
    subfolders?: number;
    protectedFiles?: number;
  };
  deletedFolderId?: string;
  movedToFolderId?: string;
};

const MAX_FILES_PER_BATCH = 10;
const CONCURRENT_FILE_UPLOADS = 3;

export default function MediaLibraryPage() {
  const t = useTranslations("mediaLibrary");
  const locale = useLocale();

  const inputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const pendingFileTargetFolderIdRef =
    useRef<string | null>(null);

  const {
    uploads,
    isUploading,
    addFiles,
    startAll,
    cancelUpload,
    removeUpload,
    clearQueue,
  } = useUploadManager();

  const [media, setMedia] =
    useState<MediaAsset[]>([]);

  const [performers, setPerformers] =
    useState<Performer[]>([]);

  const [selectedPerformerId, setSelectedPerformerId] =
    useState("");


  const [
    librarySection,
    setLibrarySection,
  ] = useState<
    "MEDIA" | "DOCUMENTS"
  >("MEDIA");

  const [
    documents,
    setDocuments,
  ] = useState<
    PerformerDocument[]
  >([]);


  const [
    agreements,
    setAgreements,
  ] = useState<
    Agreement[]
  >([]);

  const [
    isLoadingDocuments,
    setIsLoadingDocuments,
  ] = useState(false);

  const [
    documentFilter,
    setDocumentFilter,
  ] = useState<
    DocumentFilter
  >("ALL");

  const [
    documentSearch,
    setDocumentSearch,
  ] = useState("");


  const [
    selectedAgreement,
    setSelectedAgreement,
  ] = useState<
    Agreement | null
  >(null);

  const [folders, setFolders] =
    useState<LibraryFolder[]>([]);

  const [selectedFolderId, setSelectedFolderId] =
    useState("ALL");

  const [dragOverFolderId, setDragOverFolderId] =
    useState<string | null>(null);


  const [openFolderMenuId, setOpenFolderMenuId] =
    useState<string | null>(null);


  useEffect(() => {
    if (!openFolderMenuId) {
      return;
    }

    function handlePointerDown(
      event: MouseEvent,
    ) {
      const target =
        event.target as HTMLElement | null;

      if (
        target?.closest(
          '[data-folder-menu-root="true"]',
        )
      ) {
        return;
      }

      setOpenFolderMenuId(
        null,
      );
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key ===
        "Escape"
      ) {
        setOpenFolderMenuId(
          null,
        );
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown,
    );

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    openFolderMenuId,
  ]);

  const [folderDialog, setFolderDialog] =
    useState<FolderDialogState | null>(null);

  const [folderNameInput, setFolderNameInput] =
    useState("");

  const [moveDestinationId, setMoveDestinationId] =
    useState("");

  const [deleteMode, setDeleteMode] =
    useState<"MOVE" | "DELETE_ALL">("MOVE");

  const [deleteConfirmation, setDeleteConfirmation] =
    useState("");

  const [isFolderActionBusy, setIsFolderActionBusy] =
    useState(false);


  const [mobileBrowserFolderId, setMobileBrowserFolderId] =
    useState<string | null>(null);

  const [isLoadingPerformers, setIsLoadingPerformers] =
    useState(true);

  const [isLoadingFolders, setIsLoadingFolders] =
    useState(false);

  const [
    previewUrls,
    setPreviewUrls,
  ] = useState<
    Record<string, string>
  >({});

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    pageError,
    setPageError,
  ] = useState("");

  const [
    pageSuccess,
    setPageSuccess,
  ] = useState("");

  const [
    deletingMediaId,
    setDeletingMediaId,
  ] = useState<
    string | null
  >(null);

  const [
    categories,
    setCategories,
  ] = useState<
    MediaCategory[]
  >([]);

  const [
    mediaCategories,
    setMediaCategories,
  ] = useState<
    Record<
      string,
      MediaCategory[]
    >
  >({});

  const [
    selectedCategoryId,
    setSelectedCategoryId,
  ] = useState("ALL");

  const [
    categoryMedia,
    setCategoryMedia,
  ] = useState<
    MediaAsset | null
  >(null);

  const [
    viewerMedia,
    setViewerMedia,
  ] = useState<
    MediaAsset | null
  >(null);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    filter,
    setFilter,
  ] = useState<
    "ALL" | "VIDEO" | "READY"
  >("ALL");

  const [
    viewMode,
    setViewMode,
  ] = useState<
    "GRID" | "LIST"
  >("GRID");

  const loadPerformers =
    useCallback(
      async () => {
        try {
          setIsLoadingPerformers(true);

          const response =
            await fetch(
              "/api/performers",
              {
                method: "GET",
                cache: "no-store",
              },
            );

          const data =
            (await response.json()) as PerformersResponse;

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.error ||
                "Unable to load performers.",
            );
          }

          setPerformers(
            data.performers ?? [],
          );
        } catch (error) {
          console.error(
            "MEDIA_PERFORMERS_LOAD_ERROR",
            error,
          );

          setPageError(
            "Unable to load performers.",
          );
        } finally {
          setIsLoadingPerformers(false);
        }
      },
      [],
    );

  const loadFolders =
    useCallback(
      async (
        performerId: string,
      ) => {
        if (!performerId) {
          setFolders([]);
          setSelectedFolderId("ALL");
          return;
        }

        try {
          setIsLoadingFolders(true);

          const response =
            await fetch(
              `/api/performer-library?performerId=${encodeURIComponent(
                performerId,
              )}`,
              {
                method: "GET",
                cache: "no-store",
              },
            );

          const data =
            (await response.json()) as PerformerLibraryResponse;

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.error ||
                "Unable to load performer library.",
            );
          }

          setFolders(
            data.folders ?? [],
          );
        } catch (error) {
          console.error(
            "PERFORMER_LIBRARY_LOAD_ERROR",
            error,
          );

          setFolders([]);
          setPageError(
            "Unable to load performer library.",
          );
        } finally {
          setIsLoadingFolders(false);
        }
      },
      [],
    );

  const loadPreviews =
    useCallback(
      async (
        items: MediaAsset[],
      ) => {
        const uploadedItems =
          items.filter(
            (item) =>
              item.status ===
              "UPLOADED",
          );

        const entries =
          await Promise.all(
            uploadedItems.map(
              async (item) => {
                try {
                  const response =
                    await fetch(
                      `/api/media/${item.id}/preview`,
                      {
                        method:
                          "GET",
                        cache:
                          "no-store",
                      },
                    );

                  const data =
                    (await response.json()) as PreviewResponse;

                  if (
                    !response.ok ||
                    !data.success ||
                    !data.previewUrl
                  ) {
                    return null;
                  }

                  return [
                    item.id,
                    data.previewUrl,
                  ] as const;
                } catch {
                  return null;
                }
              },
            ),
          );

        const nextPreviews:
          Record<
            string,
            string
          > = {};

        for (
          const entry of entries
        ) {
          if (!entry) {
            continue;
          }

          nextPreviews[
            entry[0]
          ] = entry[1];
        }

        setPreviewUrls(
          nextPreviews,
        );
      },
      [],
    );

  const loadCategories =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              "/api/media/categories",
              {
                method:
                  "GET",
                cache:
                  "no-store",
              },
            );

          const data =
            (await response.json()) as CategoriesResponse;

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.message ||
                data.error ||
                t(
                  "unableToLoadCategories",
                ),
            );
          }

          setCategories(
            data.categories ??
              [],
          );
        } catch (
          error
        ) {
          console.error(
            "MEDIA_CATEGORIES_LOAD_ERROR",
            error,
          );
        }
      },
      [
        t,
      ],
    );

  const loadMediaCategories =
    useCallback(
      async (
        items: MediaAsset[],
      ) => {
        const entries =
          await Promise.all(
            items.map(
              async (item) => {
                try {
                  const response =
                    await fetch(
                      `/api/media/${item.id}/categories`,
                      {
                        method:
                          "GET",
                        cache:
                          "no-store",
                      },
                    );

                  const data =
                    (await response.json()) as CategoryAssignmentResponse;

                  if (
                    !response.ok ||
                    !data.success
                  ) {
                    return [
                      item.id,
                      [] as MediaCategory[],
                    ] as const;
                  }

                  return [
                    item.id,
                    data.categories ??
                      ([] as MediaCategory[]),
                  ] as const;
                } catch {
                  return [
                    item.id,
                    [] as MediaCategory[],
                  ] as const;
                }
              },
            ),
          );

        const next:
          Record<
            string,
            MediaCategory[]
          > = {};

        for (
          const [
            mediaId,
            assigned,
          ] of entries
        ) {
          next[
            mediaId
          ] = assigned;
        }

        setMediaCategories(
          next,
        );
      },
      [],
    );

  const loadMedia =
    useCallback(
      async () => {
        if (!selectedPerformerId) {
          setMedia([]);
          setPreviewUrls({});
          setMediaCategories({});
          setIsLoading(false);
          return;
        }

        try {
          setIsLoading(true);
          setPageError("");

          const response =
            await fetch(
              `/api/media?performerId=${encodeURIComponent(
                selectedPerformerId,
              )}`,
              {
                method: "GET",
                cache: "no-store",
              },
            );

          const data =
            (await response.json()) as MediaResponse;

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.error ||
                t(
                  "unableToLoadLibrary",
                ),
            );
          }

          const items =
            data.media ?? [];

          setMedia(items);

          void loadPreviews(items);
          void loadMediaCategories(items);
        } catch (error) {
          console.error(
            "MEDIA_LIBRARY_LOAD_ERROR",
            error,
          );

          setPageError(
            t(
              "unableToLoadLibrary",
            ),
          );
        } finally {
          setIsLoading(false);
        }
      },
      [
        loadMediaCategories,
        loadPreviews,
        selectedPerformerId,
        t,
      ],
    );

  useEffect(() => {
    void loadPerformers();
    void loadCategories();
  }, [
    loadCategories,
    loadPerformers,
  ]);

  useEffect(() => {
    setSelectedFolderId("ALL");
    setPageSuccess("");
    setPageError("");

    void loadFolders(
      selectedPerformerId,
    );
    void loadMedia();
  }, [
    loadFolders,
    loadMedia,
    selectedPerformerId,
  ]);

  useEffect(() => {
    function handleMediaUpdated() {
      void loadMedia();
    }

    window.addEventListener(
      "creator-platform:media-updated",
      handleMediaUpdated,
    );

    return () => {
      window.removeEventListener(
        "creator-platform:media-updated",
        handleMediaUpdated,
      );
    };
  }, [
    loadMedia,
  ]);

  useEffect(() => {
    if (isUploading) {
      return;
    }

    const hasReadyUploads =
      uploads.some(
        (upload) =>
          upload.status ===
          "READY",
      );

    if (!hasReadyUploads) {
      return;
    }

    void startAll();
  }, [
    uploads,
    isUploading,
    startAll,
  ]);

  const readyCount =
    useMemo(
      () =>
        media.filter(
          (item) =>
            item.status ===
            "UPLOADED",
        ).length,
      [
        media,
      ],
    );

  const filteredMedia =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return media.filter(
        (item) => {
          if (
            filter ===
              "READY" &&
            item.status !==
              "UPLOADED"
          ) {
            return false;
          }

          if (
            filter ===
              "VIDEO" &&
            item.mediaType !==
              "VIDEO"
          ) {
            return false;
          }

          if (
            selectedCategoryId !==
              "ALL" &&
            !(
              mediaCategories[
                item.id
              ] ??
              []
            ).some(
              (
                category,
              ) =>
                category.id ===
                selectedCategoryId,
            )
          ) {
            return false;
          }

          if (
            selectedFolderId !==
              "ALL" &&
            item.folderId !==
              selectedFolderId
          ) {
            return false;
          }

          if (
            query &&
            !item.originalFileName
              .toLowerCase()
              .includes(
                query,
              )
          ) {
            return false;
          }

          return true;
        },
      );
    }, [
      media,
      filter,
      mediaCategories,
      search,
      selectedCategoryId,
      selectedFolderId,
    ]);

  const loadDocuments =
    useCallback(
      async (
        performerId =
          selectedPerformerId,
      ) => {
        if (!performerId) {
          setDocuments(
            [],
          );
          return;
        }

        try {
          setIsLoadingDocuments(
            true,
          );

          setPageError(
            "",
          );

          const response =
            await fetch(
              `/api/performers/${encodeURIComponent(
                performerId,
              )}/documents`,
              {
                method:
                  "GET",
                cache:
                  "no-store",
              },
            );

          const data =
            (await response.json()) as PerformerDocumentsResponse;

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.message ||
                data.error ||
                "Unable to load documents.",
            );
          }

          setDocuments(
            data.documents ??
              [],
          );
        } catch (error) {
          console.error(
            "MEDIA_PERFORMER_DOCUMENTS_LOAD_ERROR",
            error,
          );

          setDocuments(
            [],
          );

          setPageError(
            error instanceof
              Error
              ? error.message
              : "Unable to load documents.",
          );
        } finally {
          setIsLoadingDocuments(
            false,
          );
        }
      },
      [
        selectedPerformerId,
      ],
    );

  const loadAgreements =
    useCallback(
      async (
        performerId =
          selectedPerformerId,
      ) => {
        if (!performerId) {
          setAgreements(
            [],
          );
          return;
        }

        try {
          const response =
            await fetch(
              `/api/performers/${encodeURIComponent(
                performerId,
              )}/agreements`,
              {
                method:
                  "GET",
                cache:
                  "no-store",
              },
            );

          const data =
            (await response.json()) as AgreementsResponse;

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.message ||
                data.error ||
                "Unable to load contracts.",
            );
          }

          setAgreements(
            data.agreements ??
              [],
          );
        } catch (error) {
          console.error(
            "MEDIA_PERFORMER_AGREEMENTS_LOAD_ERROR",
            error,
          );

          setAgreements(
            [],
          );

          setPageError(
            error instanceof Error
              ? error.message
              : "Unable to load contracts.",
          );
        }
      },
      [
        selectedPerformerId,
      ],
    );


  useEffect(() => {
    setDocuments(
      [],
    );

    setAgreements(
      [],
    );

    setSelectedAgreement(
      null,
    );

    setDocumentFilter(
      "ALL",
    );

    setDocumentSearch(
      "",
    );

    if (
      librarySection ===
        "DOCUMENTS" &&
      selectedPerformerId
    ) {
      void Promise.all([
        loadDocuments(
          selectedPerformerId,
        ),
        loadAgreements(
          selectedPerformerId,
        ),
      ]);
    }
  }, [
    selectedPerformerId,
    librarySection,
    loadDocuments,
    loadAgreements,
  ]);

  const filteredDocuments =
    useMemo(() => {
      const query =
        documentSearch
          .trim()
          .toLowerCase();

      return documents.filter(
        (
          document,
        ) => {
          if (
            documentFilter ===
              "CONTRACT"
          ) {
            return false;
          }

          if (
            documentFilter !==
              "ALL" &&
            document.documentType !==
              documentFilter
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          return [
            document.title,
            document.documentType,
            document.documentNumber ??
              "",
            document.notes ??
              "",
          ].some(
            (
              value,
            ) =>
              value
                .toLowerCase()
                .includes(
                  query,
                ),
          );
        },
      );
    }, [
      documents,
      documentFilter,
      documentSearch,
    ]);


  const filteredAgreements =
    useMemo(() => {
      const query =
        documentSearch
          .trim()
          .toLowerCase();

      if (
        documentFilter !==
          "ALL" &&
        documentFilter !==
          "CONTRACT"
      ) {
        return [];
      }

      return agreements.filter(
        (
          agreement,
        ) => {
          if (!query) {
            return true;
          }

          return [
            agreement.contentDescription,
            agreement.coPerformerLegalName,
            agreement.uploaderLegalName,
            agreement.agreementType,
            agreement.status,
          ].some(
            (
              value,
            ) =>
              value
                .toLowerCase()
                .includes(
                  query,
                ),
          );
        },
      );
    }, [
      agreements,
      documentFilter,
      documentSearch,
    ]);

  async function getDocumentUrl(
    documentId: string,
  ) {
    if (
      !selectedPerformerId
    ) {
      throw new Error(
        "Select a performer first.",
      );
    }

    const response =
      await fetch(
        `/api/performers/${encodeURIComponent(
          selectedPerformerId,
        )}/documents/${encodeURIComponent(
          documentId,
        )}`,
        {
          method:
            "GET",
          cache:
            "no-store",
        },
      );

    const data =
      (await response.json()) as {
        success: boolean;
        url?: string;
        error?: string;
        message?: string;
      };

    if (
      !response.ok ||
      !data.success ||
      !data.url
    ) {
      throw new Error(
        data.message ||
          data.error ||
          "Unable to open document.",
      );
    }

    return data.url;
  }

  async function openDocument(
    documentId: string,
  ) {
    try {
      setPageError(
        "",
      );

      const url =
        await getDocumentUrl(
          documentId,
        );

      window.open(
        url,
        "_blank",
        "noopener,noreferrer",
      );
    } catch (error) {
      setPageError(
        error instanceof
          Error
          ? error.message
          : "Unable to open document.",
      );
    }
  }

  async function shareDocument(
    document: PerformerDocument,
  ) {
    try {
      setPageError(
        "",
      );

      setPageSuccess(
        "",
      );

      const url =
        await getDocumentUrl(
          document.id,
        );

      if (
        typeof navigator.share ===
        "function"
      ) {
        await navigator.share({
          title:
            document.title ||
            "Performer document",
          url,
        });

        return;
      }

      await navigator.clipboard.writeText(
        url,
      );

      setPageSuccess(
        "Secure document link copied. The link expires in 10 minutes.",
      );
    } catch (error) {
      if (
        error instanceof
          DOMException &&
        error.name ===
          "AbortError"
      ) {
        return;
      }

      setPageError(
        error instanceof
          Error
          ? error.message
          : "Unable to share document.",
      );
    }
  }

  const rootFolders =
    useMemo(
      () =>
        folders
          .filter(
            (folder) =>
              folder.parentId ===
              null,
          )
          .sort(
            (a, b) =>
              a.sortOrder -
              b.sortOrder,
          ),
      [folders],
    );

  const selectedPerformer =
    useMemo(
      () =>
        performers.find(
          (performer) =>
            performer.id ===
            selectedPerformerId,
        ) ?? null,
      [
        performers,
        selectedPerformerId,
      ],
    );

  function chooseFile(
    targetFolderId?: string,
  ) {
    setLibrarySection(
      "MEDIA",
    );

    const folderId =
      targetFolderId ??
      selectedFolderId;

    if (
      !selectedPerformerId ||
      !folderId ||
      folderId === "ALL"
    ) {
      setPageError(
        "Select a performer and a destination folder first.",
      );
      return;
    }

    pendingFileTargetFolderIdRef.current =
      folderId;

    setSelectedFolderId(
      folderId,
    );

    inputRef.current?.click();
  }

  function queueFilesToFolder(
    files: File[],
    folderId: string,
  ) {
    setPageError(
      "",
    );
    setPageSuccess(
      "",
    );

    if (
      !selectedPerformerId
    ) {
      setPageError(
        "Select a performer first.",
      );
      return;
    }

    if (
      !folderId ||
      folderId === "ALL"
    ) {
      setPageError(
        "Choose a destination folder first.",
      );
      return;
    }

    if (
      files.length ===
      0
    ) {
      return;
    }

    if (
      files.length >
      MAX_FILES_PER_BATCH
    ) {
      setPageError(
        t(
          "maxVideosAtATime",
          {
            count:
              MAX_FILES_PER_BATCH,
          },
        ),
      );

      return;
    }

    const result =
      addFiles(
        files,
        {
          performerId:
            selectedPerformerId,
          folderId,
        },
      );

    if (
      !result.success
    ) {
      setPageError(
        result.error ||
          t(
            "unableToAddVideos",
          ),
      );

      return;
    }

    setSelectedFolderId(
      folderId,
    );

    setPageSuccess(
      "",
    );
  }

  function onFileSelected(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files =
      Array.from(
        event.target
          .files ??
          [],
      );

    event.target.value =
      "";

    const targetFolderId =
      pendingFileTargetFolderIdRef.current ??
      selectedFolderId;

    pendingFileTargetFolderIdRef.current =
      null;

    queueFilesToFolder(
      files,
      targetFolderId,
    );
  }

  async function startUploadBatch() {
    setPageError(
      "",
    );
    setPageSuccess(
      "",
    );

    await startAll();
  }

  function clearUploadQueue() {
    clearQueue();
    setPageError(
      "",
    );
    setPageSuccess(
      "",
    );
  }

  useEffect(() => {
    setMobileBrowserFolderId(
      null,
    );
  }, [
    selectedPerformerId,
  ]);

  function folderLabel(
    folder: LibraryFolder,
  ) {
    if (
      folder.systemKey ===
      "SAFE"
    ) {
      return "SAFE FOR WORK";
    }

    if (
      folder.systemKey ===
      "UNSAFE"
    ) {
      return "NOT SAFE FOR WORK";
    }

    return folder.name;
  }

  function collectFolderSubtreeIds(
    folderId: string,
  ) {
    const ids =
      new Set<string>([
        folderId,
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
          ids.has(
            folder.parentId,
          ) &&
          !ids.has(
            folder.id,
          )
        ) {
          ids.add(
            folder.id,
          );

          changed =
            true;
        }
      }
    }

    return ids;
  }

  function openCreateFolderDialog(
    parent: LibraryFolder,
  ) {
    setOpenFolderMenuId(
      null,
    );

    setFolderNameInput(
      "",
    );

    setMoveDestinationId(
      "",
    );

    setDeleteConfirmation(
      "",
    );

    setFolderDialog({
      mode:
        "CREATE",
      folder:
        parent,
    });
  }

  function openRenameFolderDialog(
    folder: LibraryFolder,
  ) {
    setOpenFolderMenuId(
      null,
    );

    setFolderNameInput(
      folder.name,
    );

    setMoveDestinationId(
      "",
    );

    setDeleteConfirmation(
      "",
    );

    setFolderDialog({
      mode:
        "RENAME",
      folder,
    });
  }

  function openMoveFolderDialog(
    folder: LibraryFolder,
  ) {
    setOpenFolderMenuId(
      null,
    );

    setFolderNameInput(
      "",
    );

    setMoveDestinationId(
      "",
    );

    setDeleteConfirmation(
      "",
    );

    setFolderDialog({
      mode:
        "MOVE",
      folder,
    });
  }

  function openDeleteFolderDialog(
    folder: LibraryFolder,
  ) {
    setOpenFolderMenuId(
      null,
    );

    setFolderNameInput(
      "",
    );

    setMoveDestinationId(
      "",
    );

    setDeleteMode(
      "MOVE",
    );

    setDeleteConfirmation(
      "",
    );

    setFolderDialog({
      mode:
        "DELETE",
      folder,
    });
  }

  function closeFolderDialog() {
    if (
      isFolderActionBusy
    ) {
      return;
    }

    setFolderDialog(
      null,
    );

    setFolderNameInput(
      "",
    );

    setMoveDestinationId(
      "",
    );

    setDeleteConfirmation(
      "",
    );
  }

  async function refreshFolderLibrary(
    preferredFolderId?: string,
  ) {
    await loadFolders(
      selectedPerformerId,
    );

    await loadMedia();

    if (
      preferredFolderId
    ) {
      setSelectedFolderId(
        preferredFolderId,
      );
    }
  }

  async function createFolder() {
    if (
      !folderDialog ||
      folderDialog.mode !==
        "CREATE"
    ) {
      return;
    }

    const name =
      folderNameInput.trim();

    if (!name) {
      setPageError(
        "Enter a folder name.",
      );
      return;
    }

    try {
      setIsFolderActionBusy(
        true,
      );

      setPageError(
        "",
      );

      setPageSuccess(
        "",
      );

      const response =
        await fetch(
          "/api/performer-library",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                performerId:
                  selectedPerformerId,
                parentId:
                  folderDialog.folder.id,
                name,
              }),
          },
        );

      const data =
        (await response.json()) as FolderMutationResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to create folder.",
        );
      }

      setFolderDialog(
        null,
      );

      setFolderNameInput(
        "",
      );

      setPageSuccess(
        `Folder "${name}" created.`,
      );

      await refreshFolderLibrary();
    } catch (error) {
      setPageError(
        error instanceof
          Error
          ? error.message
          : "Unable to create folder.",
      );
    } finally {
      setIsFolderActionBusy(
        false,
      );
    }
  }

  async function renameFolder() {
    if (
      !folderDialog ||
      folderDialog.mode !==
        "RENAME"
    ) {
      return;
    }

    const name =
      folderNameInput.trim();

    if (!name) {
      setPageError(
        "Enter a folder name.",
      );
      return;
    }

    try {
      setIsFolderActionBusy(
        true,
      );

      setPageError(
        "",
      );

      setPageSuccess(
        "",
      );

      const response =
        await fetch(
          "/api/performer-library",
          {
            method:
              "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                performerId:
                  selectedPerformerId,
                folderId:
                  folderDialog.folder.id,
                action:
                  "RENAME",
                name,
              }),
          },
        );

      const data =
        (await response.json()) as FolderMutationResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to rename folder.",
        );
      }

      const folderId =
        folderDialog.folder.id;

      setFolderDialog(
        null,
      );

      setFolderNameInput(
        "",
      );

      setPageSuccess(
        `Folder renamed to "${name}". Files were not moved.`,
      );

      await refreshFolderLibrary(
        folderId,
      );
    } catch (error) {
      setPageError(
        error instanceof
          Error
          ? error.message
          : "Unable to rename folder.",
      );
    } finally {
      setIsFolderActionBusy(
        false,
      );
    }
  }

  async function moveFolder() {
    if (
      !folderDialog ||
      folderDialog.mode !==
        "MOVE"
    ) {
      return;
    }

    if (
      !moveDestinationId
    ) {
      setPageError(
        "Choose a destination folder.",
      );
      return;
    }

    try {
      setIsFolderActionBusy(
        true,
      );

      setPageError(
        "",
      );

      setPageSuccess(
        "",
      );

      const response =
        await fetch(
          "/api/performer-library",
          {
            method:
              "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                performerId:
                  selectedPerformerId,
                folderId:
                  folderDialog.folder.id,
                action:
                  "MOVE",
                parentId:
                  moveDestinationId,
              }),
          },
        );

      const data =
        (await response.json()) as FolderMutationResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to move folder.",
        );
      }

      const folderId =
        folderDialog.folder.id;

      setFolderDialog(
        null,
      );

      setMoveDestinationId(
        "",
      );

      setPageSuccess(
        "Folder moved. Files and subfolders remained attached.",
      );

      await refreshFolderLibrary(
        folderId,
      );
    } catch (error) {
      setPageError(
        error instanceof
          Error
          ? error.message
          : "Unable to move folder.",
      );
    } finally {
      setIsFolderActionBusy(
        false,
      );
    }
  }

  async function deleteFolder() {
    if (
      !folderDialog ||
      folderDialog.mode !==
        "DELETE"
    ) {
      return;
    }

    const subtreeIds =
      collectFolderSubtreeIds(
        folderDialog.folder.id,
      );

    const subfolderCount =
      [...subtreeIds].filter(
        (
          id,
        ) =>
          id !==
          folderDialog.folder.id,
      ).length;

    const fileCount =
      media.filter(
        (
          item,
        ) =>
          Boolean(
            item.folderId &&
            subtreeIds.has(
              item.folderId,
            ),
          ),
      ).length;

    const isEmpty =
      fileCount ===
        0 &&
      subfolderCount ===
        0;

    if (
      !isEmpty &&
      deleteMode ===
        "MOVE" &&
      !moveDestinationId
    ) {
      setPageError(
        "Choose where the folder contents should be moved.",
      );
      return;
    }

    if (
      !isEmpty &&
      deleteMode ===
        "DELETE_ALL" &&
      deleteConfirmation !==
        "DELETE"
    ) {
      setPageError(
        'Type "DELETE" exactly to confirm permanent deletion.',
      );
      return;
    }

    try {
      setIsFolderActionBusy(
        true,
      );

      setPageError(
        "",
      );

      setPageSuccess(
        "",
      );

      const response =
        await fetch(
          "/api/performer-library",
          {
            method:
              "DELETE",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                performerId:
                  selectedPerformerId,
                folderId:
                  folderDialog.folder.id,
                mode:
                  isEmpty
                    ? "EMPTY"
                    : deleteMode,
                destinationFolderId:
                  deleteMode ===
                    "MOVE"
                    ? moveDestinationId
                    : undefined,
                confirmation:
                  deleteMode ===
                    "DELETE_ALL"
                    ? deleteConfirmation
                    : undefined,
              }),
          },
        );

      const data =
        (await response.json()) as FolderMutationResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to delete folder.",
        );
      }

      const deletedFolderId =
        folderDialog.folder.id;

      setFolderDialog(
        null,
      );

      setMoveDestinationId(
        "",
      );

      setDeleteConfirmation(
        "",
      );

      if (
        selectedFolderId ===
        deletedFolderId
      ) {
        setSelectedFolderId(
          "ALL",
        );
      }

      setPageSuccess(
        isEmpty
          ? "Empty folder deleted."
          : deleteMode ===
              "MOVE"
          ? "Folder deleted and its contents were moved."
          : "Folder and all permitted contents were permanently deleted.",
      );

      await refreshFolderLibrary();
    } catch (error) {
      setPageError(
        error instanceof
          Error
          ? error.message
          : "Unable to delete folder.",
      );
    } finally {
      setIsFolderActionBusy(
        false,
      );
    }
  }

  async function removeMedia(
    item: MediaAsset,
  ) {
    const confirmed =
      window.confirm(
        t(
          "removeConfirm",
          {
            fileName:
              item.originalFileName,
          },
        ),
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      setPageError(
        "",
      );
      setPageSuccess(
        "",
      );

      setDeletingMediaId(
        item.id,
      );

      const response =
        await fetch(
          `/api/media/${item.id}`,
          {
            method:
              "DELETE",
          },
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          error?: string;
          message?: string;
          deletedFileName?: string;
        };

      if (
        !response.ok ||
        !data.success
      ) {
        if (
          data.error ===
          "MEDIA_HAS_PUBLICATION_HISTORY"
        ) {
          throw new Error(
            data.message ||
              t(
                "hasPublicationHistory",
              ),
          );
        }

        throw new Error(
          data.message ||
            data.error ||
            t(
              "unableToRemoveVideo",
            ),
        );
      }

      setPageSuccess(
        t(
          "removedSuccessfully",
          {
            fileName:
              data.deletedFileName ||
              item.originalFileName,
          },
        ),
      );

      setPreviewUrls(
        (
          current,
        ) => {
          const next =
            {
              ...current,
            };

          delete next[
            item.id
          ];

          return next;
        },
      );

      await loadMedia();
    } catch (
      error
    ) {
      console.error(
        "MEDIA_REMOVE_ERROR",
        error,
      );

      setPageError(
        error instanceof
          Error
          ? error.message
          : t(
              "unableToRemoveVideo",
            ),
      );
    } finally {
      setDeletingMediaId(
        null,
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#080b12] text-white">
      <input
        ref={
          inputRef
        }
        type="file"
        multiple
        accept="video/mp4,video/quicktime,video/x-m4v,image/jpeg,image/png,image/webp,.mp4,.mov,.m4v,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={
          onFileSelected
        }
      />

      <div className="mx-auto w-full max-w-[1540px] px-5 py-6 sm:px-7 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035]">
              <FileVideo2 className="h-4.5 w-4.5 text-blue-300" />
            </div>

            <div>
              <h1 className="text-[28px] font-semibold tracking-[-0.04em]">
                {t(
                  "title",
                )}
              </h1>

              <p className="mt-0.5 text-xs text-white/35">
                {t(
                  "description",
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              chooseFile()
            }
            disabled={
              !selectedPerformerId ||
              librarySection !==
                "MEDIA" ||
              selectedFolderId ===
                "ALL"
            }
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-2.5 text-xs font-semibold text-white shadow-[0_10px_30px_rgba(99,102,241,0.16)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UploadCloud className="h-4 w-4" />

            {t(
              "selectVideos",
            )}
          </button>
        </div>

        {uploads.length >
          0 && (
          <UploadQueuePanel
            uploads={
              uploads
            }
            isUploading={
              isUploading
            }
            onStart={() =>
              void startUploadBatch()
            }
            onCancel={
              cancelUpload
            }
            onRemove={
              removeUpload
            }
            onClear={
              clearUploadQueue
            }
          />
        )}

        <div className="mb-5 rounded-[18px] border border-white/[0.08] bg-white/[0.018] p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full max-w-[420px]">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                Performer
              </div>

              <select
                value={
                  selectedPerformerId
                }
                onChange={(
                  event,
                ) =>
                  setSelectedPerformerId(
                    event.target.value,
                  )
                }
                disabled={
                  isLoadingPerformers
                }
                className="w-full rounded-xl border border-white/[0.08] bg-[#0c1119] px-3 py-2.5 text-xs text-white outline-none focus:border-blue-500/40 disabled:opacity-50"
              >
                <option value="">
                  {isLoadingPerformers
                    ? "Loading performers..."
                    : "Select performer"}
                </option>

                {performers.map(
                  (performer) => (
                    <option
                      key={
                        performer.id
                      }
                      value={
                        performer.id
                      }
                    >
                      {performer.displayName}
                    </option>
                  ),
                )}
              </select>
            </div>

            {selectedPerformer && (
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.12em] text-white/25">
                  Current library
                </div>
                <div className="mt-1 text-sm font-semibold text-white/80">
                  {selectedPerformer.displayName}
                </div>
              </div>
            )}
          </div>

          {!selectedPerformerId ? (
            <div className="mt-4 rounded-xl border border-dashed border-white/[0.08] bg-black/[0.08] px-4 py-5 text-center text-xs text-white/30">
              Select a performer to open their media library.
            </div>
          ) : isLoadingFolders ? (
            <div className="mt-4 flex items-center gap-2 text-xs text-white/30">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading folders...
            </div>
          ) : (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => {
                  setLibrarySection(
                    "MEDIA",
                  );
                  setSelectedFolderId(
                    "ALL",
                  );
                }}
                className={`mb-3 rounded-lg border px-3 py-2 text-[10px] font-semibold transition ${
                  librarySection ===
                    "MEDIA" &&
                  selectedFolderId ===
                    "ALL"
                    ? "border-blue-500/35 bg-blue-500/[0.09] text-blue-200"
                    : "border-white/[0.07] bg-white/[0.02] text-white/40 hover:text-white"
                }`}
              >
                All media
              </button>

              <ProfessionalFolderBrowser
                rootFolders={
                  rootFolders
                }
                folders={
                  folders
                }
                selectedFolderId={
                  selectedFolderId
                }
                librarySection={
                  librarySection
                }
                documents={
                  documents
                }
                agreements={
                  agreements
                }
                filteredDocuments={
                  filteredDocuments
                }
                filteredAgreements={
                  filteredAgreements
                }
                onSelectAgreement={
                  setSelectedAgreement
                }
                isLoadingDocuments={
                  isLoadingDocuments
                }
                documentFilter={
                  documentFilter
                }
                documentSearch={
                  documentSearch
                }
                onDocumentFilterChange={
                  setDocumentFilter
                }
                onDocumentSearchChange={
                  setDocumentSearch
                }
                onSelectDocuments={() => {
                  setLibrarySection(
                    "DOCUMENTS",
                  );
                  setOpenFolderMenuId(
                    null,
                  );
                }}
                onRefreshDocuments={() =>
                  void Promise.all([
                    loadDocuments(),
                    loadAgreements(),
                  ])
                }
                onOpenDocument={
                  openDocument
                }
                onShareDocument={
                  shareDocument
                }
                dragOverFolderId={
                  dragOverFolderId
                }
                openFolderMenuId={
                  openFolderMenuId
                }
                mobileBrowserFolderId={
                  mobileBrowserFolderId
                }
                onMobileBrowserFolderChange={
                  setMobileBrowserFolderId
                }
                onOpenMenu={
                  setOpenFolderMenuId
                }
                onSelectFolder={(
                  folderId,
                ) => {
                  setLibrarySection(
                    "MEDIA",
                  );
                  setSelectedFolderId(
                    folderId,
                  );
                }}
                onUpload={
                  chooseFile
                }
                onDropFiles={
                  queueFilesToFolder
                }
                onDragState={
                  setDragOverFolderId
                }
                onCreateSubfolder={
                  openCreateFolderDialog
                }
                onRename={
                  openRenameFolderDialog
                }
                onMove={
                  openMoveFolderDialog
                }
                onDelete={
                  openDeleteFolderDialog
                }
              />
            </div>
          )}
        </div>

        {librarySection ===
          "MEDIA" && (
          <>
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <FilterButton
              active={
                filter ===
                "ALL"
              }
              onClick={() =>
                setFilter(
                  "ALL",
                )
              }
              label={t(
                "allMedia",
              )}
              count={
                media.length
              }
            />

            <FilterButton
              active={
                filter ===
                "VIDEO"
              }
              onClick={() =>
                setFilter(
                  "VIDEO",
                )
              }
              label={t(
                "videos",
              )}
              count={
                media.length
              }
            />

            <FilterButton
              active={
                filter ===
                "READY"
              }
              onClick={() =>
                setFilter(
                  "READY",
                )
              }
              label={t(
                "readyToPublish",
              )}
              count={
                readyCount
              }
              ready
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />

              <input
                value={
                  search
                }
                onChange={(
                  event,
                ) =>
                  setSearch(
                    event.target
                      .value,
                  )
                }
                placeholder={t(
                  "searchMedia",
                )}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.025] py-2 pl-8 pr-3 text-[11px] text-white outline-none placeholder:text-white/20 focus:border-blue-500/30"
              />
            </div>

            <div className="relative min-w-[170px]">
              <Tag className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />

              <select
                value={
                  selectedCategoryId
                }
                onChange={(
                  event,
                ) =>
                  setSelectedCategoryId(
                    event.target
                      .value,
                  )
                }
                className="w-full appearance-none rounded-xl border border-white/[0.08] bg-[#0c1119] py-2 pl-8 pr-8 text-[11px] text-white/60 outline-none focus:border-blue-500/30"
              >
                <option value="ALL">
                  {t(
                    "allCategories",
                  )}
                </option>

                {categories.map(
                  (
                    category,
                  ) => (
                    <option
                      key={
                        category.id
                      }
                      value={
                        category.id
                      }
                    >
                      {
                        category.name
                      }
                    </option>
                  ),
                )}
              </select>

              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[8px] text-white/20">
                ▼
              </span>
            </div>

            <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.025] p-1">
              <button
                type="button"
                onClick={() =>
                  setViewMode(
                    "GRID",
                  )
                }
                className={`rounded-lg p-1.5 transition ${
                  viewMode ===
                  "GRID"
                    ? "bg-blue-500/15 text-blue-300"
                    : "text-white/30 hover:text-white"
                }`}
              >
                <Grid2X2 className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() =>
                  setViewMode(
                    "LIST",
                  )
                }
                className={`rounded-lg p-1.5 transition ${
                  viewMode ===
                  "LIST"
                    ? "bg-blue-500/15 text-blue-300"
                    : "text-white/30 hover:text-white"
                }`}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadMedia()
              }
              disabled={
                isLoading
              }
              className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[11px] text-white/45 transition hover:text-white disabled:opacity-40"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  isLoading
                    ? "animate-spin"
                    : ""
                }`}
              />

              {t(
                "refresh",
              )}
            </button>
          </div>
        </div>

        {pageSuccess && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-xs text-emerald-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {
              pageSuccess
            }
          </div>
        )}

        {pageError && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-xs text-red-300">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {
              pageError
            }
          </div>
        )}

        {!selectedPerformerId ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[20px] border border-dashed border-white/[0.08] bg-white/[0.015] px-6 text-center">
            <FileVideo2 className="h-7 w-7 text-white/20" />
            <div className="mt-3 text-sm font-medium text-white/60">
              Select a performer
            </div>
            <div className="mt-1 text-xs text-white/25">
              Media will appear only for the selected performer.
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-400" />

              <div className="mt-3 text-xs text-white/30">
                {t(
                  "loadingMedia",
                )}
              </div>
            </div>
          </div>
        ) : filteredMedia.length ===
          0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[20px] border border-dashed border-white/[0.08] bg-white/[0.015] px-6 text-center">
            <FileVideo2 className="h-7 w-7 text-white/20" />

            <div className="mt-3 text-sm font-medium text-white/60">
              {t(
                "noMediaFound",
              )}
            </div>

            <div className="mt-1 text-xs text-white/25">
              {t(
                "uploadOrChangeFilters",
              )}
            </div>
          </div>
        ) : viewMode ===
          "GRID" ? (
          <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filteredMedia.map(
              (
                item,
              ) => (
                <MediaTile
                  key={
                    item.id
                  }
                  media={
                    item
                  }
                  previewUrl={
                    previewUrls[
                      item.id
                    ]
                  }
                  isDeleting={
                    deletingMediaId ===
                    item.id
                  }
                  categories={
                    mediaCategories[
                      item.id
                    ] ??
                    []
                  }
                  onPreview={() =>
                    setViewerMedia(
                      item,
                    )
                  }
                  onManageCategories={() =>
                    setCategoryMedia(
                      item,
                    )
                  }
                  onRemove={() =>
                    void removeMedia(
                      item,
                    )
                  }
                />
              ),
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-[18px] border border-white/[0.07]">
            {filteredMedia.map(
              (
                item,
              ) => (
                <MediaListRow
                  key={
                    item.id
                  }
                  media={
                    item
                  }
                  previewUrl={
                    previewUrls[
                      item.id
                    ]
                  }
                  isDeleting={
                    deletingMediaId ===
                    item.id
                  }
                  categories={
                    mediaCategories[
                      item.id
                    ] ??
                    []
                  }
                  onPreview={() =>
                    setViewerMedia(
                      item,
                    )
                  }
                  onManageCategories={() =>
                    setCategoryMedia(
                      item,
                    )
                  }
                  onRemove={() =>
                    void removeMedia(
                      item,
                    )
                  }
                />
              ),
            )}
          </div>
        )}

        {selectedPerformerId &&
          !isLoading &&
          filteredMedia.length >
            0 && (
            <div className="mt-6 text-[11px] text-white/20">
              {t(
                "showingFiles",
                {
                  shown:
                    filteredMedia.length,
                  total:
                    media.length,
                },
              )}
            </div>
          )}
          </>
        )}
      </div>

      {viewerMedia && (
        <MediaViewerModal
          media={
            viewerMedia
          }
          previewUrl={
            previewUrls[
              viewerMedia.id
            ]
          }
          onClose={() =>
            setViewerMedia(
              null,
            )
          }
        />
      )}

      {categoryMedia && (
        <MediaCategoryModal
          media={
            categoryMedia
          }
          categories={
            categories
          }
          assignedCategories={
            mediaCategories[
              categoryMedia.id
            ] ??
            []
          }
          onClose={() =>
            setCategoryMedia(
              null,
            )
          }
          onCategoriesChanged={async () => {
            await Promise.all([
              loadCategories(),
              loadMediaCategories(
                media,
              ),
            ]);
          }}
        />
      )}

      {selectedAgreement && (
        <AgreementPreviewModal
          agreement={
            selectedAgreement
          }
          onClose={() =>
            setSelectedAgreement(
              null,
            )
          }
        />
      )}

      {folderDialog && (
        <FolderManagementModal
          dialog={
            folderDialog
          }
          folders={
            folders
          }
          media={
            media
          }
          folderNameInput={
            folderNameInput
          }
          moveDestinationId={
            moveDestinationId
          }
          deleteMode={
            deleteMode
          }
          deleteConfirmation={
            deleteConfirmation
          }
          isBusy={
            isFolderActionBusy
          }
          onFolderNameChange={
            setFolderNameInput
          }
          onMoveDestinationChange={
            setMoveDestinationId
          }
          onDeleteModeChange={
            setDeleteMode
          }
          onDeleteConfirmationChange={
            setDeleteConfirmation
          }
          onClose={
            closeFolderDialog
          }
          onCreate={
            createFolder
          }
          onRename={
            renameFolder
          }
          onMove={
            moveFolder
          }
          onDelete={
            deleteFolder
          }
        />
      )}

    </main>
  );
}



function AgreementPreviewModal({
  agreement,
  onClose,
}: {
  agreement: Agreement;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-[760px] overflow-hidden rounded-[22px] border border-white/[0.1] bg-[#090d14] shadow-[0_35px_120px_rgba(0,0,0,0.75)]">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-white/90">
              Contract
            </div>

            <div className="mt-1 text-[10px] text-white/30">
              Co-Performer Release Agreement · {agreement.templateVersion}
            </div>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-white/40 transition hover:bg-white/[0.06] hover:text-white"
            aria-label="Close contract"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[76vh] overflow-y-auto px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <AgreementInfo
              label="Co-performer"
              value={
                agreement.coPerformerLegalName
              }
            />
            <AgreementInfo
              label="Uploader"
              value={
                agreement.uploaderLegalName
              }
            />
            <AgreementInfo
              label="Agreement date"
              value={
                formatDocumentDate(
                  agreement.agreementDate,
                )
              }
            />
            <AgreementInfo
              label="Type"
              value={
                agreement.agreementType ===
                "MULTIPLE_CONTENT"
                  ? "Multiple content"
                  : "Single content"
              }
            />
            <AgreementInfo
              label="Status"
              value={
                agreement.status
              }
            />
            <AgreementInfo
              label="Jurisdiction"
              value={
                agreement.jurisdiction ||
                "—"
              }
            />
          </div>

          <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/[0.10] px-4 py-3">
            <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/25">
              Content description
            </div>

            <div className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-white/65">
              {agreement.contentDescription ||
                "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgreementInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-3 py-3">
      <div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/20">
        {label}
      </div>
      <div className="mt-1.5 text-[10px] text-white/65">
        {value}
      </div>
    </div>
  );
}

function PerformerDocumentsManager({
  documents,
  agreements,
  filteredDocuments,
  filteredAgreements,
  onSelectAgreement,
  isLoading,
  filter,
  search,
  onFilterChange,
  onSearchChange,
  onRefresh,
  onOpen,
  onShare,
  compact = false,
}: {
  documents: PerformerDocument[];
  agreements: Agreement[];
  filteredDocuments: PerformerDocument[];
  filteredAgreements: Agreement[];
  onSelectAgreement: (
    agreement: Agreement,
  ) => void;
  isLoading: boolean;
  filter: DocumentFilter;
  search: string;
  onFilterChange: (
    filter: DocumentFilter,
  ) => void;
  onSearchChange: (
    value: string,
  ) => void;
  onRefresh: () => void;
  onOpen: (
    documentId: string,
  ) => Promise<void>;
  onShare: (
    document: PerformerDocument,
  ) => Promise<void>;
  compact?: boolean;
}) {
  const filters: {
    id: DocumentFilter;
    label: string;
  }[] = [
    {
      id: "ALL",
      label: "All",
    },
    {
      id: "CONTRACT",
      label: "Contracts",
    },
    {
      id: "PHOTO_ID",
      label: "ID",
    },
    {
      id: "PROOF_OF_ADDRESS",
      label: "Address",
    },
    {
      id: "RELEASE_FORM",
      label: "Consent",
    },
    {
      id: "TEST_RESULT",
      label: "Tests",
    },
    {
      id: "OTHER",
      label: "Other",
    },
  ];

  return (
    <div
      className={
        compact
          ? "min-h-[260px]"
          : "min-h-[250px]"
      }
    >
      <div className="flex flex-col gap-3 border-b border-white/[0.06] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-violet-300/80" />

            <div className="text-[11px] font-semibold text-white/75">
              Performer documents
            </div>
          </div>

          <div className="mt-1 text-[8px] text-white/25">
            Contracts, IDs, consent forms, test results and compliance files
          </div>
        </div>

        <button
          type="button"
          onClick={
            onRefresh
          }
          disabled={
            isLoading
          }
          className="flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 py-2 text-[9px] font-semibold text-white/40 transition hover:bg-white/[0.05] hover:text-white/75 disabled:opacity-40"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${
              isLoading
                ? "animate-spin"
                : ""
            }`}
          />
          Refresh
        </button>
      </div>

      <div className="border-b border-white/[0.055] px-3 py-3">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {filters.map(
              (
                item,
              ) => (
                <button
                  key={
                    item.id
                  }
                  type="button"
                  onClick={() =>
                    onFilterChange(
                      item.id,
                    )
                  }
                  className={`rounded-lg border px-2.5 py-1.5 text-[8px] font-semibold transition ${
                    filter ===
                    item.id
                      ? "border-violet-500/30 bg-violet-500/[0.09] text-violet-200"
                      : "border-white/[0.07] bg-white/[0.015] text-white/30 hover:text-white/65"
                  }`}
                >
                  {item.label}
                </button>
              ),
            )}
          </div>

          <div className="relative min-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
            <input
              value={
                search
              }
              onChange={(
                event,
              ) =>
                onSearchChange(
                  event.target.value,
                )
              }
              placeholder="Search documents"
              className="w-full rounded-lg border border-white/[0.07] bg-white/[0.02] py-2 pl-8 pr-3 text-[9px] text-white/70 outline-none placeholder:text-white/18 focus:border-violet-500/25"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[210px] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-violet-300" />
            <div className="mt-2 text-[9px] text-white/25">
              Loading documents...
            </div>
          </div>
        </div>
      ) : documents.length +
          agreements.length ===
        0 ? (
        <div className="flex min-h-[210px] flex-col items-center justify-center px-6 text-center">
          <FileText className="h-7 w-7 text-white/15" />
          <div className="mt-2 text-[10px] font-medium text-white/45">
            No documents registered
          </div>
          <div className="mt-1 max-w-[320px] text-[8px] leading-4 text-white/20">
            Add documents from the selected performer profile. They will appear here automatically.
          </div>
        </div>
      ) : filteredDocuments.length +
          filteredAgreements.length ===
        0 ? (
        <div className="flex min-h-[210px] items-center justify-center px-6 text-center text-[9px] text-white/25">
          No documents match the selected filters.
        </div>
      ) : (
        <div className="divide-y divide-white/[0.05]">
          {filteredAgreements.map(
            (
              agreement,
            ) => (
              <div
                key={
                  `agreement-${agreement.id}`
                }
                className="flex flex-col gap-3 px-3 py-3 transition hover:bg-white/[0.012] sm:flex-row sm:items-center"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-400/10 bg-amber-500/[0.06]">
                  <FileText className="h-4 w-4 text-amber-300/75" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[10px] font-semibold text-white/70">
                    Co-Performer Release Agreement
                  </div>

                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[8px] text-white/24">
                    <span>Contract</span>
                    <span>
                      {agreement.agreementType ===
                      "MULTIPLE_CONTENT"
                        ? "Multiple content"
                        : "Single content"}
                    </span>
                    <span>
                      {agreement.coPerformerLegalName}
                    </span>
                    <span>
                      {formatDocumentDate(
                        agreement.agreementDate,
                      )}
                    </span>
                    <span>
                      {agreement.status}
                    </span>
                  </div>

                  {agreement.contentDescription && (
                    <div className="mt-1 truncate text-[8px] text-white/18">
                      {agreement.contentDescription}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onSelectAgreement(
                      agreement,
                    )
                  }
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 text-[8px] font-semibold text-white/40 transition hover:bg-white/[0.05] hover:text-white/75"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </button>
              </div>
            ),
          )}

          {filteredDocuments.map(
            (
              document,
            ) => (
              <div
                key={
                  document.id
                }
                className="flex flex-col gap-3 px-3 py-3 transition hover:bg-white/[0.012] sm:flex-row sm:items-center"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-400/10 bg-violet-500/[0.06]">
                  <FileText className="h-4 w-4 text-violet-300/75" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[10px] font-semibold text-white/70">
                    {document.title ||
                      documentTypeLabel(
                        document.documentType,
                      )}
                  </div>

                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[8px] text-white/24">
                    <span>
                      {documentTypeLabel(
                        document.documentType,
                      )}
                    </span>

                    <span>
                      {formatDocumentSize(
                        document.fileSize,
                      )}
                    </span>

                    {document.expiresAt && (
                      <span>
                        Expires{" "}
                        {formatDocumentDate(
                          document.expiresAt,
                        )}
                      </span>
                    )}

                    {!document.expiresAt &&
                      document.issuedAt && (
                        <span>
                          Issued{" "}
                          {formatDocumentDate(
                            document.issuedAt,
                          )}
                        </span>
                      )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      void onOpen(
                        document.id,
                      )
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 text-[8px] font-semibold text-white/40 transition hover:bg-white/[0.05] hover:text-white/75"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void onShare(
                        document,
                      )
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-violet-500/15 bg-violet-500/[0.05] px-2.5 py-1.5 text-[8px] font-semibold text-violet-200/60 transition hover:bg-violet-500/[0.10] hover:text-violet-100"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function documentTypeLabel(
  type: string,
) {
  if (
    type ===
    "PHOTO_ID"
  ) {
    return "Photo ID";
  }

  if (
    type ===
    "PROOF_OF_ADDRESS"
  ) {
    return "Proof of address";
  }

  if (
    type ===
    "RELEASE_FORM"
  ) {
    return "Consent / release";
  }

  if (
    type ===
    "TEST_RESULT"
  ) {
    return "Test result";
  }

  return "Other";
}

function formatDocumentSize(
  bytes: number,
) {
  if (
    !Number.isFinite(
      bytes,
    ) ||
    bytes <= 0
  ) {
    return "—";
  }

  if (
    bytes <
    1024
  ) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes /
      1024
    ).toFixed(
      1,
    )} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(
    1,
  )} MB`;
}

function formatDocumentDate(
  value: string,
) {
  const date =
    new Date(
      `${value.slice(
        0,
        10,
      )}T12:00:00`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    undefined,
    {
      month:
        "short",
      day:
        "numeric",
      year:
        "numeric",
    },
  );
}

function ProfessionalFolderBrowser({
  rootFolders,
  folders,
  selectedFolderId,
  librarySection,
  documents,
  agreements,
  filteredDocuments,
  filteredAgreements,
  onSelectAgreement,
  isLoadingDocuments,
  documentFilter,
  documentSearch,
  onDocumentFilterChange,
  onDocumentSearchChange,
  onSelectDocuments,
  onRefreshDocuments,
  onOpenDocument,
  onShareDocument,
  dragOverFolderId,
  openFolderMenuId,
  mobileBrowserFolderId,
  onMobileBrowserFolderChange,
  onOpenMenu,
  onSelectFolder,
  onUpload,
  onDropFiles,
  onDragState,
  onCreateSubfolder,
  onRename,
  onMove,
  onDelete,
}: {
  rootFolders: LibraryFolder[];
  folders: LibraryFolder[];
  selectedFolderId: string;
  librarySection: "MEDIA" | "DOCUMENTS";
  documents: PerformerDocument[];
  agreements: Agreement[];
  filteredDocuments: PerformerDocument[];
  filteredAgreements: Agreement[];
  onSelectAgreement: (
    agreement: Agreement,
  ) => void;
  isLoadingDocuments: boolean;
  documentFilter: DocumentFilter;
  documentSearch: string;
  onDocumentFilterChange: (
    filter: DocumentFilter,
  ) => void;
  onDocumentSearchChange: (
    value: string,
  ) => void;
  onSelectDocuments: () => void;
  onRefreshDocuments: () => void;
  onOpenDocument: (
    documentId: string,
  ) => Promise<void>;
  onShareDocument: (
    document: PerformerDocument,
  ) => Promise<void>;
  dragOverFolderId: string | null;
  openFolderMenuId: string | null;
  mobileBrowserFolderId: string | null;
  onMobileBrowserFolderChange: (
    folderId: string | null,
  ) => void;
  onOpenMenu: (
    folderId: string | null,
  ) => void;
  onSelectFolder: (
    folderId: string,
  ) => void;
  onUpload: (
    folderId: string,
  ) => void;
  onDropFiles: (
    files: File[],
    folderId: string,
  ) => void;
  onDragState: (
    folderId: string | null,
  ) => void;
  onCreateSubfolder: (
    folder: LibraryFolder,
  ) => void;
  onRename: (
    folder: LibraryFolder,
  ) => void;
  onMove: (
    folder: LibraryFolder,
  ) => void;
  onDelete: (
    folder: LibraryFolder,
  ) => void;
}) {
  const folderById =
    new Map(
      folders.map(
        (
          folder,
        ) => [
          folder.id,
          folder,
        ],
      ),
    );

  const childrenOf = (
    parentId: string,
  ) =>
    folders
      .filter(
        (
          folder,
        ) =>
          folder.parentId ===
          parentId,
      )
      .sort(
        (
          a,
          b,
        ) =>
          a.sortOrder -
          b.sortOrder,
      );

  const selectedFolder =
    selectedFolderId !==
      "ALL"
      ? folderById.get(
          selectedFolderId,
        ) ??
        null
      : null;

  const selectedPath: LibraryFolder[] =
    [];

  if (selectedFolder) {
    let current:
      | LibraryFolder
      | undefined =
      selectedFolder;

    const visited =
      new Set<string>();

    while (
      current &&
      !visited.has(
        current.id,
      )
    ) {
      selectedPath.unshift(
        current,
      );

      visited.add(
        current.id,
      );

      if (
        !current.parentId
      ) {
        break;
      }

      current =
        folderById.get(
          current.parentId,
        );
    }
  }

  const activeRoot =
    selectedPath.find(
      (
        folder,
      ) =>
        folder.parentId ===
        null,
    ) ??
    rootFolders[0] ??
    null;

  const pathInsideRoot =
    activeRoot
      ? selectedPath.filter(
          (
            folder,
          ) =>
            folder.id !==
            activeRoot.id,
        )
      : [];

  const desktopColumns: {
    title: string;
    parent: LibraryFolder;
    folders: LibraryFolder[];
  }[] = [];

  if (activeRoot) {
    desktopColumns.push({
      title:
        activeRoot.systemKey ===
        "SAFE"
          ? "SAFE FOR WORK"
          : activeRoot.systemKey ===
            "UNSAFE"
          ? "NOT SAFE FOR WORK"
          : activeRoot.name,
      parent:
        activeRoot,
      folders:
        childrenOf(
          activeRoot.id,
        ),
    });

    for (
      const pathFolder of
      pathInsideRoot
    ) {
      const childFolders =
        childrenOf(
          pathFolder.id,
        );

      if (
        childFolders.length >
        0
      ) {
        desktopColumns.push({
          title:
            pathFolder.name,
          parent:
            pathFolder,
          folders:
            childFolders,
        });
      }
    }
  }

  const mobileCurrent =
    mobileBrowserFolderId
      ? folderById.get(
          mobileBrowserFolderId,
        ) ??
        null
      : null;

  const mobileChildren =
    mobileCurrent
      ? childrenOf(
          mobileCurrent.id,
        )
      : rootFolders;

  const mobileParent =
    mobileCurrent?.parentId
      ? folderById.get(
          mobileCurrent.parentId,
        ) ??
        null
      : null;

  function selectFolderAndOpen(
    folder: LibraryFolder,
  ) {
    onSelectFolder(
      folder.id,
    );

    if (
      childrenOf(
        folder.id,
      ).length >
      0 ||
      folder.parentId ===
        null
    ) {
      onMobileBrowserFolderChange(
        folder.id,
      );
    }
  }

  return (
    <div>
      <div className="hidden lg:block">
        <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-3">
          <div className="rounded-xl border border-white/[0.07] bg-black/[0.10] p-2">
            <div className="px-2 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/25">
              Content type
            </div>

            <div className="space-y-1.5">
              {rootFolders.map(
                (
                  root,
                ) => {
                  const isActive =
                    librarySection ===
                      "MEDIA" &&
                    activeRoot?.id ===
                      root.id;

                  return (
                    <button
                      key={
                        root.id
                      }
                      type="button"
                      onClick={() => {
                        onSelectFolder(
                          root.id,
                        );
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2.5 text-left transition ${
                        isActive
                          ? "border-blue-500/30 bg-blue-500/[0.09] text-white"
                          : "border-transparent bg-white/[0.015] text-white/45 hover:bg-white/[0.04] hover:text-white/75"
                      }`}
                    >
                      <Folder
                        className={`h-5 w-5 shrink-0 ${
                          root.systemKey ===
                          "UNSAFE"
                            ? "text-red-300/80"
                            : "text-emerald-300/80"
                        }`}
                      />

                      <div className="min-w-0">
                        <div className="truncate text-[10px] font-semibold">
                          {root.systemKey ===
                          "SAFE"
                            ? "SAFE FOR WORK"
                            : root.systemKey ===
                              "UNSAFE"
                            ? "NOT SAFE FOR WORK"
                            : root.name}
                        </div>

                        <div className="mt-0.5 text-[8px] text-white/20">
                          {childrenOf(
                            root.id,
                          ).length} folders
                        </div>
                      </div>

                      <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-white/20" />
                    </button>
                  );
                },
              )}

              <div className="my-2 border-t border-white/[0.06]" />

              <button
                type="button"
                onClick={
                  onSelectDocuments
                }
                className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2.5 text-left transition ${
                  librarySection ===
                  "DOCUMENTS"
                    ? "border-violet-500/30 bg-violet-500/[0.09] text-white"
                    : "border-transparent bg-white/[0.015] text-white/45 hover:bg-white/[0.04] hover:text-white/75"
                }`}
              >
                <FileText className="h-5 w-5 shrink-0 text-violet-300/85" />

                <div className="min-w-0">
                  <div className="truncate text-[10px] font-semibold">
                    DOCUMENTS
                  </div>

                  <div className="mt-0.5 text-[8px] text-white/20">
                    {documents.length + agreements.length} item{documents.length + agreements.length === 1 ? "" : "s"}
                  </div>
                </div>

                <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-white/20" />
              </button>
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-xl border border-white/[0.07] bg-black/[0.10]">
            {librarySection ===
            "DOCUMENTS" ? (
              <PerformerDocumentsManager
                documents={
                  documents
                }
                agreements={
                  agreements
                }
                filteredAgreements={
                  filteredAgreements
                }
                onSelectAgreement={
                  onSelectAgreement
                }
                filteredDocuments={
                  filteredDocuments
                }
                isLoading={
                  isLoadingDocuments
                }
                filter={
                  documentFilter
                }
                search={
                  documentSearch
                }
                onFilterChange={
                  onDocumentFilterChange
                }
                onSearchChange={
                  onDocumentSearchChange
                }
                onRefresh={
                  onRefreshDocuments
                }
                onOpen={
                  onOpenDocument
                }
                onShare={
                  onShareDocument
                }
              />
            ) : !activeRoot ? (
              <div className="flex min-h-[250px] items-center justify-center px-6 text-center text-xs text-white/25">
                No structural folders available.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-semibold text-white/60">
                      {[
                        activeRoot,
                        ...pathInsideRoot,
                      ]
                        .map(
                          (
                            folder,
                          ) =>
                            folder.systemKey ===
                            "SAFE"
                              ? "SAFE FOR WORK"
                              : folder.systemKey ===
                                "UNSAFE"
                              ? "NOT SAFE FOR WORK"
                              : folder.name,
                        )
                        .join(
                          " / ",
                        )}
                    </div>

                    <div className="mt-0.5 text-[8px] text-white/20">
                      Browse folders by column
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onCreateSubfolder(
                        desktopColumns[
                          desktopColumns.length -
                            1
                        ]?.parent ??
                          activeRoot,
                      )
                    }
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 py-2 text-[9px] font-semibold text-white/45 transition hover:bg-white/[0.06] hover:text-white/80"
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                    New folder
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <div
                    className="flex min-h-[250px] w-max min-w-full"
                  >
                    {desktopColumns.map(
                      (
                        column,
                        columnIndex,
                      ) => (
                        <div
                          key={`${column.parent.id}-${columnIndex}`}
                          className="w-[230px] shrink-0 border-r border-white/[0.055] p-2 last:border-r-0"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2 px-1.5">
                            <div className="truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-white/25">
                              {column.title}
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                onCreateSubfolder(
                                  column.parent,
                                )
                              }
                              className="flex h-6 w-6 items-center justify-center rounded-md text-white/20 transition hover:bg-white/[0.05] hover:text-white/60"
                              title={`New folder in ${column.title}`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="space-y-1">
                            {column.folders.map(
                              (
                                folder,
                              ) => {
                                const hasChildren =
                                  childrenOf(
                                    folder.id,
                                  ).length >
                                  0;

                                const isSelected =
                                  selectedFolderId ===
                                  folder.id;

                                const isDragOver =
                                  dragOverFolderId ===
                                  folder.id;

                                return (
                                  <div
                                    key={
                                      folder.id
                                    }
                                    onDragOver={(event) => {
                                      event.preventDefault();
                                      event.dataTransfer.dropEffect =
                                        "copy";

                                      onDragState(
                                        folder.id,
                                      );
                                    }}
                                    onDragEnter={(event) => {
                                      event.preventDefault();

                                      onDragState(
                                        folder.id,
                                      );
                                    }}
                                    onDragLeave={(event) => {
                                      if (
                                        event.currentTarget.contains(
                                          event.relatedTarget as Node | null,
                                        )
                                      ) {
                                        return;
                                      }

                                      onDragState(
                                        null,
                                      );
                                    }}
                                    onDrop={(event) => {
                                      event.preventDefault();

                                      onDragState(
                                        null,
                                      );

                                      onDropFiles(
                                        Array.from(
                                          event.dataTransfer.files ??
                                            [],
                                        ),
                                        folder.id,
                                      );
                                    }}
                                    className={`relative flex items-center gap-1 rounded-lg border px-1.5 py-1.5 transition ${
                                      isDragOver
                                        ? "border-blue-400/60 bg-blue-500/[0.13]"
                                        : isSelected
                                        ? "border-blue-500/30 bg-blue-500/[0.08]"
                                        : "border-transparent hover:border-white/[0.06] hover:bg-white/[0.03]"
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onSelectFolder(
                                          folder.id,
                                        )
                                      }
                                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                    >
                                      <Folder className="h-5 w-5 shrink-0 text-amber-300/90" />

                                      <span className="truncate text-[10px] font-medium text-white/60">
                                        {folder.name}
                                      </span>

                                      {hasChildren && (
                                        <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-white/20" />
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();

                                        onUpload(
                                          folder.id,
                                        );
                                      }}
                                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-blue-300/55 transition hover:bg-blue-500/[0.10] hover:text-blue-200"
                                      title={`Upload to ${folder.name}`}
                                    >
                                      <UploadCloud className="h-3.5 w-3.5" />
                                    </button>

                                    <div
                                      className="relative"
                                      data-folder-menu-root="true"
                                    >
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();

                                          onOpenMenu(
                                            openFolderMenuId ===
                                              folder.id
                                              ? null
                                              : folder.id,
                                          );
                                        }}
                                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/25 transition hover:bg-white/[0.05] hover:text-white/65"
                                      >
                                        <MoreVertical className="h-3.5 w-3.5" />
                                      </button>

                                      {openFolderMenuId ===
                                        folder.id && (
                                        <div className="absolute right-0 top-8 z-50 w-44 overflow-hidden rounded-xl border border-white/[0.10] bg-[#111722] p-1.5 shadow-2xl">
                                          <FolderMenuButton
                                            icon={
                                              <FolderPlus className="h-3.5 w-3.5" />
                                            }
                                            label="New subfolder"
                                            onClick={() =>
                                              onCreateSubfolder(
                                                folder,
                                              )
                                            }
                                          />

                                          <FolderMenuButton
                                            icon={
                                              <Pencil className="h-3.5 w-3.5" />
                                            }
                                            label="Rename"
                                            onClick={() =>
                                              onRename(
                                                folder,
                                              )
                                            }
                                          />

                                          <FolderMenuButton
                                            icon={
                                              <Move className="h-3.5 w-3.5" />
                                            }
                                            label="Move"
                                            onClick={() =>
                                              onMove(
                                                folder,
                                              )
                                            }
                                          />

                                          <div className="my-1 border-t border-white/[0.06]" />

                                          <FolderMenuButton
                                            danger
                                            icon={
                                              <Trash2 className="h-3.5 w-3.5" />
                                            }
                                            label="Delete"
                                            onClick={() =>
                                              onDelete(
                                                folder,
                                              )
                                            }
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              },
                            )}

                            {column.folders.length ===
                              0 && (
                              <div className="rounded-lg border border-dashed border-white/[0.06] px-3 py-6 text-center text-[9px] text-white/20">
                                Empty folder
                              </div>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-black/[0.10]">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              {librarySection ===
                "MEDIA" &&
                mobileCurrent && (
                <button
                  type="button"
                  onClick={() =>
                    onMobileBrowserFolderChange(
                      mobileParent?.id ??
                        null,
                    )
                  }
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] text-white/40"
                  aria-label="Back"
                >
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </button>
              )}

              <div className="min-w-0">
                <div className="truncate text-[10px] font-semibold text-white/65">
                  {librarySection ===
                    "DOCUMENTS"
                    ? "DOCUMENTS"
                    : mobileCurrent
                    ? mobileCurrent.systemKey ===
                      "SAFE"
                      ? "SAFE FOR WORK"
                      : mobileCurrent.systemKey ===
                        "UNSAFE"
                      ? "NOT SAFE FOR WORK"
                      : mobileCurrent.name
                    : "Media folders"}
                </div>

                <div className="mt-0.5 text-[8px] text-white/20">
                  {librarySection ===
                    "DOCUMENTS"
                    ? "Performer documents and compliance files"
                    : mobileCurrent
                    ? "Tap a folder to open it"
                    : "Choose SAFE, NOT SAFE or DOCUMENTS"}
                </div>
              </div>
            </div>

            {librarySection ===
              "MEDIA" &&
              mobileCurrent && (
              <button
                type="button"
                onClick={() =>
                  onCreateSubfolder(
                    mobileCurrent,
                  )
                }
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-white/35"
                aria-label="New folder"
              >
                <FolderPlus className="h-4 w-4" />
              </button>
            )}
          </div>

          {librarySection ===
          "DOCUMENTS" ? (
            <PerformerDocumentsManager
              documents={
                documents
              }
              agreements={
                  agreements
                }
                filteredAgreements={
                  filteredAgreements
                }
                onSelectAgreement={
                  onSelectAgreement
                }
                filteredDocuments={
                filteredDocuments
              }
              isLoading={
                isLoadingDocuments
              }
              filter={
                documentFilter
              }
              search={
                documentSearch
              }
              onFilterChange={
                onDocumentFilterChange
              }
              onSearchChange={
                onDocumentSearchChange
              }
              onRefresh={
                onRefreshDocuments
              }
              onOpen={
                onOpenDocument
              }
              onShare={
                onShareDocument
              }
              compact
            />
          ) : (
            <div className="p-2">

            {mobileChildren.map(
              (
                folder,
              ) => {
                const hasChildren =
                  childrenOf(
                    folder.id,
                  ).length >
                  0;

                const isRoot =
                  folder.parentId ===
                  null;

                const isSelected =
                  selectedFolderId ===
                  folder.id;

                return (
                  <div
                    key={
                      folder.id
                    }
                    className={`mb-1 flex items-center gap-1 rounded-lg border px-1.5 py-1.5 last:mb-0 ${
                      isSelected
                        ? "border-blue-500/30 bg-blue-500/[0.08]"
                        : "border-transparent"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        selectFolderAndOpen(
                          folder,
                        )
                      }
                      className="flex min-w-0 flex-1 items-center gap-2.5 px-1 py-1.5 text-left"
                    >
                      <Folder
                        className={`h-6 w-6 shrink-0 ${
                          isRoot &&
                          folder.systemKey ===
                            "UNSAFE"
                            ? "text-red-300/80"
                            : isRoot
                            ? "text-emerald-300/80"
                            : "text-amber-300/90"
                        }`}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-medium text-white/65">
                          {folder.systemKey ===
                          "SAFE"
                            ? "SAFE FOR WORK"
                            : folder.systemKey ===
                              "UNSAFE"
                            ? "NOT SAFE FOR WORK"
                            : folder.name}
                        </div>

                        <div className="mt-0.5 text-[8px] text-white/20">
                          {hasChildren
                            ? `${childrenOf(folder.id).length} subfolder${childrenOf(folder.id).length === 1 ? "" : "s"}`
                            : "Open folder"}
                        </div>
                      </div>

                      {(hasChildren ||
                        isRoot) && (
                        <ChevronRight className="h-4 w-4 shrink-0 text-white/20" />
                      )}
                    </button>

                    {!isRoot && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            onUpload(
                              folder.id,
                            )
                          }
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-blue-300/55"
                          aria-label={`Upload to ${folder.name}`}
                        >
                          <UploadCloud className="h-4 w-4" />
                        </button>

                        <div
                          className="relative"
                          data-folder-menu-root="true"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              onOpenMenu(
                                openFolderMenuId ===
                                  folder.id
                                  ? null
                                  : folder.id,
                              )
                            }
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/30"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {openFolderMenuId ===
                            folder.id && (
                            <div className="absolute right-0 top-9 z-50 w-44 overflow-hidden rounded-xl border border-white/[0.10] bg-[#111722] p-1.5 shadow-2xl">
                              <FolderMenuButton
                                icon={
                                  <FolderPlus className="h-3.5 w-3.5" />
                                }
                                label="New subfolder"
                                onClick={() =>
                                  onCreateSubfolder(
                                    folder,
                                  )
                                }
                              />

                              <FolderMenuButton
                                icon={
                                  <Pencil className="h-3.5 w-3.5" />
                                }
                                label="Rename"
                                onClick={() =>
                                  onRename(
                                    folder,
                                  )
                                }
                              />

                              <FolderMenuButton
                                icon={
                                  <Move className="h-3.5 w-3.5" />
                                }
                                label="Move"
                                onClick={() =>
                                  onMove(
                                    folder,
                                  )
                                }
                              />

                              <div className="my-1 border-t border-white/[0.06]" />

                              <FolderMenuButton
                                danger
                                icon={
                                  <Trash2 className="h-3.5 w-3.5" />
                                }
                                label="Delete"
                                onClick={() =>
                                  onDelete(
                                    folder,
                                  )
                                }
                              />
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              },
            )}

            {mobileChildren.length ===
              0 && (
              <div className="rounded-lg border border-dashed border-white/[0.06] px-3 py-6 text-center text-[10px] text-white/20">
                No subfolders here yet.
              </div>
            )}

              {!mobileCurrent && (
                <button
                  type="button"
                  onClick={
                    onSelectDocuments
                  }
                  className="mt-1 flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2.5 text-left text-white/55 transition hover:bg-white/[0.04]"
                >
                  <FileText className="h-6 w-6 shrink-0 text-violet-300/85" />

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-medium">
                      DOCUMENTS
                    </div>

                    <div className="mt-0.5 text-[8px] text-white/20">
                      {documents.length + agreements.length} item{documents.length + agreements.length === 1 ? "" : "s"}
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-white/20" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FolderMenuButton({
  icon,
  label,
  danger = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] transition ${
        danger
          ? "text-red-300/80 hover:bg-red-500/[0.08] hover:text-red-200"
          : "text-white/55 hover:bg-white/[0.05] hover:text-white/85"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function FolderManagementModal({
  dialog,
  folders,
  media,
  folderNameInput,
  moveDestinationId,
  deleteMode,
  deleteConfirmation,
  isBusy,
  onFolderNameChange,
  onMoveDestinationChange,
  onDeleteModeChange,
  onDeleteConfirmationChange,
  onClose,
  onCreate,
  onRename,
  onMove,
  onDelete,
}: {
  dialog: FolderDialogState;
  folders: LibraryFolder[];
  media: MediaAsset[];
  folderNameInput: string;
  moveDestinationId: string;
  deleteMode: "MOVE" | "DELETE_ALL";
  deleteConfirmation: string;
  isBusy: boolean;
  onFolderNameChange: (
    value: string,
  ) => void;
  onMoveDestinationChange: (
    value: string,
  ) => void;
  onDeleteModeChange: (
    value:
      | "MOVE"
      | "DELETE_ALL",
  ) => void;
  onDeleteConfirmationChange: (
    value: string,
  ) => void;
  onClose: () => void;
  onCreate: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  const descendants =
    new Set<string>([
      dialog.folder.id,
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
        descendants.has(
          folder.parentId,
        ) &&
        !descendants.has(
          folder.id,
        )
      ) {
        descendants.add(
          folder.id,
        );

        changed =
          true;
      }
    }
  }

  const subfolderCount =
    [...descendants].filter(
      (
        id,
      ) =>
        id !==
        dialog.folder.id,
    ).length;

  const fileCount =
    media.filter(
      (
        item,
      ) =>
        Boolean(
          item.folderId &&
          descendants.has(
            item.folderId,
          ),
        ),
    ).length;

  const isEmpty =
    fileCount ===
      0 &&
    subfolderCount ===
      0;

  const destinationOptions =
    folders
      .filter(
        (
          folder,
        ) =>
          folder.status ===
            "ACTIVE" &&
          !descendants.has(
            folder.id,
          ),
      )
      .sort(
        (
          a,
          b,
        ) =>
          a.name.localeCompare(
            b.name,
          ),
      );

  const title =
    dialog.mode ===
    "CREATE"
      ? `New folder inside "${dialog.folder.name}"`
      : dialog.mode ===
        "RENAME"
      ? `Rename "${dialog.folder.name}"`
      : dialog.mode ===
        "MOVE"
      ? `Move "${dialog.folder.name}"`
      : `Delete "${dialog.folder.name}"`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.10] bg-[#0d121b] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-300/60">
              Folder management
            </div>

            <h3 className="mt-1 text-lg font-semibold text-white/90">
              {title}
            </h3>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            disabled={
              isBusy
            }
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] text-white/35 transition hover:bg-white/[0.05] hover:text-white/70 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {(dialog.mode ===
          "CREATE" ||
          dialog.mode ===
            "RENAME") && (
          <div className="mt-5">
            <label className="text-[10px] font-medium text-white/45">
              Folder name
            </label>

            <input
              autoFocus
              value={
                folderNameInput
              }
              onChange={(event) =>
                onFolderNameChange(
                  event.target.value,
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                    "Enter" &&
                  !isBusy
                ) {
                  if (
                    dialog.mode ===
                    "CREATE"
                  ) {
                    onCreate();
                  } else {
                    onRename();
                  }
                }
              }}
              className="mt-2 w-full rounded-xl border border-white/[0.09] bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-blue-400/40"
              placeholder="Folder name"
            />

            {dialog.mode ===
              "RENAME" && (
              <p className="mt-3 text-[10px] leading-5 text-white/30">
                Only the folder name changes. Files, subfolders and stored media remain exactly where they are.
              </p>
            )}
          </div>
        )}

        {dialog.mode ===
          "MOVE" && (
          <div className="mt-5">
            <p className="text-[10px] leading-5 text-white/35">
              The folder will move as one unit. Its files and subfolders stay attached to it.
            </p>

            <label className="mt-4 block text-[10px] font-medium text-white/45">
              Destination folder
            </label>

            <select
              value={
                moveDestinationId
              }
              onChange={(event) =>
                onMoveDestinationChange(
                  event.target.value,
                )
              }
              className="mt-2 w-full rounded-xl border border-white/[0.09] bg-[#101620] px-3 py-2.5 text-sm text-white outline-none"
            >
              <option value="">
                Select destination
              </option>

              {destinationOptions.map(
                (
                  folder,
                ) => (
                  <option
                    key={
                      folder.id
                    }
                    value={
                      folder.id
                    }
                  >
                    {folder.systemKey ===
                    "SAFE"
                      ? "SAFE FOR WORK"
                      : folder.systemKey ===
                        "UNSAFE"
                      ? "NOT SAFE FOR WORK"
                      : folder.name}
                  </option>
                ),
              )}
            </select>
          </div>
        )}

        {dialog.mode ===
          "DELETE" && (
          <div className="mt-5">
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />

                <div>
                  <div className="text-[11px] font-semibold text-red-200/90">
                    Delete folder
                  </div>

                  <div className="mt-1 text-[10px] leading-5 text-white/35">
                    {isEmpty
                      ? "This folder is empty."
                      : `This folder tree contains ${fileCount} file${fileCount === 1 ? "" : "s"} and ${subfolderCount} subfolder${subfolderCount === 1 ? "" : "s"}.`}
                  </div>
                </div>
              </div>
            </div>

            {!isEmpty && (
              <div className="mt-4 space-y-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <input
                    type="radio"
                    checked={
                      deleteMode ===
                      "MOVE"
                    }
                    onChange={() =>
                      onDeleteModeChange(
                        "MOVE",
                      )
                    }
                    className="mt-0.5"
                  />

                  <div>
                    <div className="text-[10px] font-semibold text-white/70">
                      Move contents, then delete folder
                    </div>

                    <div className="mt-1 text-[9px] leading-4 text-white/30">
                      Direct files and subfolders are moved to another folder before this folder is removed.
                    </div>
                  </div>
                </label>

                {deleteMode ===
                  "MOVE" && (
                  <select
                    value={
                      moveDestinationId
                    }
                    onChange={(event) =>
                      onMoveDestinationChange(
                        event.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-white/[0.09] bg-[#101620] px-3 py-2.5 text-sm text-white outline-none"
                  >
                    <option value="">
                      Select destination
                    </option>

                    {destinationOptions.map(
                      (
                        folder,
                      ) => (
                        <option
                          key={
                            folder.id
                          }
                          value={
                            folder.id
                          }
                        >
                          {folder.systemKey ===
                          "SAFE"
                            ? "SAFE FOR WORK"
                            : folder.systemKey ===
                              "UNSAFE"
                            ? "NOT SAFE FOR WORK"
                            : folder.name}
                        </option>
                      ),
                    )}
                  </select>
                )}

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-red-500/15 bg-red-500/[0.025] p-3">
                  <input
                    type="radio"
                    checked={
                      deleteMode ===
                      "DELETE_ALL"
                    }
                    onChange={() =>
                      onDeleteModeChange(
                        "DELETE_ALL",
                      )
                    }
                    className="mt-0.5"
                  />

                  <div>
                    <div className="text-[10px] font-semibold text-red-200/85">
                      Delete folder and all contents
                    </div>

                    <div className="mt-1 text-[9px] leading-4 text-white/30">
                      Permanently removes the folder tree and eligible stored media. Media with publication history remains protected by the server.
                    </div>
                  </div>
                </label>

                {deleteMode ===
                  "DELETE_ALL" && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3">
                    <div className="text-[10px] font-semibold text-red-200/80">
                      Type DELETE to confirm
                    </div>

                    <input
                      value={
                        deleteConfirmation
                      }
                      onChange={(event) =>
                        onDeleteConfirmationChange(
                          event.target.value,
                        )
                      }
                      className="mt-2 w-full rounded-lg border border-red-500/20 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-red-400/40"
                      placeholder="DELETE"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={
              onClose
            }
            disabled={
              isBusy
            }
            className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-[10px] font-semibold text-white/45 transition hover:bg-white/[0.04] hover:text-white/75 disabled:opacity-40"
          >
            Cancel
          </button>

          {dialog.mode ===
            "CREATE" && (
            <button
              type="button"
              onClick={
                onCreate
              }
              disabled={
                isBusy ||
                !folderNameInput.trim()
              }
              className="rounded-xl bg-blue-500 px-4 py-2.5 text-[10px] font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isBusy
                ? "Creating..."
                : "Create folder"}
            </button>
          )}

          {dialog.mode ===
            "RENAME" && (
            <button
              type="button"
              onClick={
                onRename
              }
              disabled={
                isBusy ||
                !folderNameInput.trim()
              }
              className="rounded-xl bg-blue-500 px-4 py-2.5 text-[10px] font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isBusy
                ? "Saving..."
                : "Save name"}
            </button>
          )}

          {dialog.mode ===
            "MOVE" && (
            <button
              type="button"
              onClick={
                onMove
              }
              disabled={
                isBusy ||
                !moveDestinationId
              }
              className="rounded-xl bg-blue-500 px-4 py-2.5 text-[10px] font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isBusy
                ? "Moving..."
                : "Move folder"}
            </button>
          )}

          {dialog.mode ===
            "DELETE" && (
            <button
              type="button"
              onClick={
                onDelete
              }
              disabled={
                isBusy ||
                (
                  !isEmpty &&
                  deleteMode ===
                    "MOVE" &&
                  !moveDestinationId
                ) ||
                (
                  !isEmpty &&
                  deleteMode ===
                    "DELETE_ALL" &&
                  deleteConfirmation !==
                    "DELETE"
                )
              }
              className="rounded-xl bg-red-500 px-4 py-2.5 text-[10px] font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isBusy
                ? "Deleting..."
                : isEmpty
                ? "Delete folder"
                : deleteMode ===
                    "MOVE"
                ? "Move contents & delete"
                : "Delete permanently"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function publishMediaNow(
  mediaId: string,
) {
  const pathname =
    window.location.pathname;

  const targetPath =
    pathname.replace(
      /\/media\/?$/,
      "/distribution",
    );

  window.location.href =
    `${targetPath}?mediaId=${encodeURIComponent(
      mediaId,
    )}`;
}

async function shareMedia(
  media: MediaAsset,
  shareText: string,
  previewUrl?: string,
) {
  const url =
    previewUrl ||
    window.location.href;

  const shareData =
    {
      title:
        media.originalFileName,
      text:
        shareText,
      url,
    };

  try {
    if (
      navigator.share
    ) {
      await navigator.share(
        shareData,
      );

      return;
    }
  } catch (
    error
  ) {
    if (
      error instanceof
        DOMException &&
      error.name ===
        "AbortError"
    ) {
      return;
    }

    console.error(
      "MEDIA_NATIVE_SHARE_ERROR",
      error,
    );
  }

  const whatsappUrl =
    `https://wa.me/?text=${encodeURIComponent(
      `${shareData.text} ${url}`,
    )}`;

  window.open(
    whatsappUrl,
    "_blank",
    "noopener,noreferrer",
  );
}

function shareMediaToFacebook(
  previewUrl?: string,
) {
  const url =
    previewUrl ||
    window.location.href;

  const facebookUrl =
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      url,
    )}`;

  window.open(
    facebookUrl,
    "_blank",
    "noopener,noreferrer",
  );
}

function FilterButton({
  active,
  onClick,
  label,
  count,
  ready,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  ready?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
        active
          ? "border-blue-500/40 bg-blue-500/[0.08] text-white"
          : "border-white/[0.08] bg-white/[0.02] text-white/45 hover:text-white"
      }`}
    >
      {ready ? (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      ) : (
        <Video className="h-3.5 w-3.5" />
      )}

      <span className="text-[11px] font-medium">
        {
          label
        }
      </span>

      <span className="text-[10px] text-white/30">
        {
          count
        }
      </span>
    </button>
  );
}

function UploadQueuePanel({
  uploads,
  isUploading,
  onStart,
  onCancel,
  onRemove,
  onClear,
}: {
  uploads: ManagedUpload[];
  isUploading: boolean;
  onStart: () => void;
  onCancel: (
    localId: string,
  ) => void;
  onRemove: (
    localId: string,
  ) => void;
  onClear: () => void;
}) {
  const t =
    useTranslations(
      "mediaLibrary",
    );

  const [
    isExpanded,
    setIsExpanded,
  ] = useState(false);

  const readyCount =
    uploads.filter(
      (
        upload,
      ) =>
        upload.status ===
          "READY" ||
        upload.status ===
          "ERROR",
    ).length;

  const doneCount =
    uploads.filter(
      (
        upload,
      ) =>
        upload.status ===
        "DONE",
    ).length;

  const errorCount =
    uploads.filter(
      (
        upload,
      ) =>
        upload.status ===
        "ERROR",
    ).length;

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

  const overallProgress =
    totalBytes >
    0
      ? Math.min(
          100,
          Math.round(
            (uploadedBytes /
              totalBytes) *
              100,
          ),
        )
      : 0;

  const activeUpload =
    uploads.find(
      (
        upload,
      ) =>
        upload.status ===
          "STARTING" ||
        upload.status ===
          "UPLOADING" ||
        upload.status ===
          "COMPLETING",
    ) ??
    null;

  const statusText =
    isUploading
      ? `${doneCount}/${uploads.length}`
      : errorCount >
        0
      ? `${errorCount} error${errorCount === 1 ? "" : "s"}`
      : doneCount ===
          uploads.length
      ? "Complete"
      : `${uploads.length} queued`;

  const fileText =
    activeUpload
      ? activeUpload.file.name
      : uploads[
          uploads.length -
            1
        ]?.file.name ??
        "";

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-white/[0.07] bg-[#0a0f16]/90">
      <div className="relative flex h-9 items-center gap-2 px-2.5">
        {isUploading ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-300" />
        ) : errorCount >
          0 ? (
          <CircleAlert className="h-3.5 w-3.5 shrink-0 text-red-300" />
        ) : (
          <UploadCloud className="h-3.5 w-3.5 shrink-0 text-blue-300/75" />
        )}

        <div className="shrink-0 text-[9px] font-semibold text-white/55">
          {statusText}
        </div>

        <div className="min-w-0 flex-1 truncate text-[9px] text-white/28">
          {fileText}
        </div>

        <div className="shrink-0 text-[9px] font-semibold tabular-nums text-blue-200/75">
          {overallProgress}%
        </div>

        {!isUploading &&
          readyCount >
            0 && (
            <button
              type="button"
              onClick={
                onStart
              }
              className="shrink-0 rounded-md bg-white px-2 py-1 text-[8px] font-semibold text-[#080b12] transition hover:bg-white/90"
            >
              {doneCount >
              0
                ? t(
                    "retryPending",
                  )
                : "Start"}
            </button>
          )}

        <button
          type="button"
          onClick={() =>
            setIsExpanded(
              (
                current,
              ) =>
                !current,
            )
          }
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white/28 transition hover:bg-white/[0.05] hover:text-white/70"
          title={
            isExpanded
              ? "Hide upload details"
              : "Show upload details"
          }
          aria-label={
            isExpanded
              ? "Hide upload details"
              : "Show upload details"
          }
        >
          <ChevronRight
            className={`h-3.5 w-3.5 transition-transform ${
              isExpanded
                ? "rotate-90"
                : ""
            }`}
          />
        </button>

        {!isUploading && (
          <button
            type="button"
            onClick={
              onClear
            }
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white/20 transition hover:bg-white/[0.05] hover:text-white/60"
            title={t(
              "clearQueue",
            )}
            aria-label={t(
              "clearQueue",
            )}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/[0.04]">
          <div
            className={`h-full transition-[width] duration-300 ${
              errorCount >
              0
                ? "bg-red-400"
                : "bg-blue-400"
            }`}
            style={{
              width:
                `${overallProgress}%`,
            }}
          />
        </div>
      </div>

      {isExpanded && (
        <div className="max-h-[220px] divide-y divide-white/[0.05] overflow-y-auto border-t border-white/[0.05] bg-black/[0.08]">
          {uploads.map(
            (
              upload,
            ) => (
              <UploadQueueRow
                key={
                  upload.localId
                }
                upload={
                  upload
                }
                isBatchUploading={
                  isUploading
                }
                onCancel={
                  onCancel
                }
                onRemove={
                  onRemove
                }
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function UploadQueueRow({
  upload,
  isBatchUploading,
  onCancel,
  onRemove,
}: {
  upload: ManagedUpload;
  isBatchUploading: boolean;
  onCancel: (
    localId: string,
  ) => void;
  onRemove: (
    localId: string,
  ) => void;
}) {
  const t =
    useTranslations(
      "mediaLibrary",
    );

  const isActive =
    upload.status ===
      "STARTING" ||
    upload.status ===
      "UPLOADING" ||
    upload.status ===
      "COMPLETING";

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/[0.07]">
        {upload.status ===
        "DONE" ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
        ) : upload.status ===
          "ERROR" ? (
          <CircleAlert className="h-4 w-4 text-red-300" />
        ) : isActive ? (
          <Loader2 className="h-4 w-4 animate-spin text-blue-300" />
        ) : (
          <FileVideo2 className="h-4 w-4 text-blue-300" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[11px] font-medium text-white/80">
              {
                upload.file.name
              }
            </div>

            <div className="mt-0.5 text-[9px] text-white/25">
              {formatBytes(
                upload.file.size,
              )}
              {
                " · "
              }
              {getUploadStatusText(
                upload,
                t,
              )}
            </div>
          </div>

          <div className="shrink-0 text-[10px] font-medium text-white/40">
            {
              upload.progress
            }
            %
          </div>
        </div>

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${
              upload.status ===
              "ERROR"
                ? "bg-red-400"
                : upload.status ===
                  "DONE"
                  ? "bg-emerald-400"
                  : "bg-blue-400"
            }`}
            style={{
              width:
                `${upload.progress}%`,
            }}
          />
        </div>

        {upload.error && (
          <div className="mt-1.5 text-[9px] text-red-300/80">
            {
              upload.error
            }
          </div>
        )}
      </div>

      <div className="shrink-0">
        {isActive ? (
          <button
            type="button"
            onClick={() =>
              onCancel(
                upload.localId,
              )
            }
            className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-2.5 py-1.5 text-[10px] font-medium text-red-300"
          >
            {t(
              "cancel",
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              onRemove(
                upload.localId,
              )
            }
            disabled={
              isBatchUploading
            }
            className="rounded-lg p-1.5 text-white/25 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
            title={t(
              "removeFromQueue",
            )}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function MediaTile({
  media,
  previewUrl,
  isDeleting,
  categories,
  onPreview,
  onManageCategories,
  onRemove,
}: {
  media: MediaAsset;
  previewUrl?: string;
  isDeleting: boolean;
  categories: MediaCategory[];
  onPreview: () => void;
  onManageCategories: () => void;
  onRemove: () => void;
}) {
  const t =
    useTranslations(
      "mediaLibrary",
    );

  const locale =
    useLocale();

  return (
    <article className="group min-w-0 overflow-hidden rounded-[16px] border border-white/[0.08] bg-white/[0.018] shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition hover:border-white/[0.13] hover:bg-white/[0.025]">
      <button
        type="button"
        onClick={
          onPreview
        }
        className="relative block aspect-video w-full overflow-hidden bg-[#0d121b] text-left"
      >
        {previewUrl ? (
          media.mediaType ===
          "IMAGE" ? (
            <img
              src={
                previewUrl
              }
              alt={
                media.originalFileName
              }
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.015]"
            />
          ) : (
            <video
              src={
                previewUrl
              }
              preload="metadata"
              muted
              playsInline
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.015]"
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center">
            <FileVideo2 className="h-7 w-7 text-white/15" />
          </div>
        )}

        {media.mediaType !==
          "IMAGE" && (
          <>
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/25">
              <div className="flex h-10 w-10 scale-95 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white opacity-0 shadow-lg backdrop-blur-sm transition group-hover:scale-100 group-hover:opacity-100">
                <Play className="ml-0.5 h-4 w-4 fill-current" />
              </div>
            </div>

            <div className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-medium text-white">
              {formatDuration(
                media.durationSeconds,
              )}
            </div>
          </>
        )}
      </button>

      <div className="border-t border-white/[0.06]">
        <div className="px-3.5 py-3">
          <div className="truncate text-[12px] font-semibold text-white/90">
            {
              media.originalFileName
            }
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-white/28">
            <span>
              {formatBytes(
                Number(
                  media.fileSize,
                ),
              )}
            </span>

            <span className="text-white/12">
              •
            </span>

            <span>
              {formatDate(
                media.createdAt,
                locale,
              )}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusBadge
              status={
                media.status
              }
            />

            {categories
              .slice(
                0,
                2,
              )
              .map(
                (
                  category,
                ) => (
                  <span
                    key={
                      category.id
                    }
                    className="rounded-full border border-violet-500/15 bg-violet-500/[0.06] px-2 py-1 text-[8px] font-medium text-violet-200/80"
                  >
                    {
                      category.name
                    }
                  </span>
                ),
              )}

            {categories.length >
              2 && (
              <span className="text-[8px] text-white/25">
                +
                {
                  categories.length -
                  2
                }
              </span>
            )}
          </div>
        </div>

        <div className="border-t border-white/[0.06] bg-black/[0.08] px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={
                onPreview
              }
              className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.025] px-2 text-[9px] font-medium text-white/55 transition hover:bg-white/[0.05] hover:text-white"
            >
              <Play className="h-3 w-3" />

              {t(
                "preview",
              )}
            </button>

            <button
              type="button"
              onClick={
                onManageCategories
              }
              className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 text-[9px] text-white/45 transition hover:bg-white/[0.05] hover:text-white"
              title={t(
                "manageCategories",
              )}
            >
              <Tag className="h-3 w-3" />

              {t(
                "category",
              )}
            </button>
          </div>

          <div className="mt-1.5 grid grid-cols-[1fr_auto_auto_auto] gap-1.5">
            {media.status ===
              "UPLOADED" && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    publishMediaNow(
                      media.id,
                    )
                  }
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-blue-500/12 px-2 text-[9px] font-semibold text-blue-300 transition hover:bg-blue-500/20"
                >
                  <Send className="h-3 w-3" />

                  {t(
                    "publishNow",
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void shareMedia(
                      media,
                      t(
                        "shareText",
                        {
                          fileName:
                            media.originalFileName,
                        },
                      ),
                      previewUrl,
                    )
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] text-white/40 transition hover:bg-white/[0.05] hover:text-white"
                  title={t(
                    "share",
                  )}
                >
                  <Share2 className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    shareMediaToFacebook(
                      previewUrl,
                    )
                  }
                  className="flex h-8 items-center justify-center rounded-lg border border-white/[0.08] px-2 text-[8px] font-medium text-white/35 transition hover:bg-white/[0.05] hover:text-white"
                  title={t(
                    "shareToFacebook",
                  )}
                >
                  FB
                </button>
              </>
            )}

            <button
              type="button"
              onClick={
                onRemove
              }
              disabled={
                isDeleting
              }
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/15 bg-red-500/[0.025] text-red-300/65 transition hover:bg-red-500/[0.08] hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
              title={t(
                "removeVideo",
              )}
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function MediaListRow({
  media,
  previewUrl,
  isDeleting,
  categories,
  onPreview,
  onManageCategories,
  onRemove,
}: {
  media: MediaAsset;
  previewUrl?: string;
  isDeleting: boolean;
  categories: MediaCategory[];
  onPreview: () => void;
  onManageCategories: () => void;
  onRemove: () => void;
}) {
  const t =
    useTranslations(
      "mediaLibrary",
    );

  const locale =
    useLocale();

  return (
    <div className="flex items-center gap-3 border-b border-white/[0.06] bg-white/[0.015] px-4 py-3 last:border-b-0">
      <button
        type="button"
        onClick={
          onPreview
        }
        className="group relative h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-white/[0.07] bg-[#0d121b]"
      >
        {previewUrl ? (
          media.mediaType ===
          "IMAGE" ? (
            <img
              src={
                previewUrl
              }
              alt={
                media.originalFileName
              }
              className="h-full w-full object-cover"
            />
          ) : (
            <video
              src={
                previewUrl
              }
              preload="metadata"
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center">
            <FileVideo2 className="h-5 w-5 text-white/15" />
          </div>
        )}

        {media.mediaType !==
          "IMAGE" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/35">
            <Play className="h-4 w-4 fill-current text-white opacity-0 transition group-hover:opacity-100" />
          </div>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">
          {
            media.originalFileName
          }
        </div>

        <div className="mt-1 text-[10px] text-white/25">
          {formatBytes(
            Number(
              media.fileSize,
            ),
          )}
          {
            " · "
          }
          {formatDate(
            media.createdAt,
            locale,
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {categories
            .slice(
              0,
              4,
            )
            .map(
              (
                category,
              ) => (
                <span
                  key={
                    category.id
                  }
                  className="rounded-full border border-violet-500/15 bg-violet-500/[0.06] px-1.5 py-0.5 text-[8px] text-violet-200/75"
                >
                  {
                    category.name
                  }
                </span>
              ),
            )}

          <button
            type="button"
            onClick={
              onManageCategories
            }
            className="inline-flex items-center gap-1 rounded-full border border-white/[0.07] px-1.5 py-0.5 text-[8px] text-white/30 transition hover:text-white/65"
          >
            <Plus className="h-2.5 w-2.5" />

            {t(
              "category",
            )}
          </button>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.07] bg-black/[0.08] p-1.5">
        <StatusBadge
          status={
            media.status
          }
        />

        <button
          type="button"
          onClick={
            onPreview
          }
          className="rounded-lg border border-white/[0.07] p-1.5 text-white/40 transition hover:bg-white/[0.05] hover:text-white"
          title={t(
            "previewVideo",
          )}
        >
          <Play className="h-3.5 w-3.5" />
        </button>

        {media.status ===
          "UPLOADED" && (
          <>
            <button
              type="button"
              onClick={() =>
                publishMediaNow(
                  media.id,
                )
              }
              className="rounded-lg bg-blue-500/12 px-2.5 py-1.5 text-[9px] font-semibold text-blue-300 transition hover:bg-blue-500/20"
            >
              {t(
                "publishNow",
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                void shareMedia(
                  media,
                  t(
                    "shareText",
                    {
                      fileName:
                        media.originalFileName,
                    },
                  ),
                  previewUrl,
                )
              }
              className="rounded-lg border border-white/[0.08] p-1.5 text-white/35 transition hover:bg-white/[0.04] hover:text-white"
              title={t(
                "share",
              )}
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={
            onRemove
          }
          disabled={
            isDeleting
          }
          className="rounded-lg border border-red-500/15 bg-red-500/[0.035] p-1.5 text-red-300/70 transition hover:bg-red-500/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
          title={t(
            "removeVideo",
          )}
        >
          {isDeleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

function MediaViewerModal({
  media,
  previewUrl,
  onClose,
}: {
  media: MediaAsset;
  previewUrl?: string;
  onClose: () => void;
}) {
  const t =
    useTranslations(
      "mediaLibrary",
    );

  const locale =
    useLocale();

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-[1100px] overflow-hidden rounded-[22px] border border-white/[0.1] bg-[#090d14] shadow-[0_35px_120px_rgba(0,0,0,0.75)]">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-white/85">
              {
                media.originalFileName
              }
            </div>

            <div className="mt-0.5 text-[9px] text-white/25">
              {formatBytes(
                Number(
                  media.fileSize,
                ),
              )}
              {
                " · "
              }
              {formatDate(
                media.createdAt,
                locale,
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-white/40 transition hover:bg-white/[0.06] hover:text-white"
            aria-label={t(
              "closeVideoViewer",
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-[280px] items-center justify-center bg-black">
          {previewUrl ? (
            media.mediaType ===
            "IMAGE" ? (
              <img
                src={
                  previewUrl
                }
                alt={
                  media.originalFileName
                }
                className="max-h-[78vh] max-w-full object-contain"
              />
            ) : (
              <video
                src={
                  previewUrl
                }
                controls
                autoPlay
                playsInline
                preload="metadata"
                className="max-h-[78vh] w-full bg-black object-contain"
              />
            )
          ) : (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-white/25">
              <FileVideo2 className="h-10 w-10" />

              <div className="text-xs">
                Preview unavailable.
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3">
          <StatusBadge
            status={
              media.status
            }
          />

          {media.status ===
            "UPLOADED" && (
            <button
              type="button"
              onClick={() =>
                publishMediaNow(
                  media.id,
                )
              }
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-500/12 px-3 text-[9px] font-semibold text-blue-300 transition hover:bg-blue-500/20"
            >
              <Send className="h-3 w-3" />

              {t(
                "publishNow",
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MediaCategoryModal({
  media,
  categories,
  assignedCategories,
  onClose,
  onCategoriesChanged,
}: {
  media: MediaAsset;
  categories: MediaCategory[];
  assignedCategories: MediaCategory[];
  onClose: () => void;
  onCategoriesChanged: () => Promise<void>;
}) {
  const t =
    useTranslations(
      "mediaLibrary",
    );

  const [
    newCategoryName,
    setNewCategoryName,
  ] = useState("");

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const assignedIds =
    new Set(
      assignedCategories.map(
        (
          category,
        ) =>
          category.id,
      ),
    );

  async function createAndAssignCategory() {
    const name =
      newCategoryName.trim();

    if (
      !name
    ) {
      return;
    }

    try {
      setIsSaving(
        true,
      );
      setError(
        "",
      );

      const createResponse =
        await fetch(
          "/api/media/categories",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                {
                  name,
                },
              ),
          },
        );

      const createData =
        (await createResponse.json()) as CategoryAssignmentResponse;

      if (
        !createResponse.ok ||
        !createData.success ||
        !createData.category
      ) {
        throw new Error(
          createData.message ||
            createData.error ||
            t(
              "unableToCreateCategory",
            ),
        );
      }

      await assignCategory(
        createData
          .category
          .id,
        false,
      );

      setNewCategoryName(
        "",
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : t(
              "unableToCreateCategory",
            ),
      );
    } finally {
      setIsSaving(
        false,
      );
    }
  }

  async function assignCategory(
    categoryId: string,
    manageSaving =
      true,
  ) {
    try {
      if (
        manageSaving
      ) {
        setIsSaving(
          true,
        );
        setError(
          "",
        );
      }

      const response =
        await fetch(
          `/api/media/${media.id}/categories`,
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                {
                  categoryId,
                },
              ),
          },
        );

      const data =
        (await response.json()) as CategoryAssignmentResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            data.error ||
            t(
              "unableToAssignCategory",
            ),
        );
      }

      await onCategoriesChanged();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : t(
              "unableToAssignCategory",
            ),
      );

      throw caughtError;
    } finally {
      if (
        manageSaving
      ) {
        setIsSaving(
          false,
        );
      }
    }
  }

  async function removeCategory(
    categoryId: string,
  ) {
    try {
      setIsSaving(
        true,
      );
      setError(
        "",
      );

      const response =
        await fetch(
          `/api/media/${media.id}/categories`,
          {
            method:
              "DELETE",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                {
                  categoryId,
                },
              ),
          },
        );

      const data =
        (await response.json()) as CategoryAssignmentResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            data.error ||
            t(
              "unableToRemoveCategory",
            ),
        );
      }

      await onCategoriesChanged();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : t(
              "unableToRemoveCategory",
            ),
      );
    } finally {
      setIsSaving(
        false,
      );
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[520px] overflow-hidden rounded-[22px] border border-white/[0.09] bg-[#0b1018] shadow-[0_30px_100px_rgba(0,0,0,0.65)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-violet-300" />

              <div className="text-sm font-semibold text-white/85">
                {t(
                  "mediaCategories",
                )}
              </div>
            </div>

            <div className="mt-1 max-w-[390px] truncate text-[10px] text-white/30">
              {
                media.originalFileName
              }
            </div>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="rounded-lg p-1.5 text-white/25 transition hover:bg-white/[0.05] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/25">
            {t(
              "assignedCategories",
            )}
          </div>

          <div className="mt-2 flex min-h-[34px] flex-wrap gap-1.5">
            {assignedCategories.length ===
            0 ? (
              <div className="text-[10px] text-white/20">
                {t(
                  "noCategoriesAssigned",
                )}
              </div>
            ) : (
              assignedCategories.map(
                (
                  category,
                ) => (
                  <button
                    key={
                      category.id
                    }
                    type="button"
                    disabled={
                      isSaving
                    }
                    onClick={() =>
                      void removeCategory(
                        category.id,
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/[0.08] px-2.5 py-1.5 text-[9px] text-violet-200 transition hover:bg-red-500/[0.08] hover:text-red-200 disabled:opacity-50"
                    title={t(
                      "removeCategoryFromVideo",
                    )}
                  >
                    {
                      category.name
                    }

                    <X className="h-2.5 w-2.5" />
                  </button>
                ),
              )
            )}
          </div>

          <div className="mt-5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/25">
            {t(
              "availableCategories",
            )}
          </div>

          <div className="mt-2 max-h-[190px] overflow-y-auto rounded-xl border border-white/[0.06] bg-white/[0.015] p-2">
            {categories.length ===
            0 ? (
              <div className="px-2 py-4 text-center text-[10px] text-white/20">
                {t(
                  "createFirstCategory",
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {categories.map(
                  (
                    category,
                  ) => {
                    const assigned =
                      assignedIds.has(
                        category.id,
                      );

                    return (
                      <button
                        key={
                          category.id
                        }
                        type="button"
                        disabled={
                          isSaving ||
                          assigned
                        }
                        onClick={() =>
                          void assignCategory(
                            category.id,
                          )
                        }
                        className={`rounded-full border px-2.5 py-1.5 text-[9px] transition ${
                          assigned
                            ? "cursor-default border-emerald-500/15 bg-emerald-500/[0.05] text-emerald-300/60"
                            : "border-white/[0.08] bg-white/[0.025] text-white/45 hover:bg-violet-500/[0.08] hover:text-violet-200"
                        } disabled:opacity-70`}
                      >
                        {assigned
                          ? "✓ "
                          : "+ "}

                        {
                          category.name
                        }
                      </button>
                    );
                  },
                )}
              </div>
            )}
          </div>

          <div className="mt-5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/25">
            {t(
              "createNewCategory",
            )}
          </div>

          <div className="mt-2 flex gap-2">
            <input
              value={
                newCategoryName
              }
              onChange={(
                event,
              ) =>
                setNewCategoryName(
                  event.target
                    .value,
                )
              }
              onKeyDown={(
                event,
              ) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  event.preventDefault();
                  void createAndAssignCategory();
                }
              }}
              maxLength={
                80
              }
              placeholder={t(
                "categoryPlaceholder",
              )}
              className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-[#0c1119] px-3 py-2.5 text-xs text-white outline-none placeholder:text-white/20 focus:border-violet-500/30"
            />

            <button
              type="button"
              disabled={
                isSaving ||
                !newCategoryName.trim()
              }
              onClick={() =>
                void createAndAssignCategory()
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500/15 px-4 py-2.5 text-[10px] font-semibold text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}

              {t(
                "create",
              )}
            </button>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-red-500/15 bg-red-500/[0.05] px-3 py-2 text-[10px] text-red-300">
              {
                error
              }
            </div>
          )}

          <div className="mt-4 text-[9px] leading-4 text-white/20">
            {t(
              "categoryHelp",
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const t =
    useTranslations(
      "mediaLibrary",
    );

  const className =
    status ===
    "UPLOADED"
      ? "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300"
      : status ===
        "UPLOADING"
      ? "border-blue-500/20 bg-blue-500/[0.08] text-blue-300"
      : status ===
        "CANCELLED"
      ? "border-white/[0.08] bg-white/[0.03] text-white/35"
      : "border-amber-500/20 bg-amber-500/[0.08] text-amber-300";

  return (
    <span
      className={`inline-flex rounded-full border px-1.5 py-0.5 text-[8px] font-medium ${className}`}
    >
      {formatMediaStatus(
        status,
        t,
      )}
    </span>
  );
}

function getUploadStatusText(
  upload: ManagedUpload,
  t: (
    key: string,
    values?: Record<
      string,
      string | number
    >,
  ) => string,
) {
  switch (
    upload.status
  ) {
    case "READY":
      return t(
        "uploadStatusReady",
      );

    case "STARTING":
      return t(
        "uploadStatusPreparing",
      );

    case "UPLOADING":
      return t(
        "uploadStatusProgress",
        {
          uploaded:
            formatBytes(
              upload.uploadedBytes,
            ),
          total:
            formatBytes(
              upload.file.size,
            ),
        },
      );

    case "COMPLETING":
      return t(
        "uploadStatusFinalizing",
      );

    case "DONE":
      return t(
        "uploadStatusComplete",
      );

    case "CANCELLED":
      return t(
        "uploadStatusCancelled",
      );

    case "ERROR":
      return t(
        "uploadStatusFailed",
      );

    default:
      return "";
  }
}

function formatMediaStatus(
  status: string,
  t: (
    key: string,
  ) => string,
) {
  switch (
    status
  ) {
    case "UPLOADED":
      return t(
        "mediaStatusReadyToPublish",
      );

    case "UPLOADING":
      return t(
        "mediaStatusUploading",
      );

    case "CANCELLED":
      return t(
        "mediaStatusCancelled",
      );

    case "PROCESSING":
      return t(
        "mediaStatusProcessing",
      );

    case "READY":
      return t(
        "mediaStatusReady",
      );

    case "FAILED":
      return t(
        "mediaStatusFailed",
      );

    default:
      return status;
  }
}

function formatDuration(
  seconds: number | null,
) {
  if (
    seconds ===
      null ||
    seconds <=
      0
  ) {
    return "--:--";
  }

  const minutes =
    Math.floor(
      seconds /
        60,
    );

  const remaining =
    seconds %
    60;

  return `${minutes}:${String(
    remaining,
  ).padStart(
    2,
    "0",
  )}`;
}

function formatBytes(
  value: number,
) {
  if (
    !Number.isFinite(
      value,
    ) ||
    value <=
      0
  ) {
    return "0 B";
  }

  const units =
    [
      "B",
      "KB",
      "MB",
      "GB",
      "TB",
    ];

  const index =
    Math.min(
      units.length -
        1,
      Math.floor(
        Math.log(
          value,
        ) /
          Math.log(
            1024,
          ),
      ),
    );

  const amount =
    value /
    1024 ** index;

  return `${amount.toFixed(
    index ===
      0
      ? 0
      : amount >=
        10
      ? 1
      : 2,
  )} ${units[index]}`;
}

function formatDate(
  value: string,
  locale: string,
) {
  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    locale,
    {
      month:
        "short",
      day:
        "2-digit",
      year:
        "numeric",
    },
  ).format(
    date,
  );
}