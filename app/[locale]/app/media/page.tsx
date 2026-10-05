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

export default function MediaLibraryPage() {
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [categories, setCategories] = useState<MediaCategory[]>([]);
  const [assigned, setAssigned] = useState<Record<string, MediaCategory[]>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
  const [viewer, setViewer] = useState<MediaAsset | null>(null);
  const [categoryMedia, setCategoryMedia] = useState<MediaAsset | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {uploads, isUploading, addFiles, startAll, cancelUpload, removeUpload, clearQueue} = useUploadManager();
  const loadMedia = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [response, categoryResponse] = await Promise.all([fetch('/api/media'), fetch('/api/media/categories')]);
      const data: MediaResponse = await response.json();
      if (!response.ok || !data.success) throw new Error(response.status === 401 ? 'Your session has expired. Sign in again.' : 'Unable to load your media library.');
      const categoryData: CategoriesResponse = await categoryResponse.json();
      if (!categoryResponse.ok || !categoryData.success) throw new Error('Unable to load media categories.');
      const items = data.media ?? [];
      setMedia(items); setCategories(categoryData.categories ?? []);
      const assignments = await Promise.all(items.map(async item => {
        const result = await fetch(`/api/media/${item.id}/categories`);
        const data: CategoriesResponse = await result.json();
        if (!result.ok || !data.success) throw new Error('Unable to load assigned categories.');
        return [item.id, data.categories ?? []] as const;
      }));
      setAssigned(Object.fromEntries(assignments));
      const urls = await Promise.all(items.filter(item => item.status === 'UPLOADED').map(async item => {
        const result = await fetch(`/api/media/${item.id}/preview`);
        const data: PreviewResponse = await result.json();
        return [item.id, result.ok && data.success ? data.previewUrl ?? '' : ''] as const;
      }));
      setPreviews(Object.fromEntries(urls));
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to load your media library.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void loadMedia();
    const refresh = () => { void loadMedia(); };
    window.addEventListener('creator-platform:media-updated', refresh);
    return () => window.removeEventListener('creator-platform:media-updated', refresh);
  }, [loadMedia]);
  function queueFiles(files: File[]) {
    const result = addFiles(files, {});
    if (!result.success) setError(result.error ?? 'Unable to queue files.');
  }
  async function removeMedia(item: MediaAsset) {
    if (!window.confirm(`Delete "${item.originalFileName}" from your library and storage?`)) return;
    setDeleting(item.id); setError('');
    try {
      const response = await fetch(`/api/media/${item.id}`, {method:'DELETE'});
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message ?? 'Unable to delete this media.');
      await loadMedia();
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to delete this media.'); }
    finally { setDeleting(null); }
  }
  const filtered = media.filter(item => item.originalFileName.toLowerCase().includes(query.toLowerCase()) && (type === 'ALL' || item.mediaType === type) && (status === 'ALL' || item.status === status) && (category === 'ALL' || assigned[item.id]?.some(entry => entry.id === category)));
  const control = 'min-h-11 rounded-xl border border-white/[0.08] bg-[#0c1119] px-3 text-xs text-white/70 outline-none focus:border-blue-400/50';
  return <main className="mx-auto max-w-[1540px] p-5 text-white sm:p-7 lg:p-8" onDragOver={event => event.preventDefault()} onDrop={event => {event.preventDefault(); queueFiles(Array.from(event.dataTransfer.files));}}>
    <input ref={inputRef} type="file" multiple accept="video/mp4,video/quicktime,video/x-m4v,image/jpeg,image/png,image/webp,.mp4,.mov,.m4v,.jpg,.jpeg,.png,.webp" className="hidden" onChange={event => {queueFiles(Array.from(event.target.files ?? [])); event.target.value='';}}/>
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-[28px] font-semibold tracking-tight">Media Library</h1><p className="mt-1 text-xs text-white/40">Your store's video and image repository.</p></div><div className="flex gap-2"><button onClick={() => void loadMedia()} disabled={loading} aria-label="Refresh media library" className={control}><RefreshCw size={16}/></button><button onClick={() => inputRef.current?.click()} className="flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 text-xs font-semibold"><UploadCloud size={16}/> Select Files</button></div></header>
    {uploads.length > 0 && <UploadQueuePanel uploads={uploads} isUploading={isUploading} onStart={() => void startAll()} onCancel={cancelUpload} onRemove={removeUpload} onClear={clearQueue}/>}
    {error && <p role="alert" className="mb-5 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-xs text-red-200">{error}</p>}
    <div className="mb-5 flex flex-wrap items-center gap-3"><input aria-label="Search media" placeholder="Search media..." value={query} onChange={event => setQuery(event.target.value)} className={`${control} min-w-48 flex-1`}/><select aria-label="Media type" value={type} onChange={event => setType(event.target.value)} className={control}><option value="ALL">All Media</option><option value="VIDEO">Videos</option><option value="IMAGE">Images</option></select><select aria-label="Category" value={category} onChange={event => setCategory(event.target.value)} className={control}><option value="ALL">All Categories</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Status" value={status} onChange={event => setStatus(event.target.value)} className={control}><option value="ALL">All Statuses</option><option value="UPLOADED">Uploaded</option><option value="UPLOADING">Uploading</option><option value="FAILED">Failed</option><option value="CANCELLED">Cancelled</option></select><button aria-label="Grid view" aria-pressed={viewMode==='GRID'} onClick={() => setViewMode('GRID')} className={control}><Grid2X2 size={16}/></button><button aria-label="List view" aria-pressed={viewMode==='LIST'} onClick={() => setViewMode('LIST')} className={control}><List size={16}/></button></div>
    <p className="mb-4 text-xs text-white/35">{media.length} media assets{filtered.length !== media.length ? ` · ${filtered.length} matching filters` : ''}</p>
    {loading ? <div role="status" className="flex items-center justify-center gap-3 py-20 text-sm text-white/40"><Loader2 className="animate-spin" size={18}/> Loading media...</div> : !filtered.length ? <section className="rounded-2xl border border-dashed border-white/10 py-20 text-center"><FileVideo2 className="mx-auto mb-4 text-white/20" size={32}/><h2 className="text-lg">{media.length ? 'No matching media' : 'Your library is ready for a fresh start.'}</h2><p className="mt-3 text-sm text-white/40">{media.length ? 'Try another search or filter.' : 'Select files or drop them here to add your first videos and images.'}</p></section> : <div className={viewMode==='GRID' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'overflow-hidden rounded-2xl border border-white/10'}>{filtered.map(item => {
      const Tile = viewMode==='GRID' ? MediaTile : MediaListRow;
      return <Tile key={item.id} media={item} previewUrl={previews[item.id]} categories={assigned[item.id] ?? []} isDeleting={deleting===item.id} onPreview={() => setViewer(item)} onManageCategories={() => setCategoryMedia(item)} onRemove={() => void removeMedia(item)}/>;
    })}</div>}
    {viewer && <MediaViewerModal media={viewer} previewUrl={previews[viewer.id]} onClose={() => setViewer(null)}/>}
    {categoryMedia && <MediaCategoryModal media={categoryMedia} categories={categories} assignedCategories={assigned[categoryMedia.id] ?? []} onClose={() => setCategoryMedia(null)} onCategoriesChanged={loadMedia}/>}
  </main>;
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