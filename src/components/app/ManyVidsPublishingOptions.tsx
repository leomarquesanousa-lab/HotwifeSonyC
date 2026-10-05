"use client";

import { teaserStartIssue } from "@/src/lib/platforms/manyvids/http/teaser-validation";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { coPerformerSchema, type ManyVidsCoPerformer, type PublishInput } from "@/src/lib/platforms/manyvids/http/types";
import type { LocalOptions } from "@/src/lib/platforms/manyvids/http/local-options";

export type ManyVidsFormValue = Pick<PublishInput, "performers" | "thumbnail" | "teaser"> & { confirmedNoPerformers: boolean; performerRowIds: string[]; previewFrameTime?: number };
export const emptyManyVidsOptions = (): ManyVidsFormValue => ({ performers: [], performerRowIds: [], confirmedNoPerformers: false, thumbnail: { source: "generate_from_video" }, teaser: { source: "generate_from_video", startTime: 0 } });
const field = "mt-1 w-full rounded-lg border border-white/15 bg-[#111722] p-2 text-sm text-white";
const button = "rounded-lg border border-white/20 px-3 py-2 text-xs disabled:opacity-40";

function FramePreview({ mediaId, duration, time, onTime }: { mediaId: string; duration: number; time: number; onTime: (time: number) => void }) {
  const t = useTranslations("manyVids");
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const valid = Number.isFinite(time) && time >= 0 && time < duration;
  useEffect(() => {
    const element = video.current;
    if (valid && element && element.readyState >= 1 && Math.abs(element.currentTime - time) > 0.01) element.currentTime = time;
  }, [time, valid]);
  return <div className="space-y-2">
    <p>{t("framePreviewNotice")}</p>
    <label>{t("frameSeconds")}<input className={field} type="number" min="0" max={duration || undefined} step="0.1" value={Number.isFinite(time) ? time : ""} onChange={(event) => onTime(event.target.valueAsNumber)} /></label>
    {!valid && <p role="status">{t("invalidFrame")}</p>}
    {failed && <p role="status">{t("previewUnavailable")}</p>}
    {mediaId && <video ref={video} controls preload="metadata" className="max-h-56 w-full rounded-lg" src={`/api/media/${encodeURIComponent(mediaId)}/thumbnail-source`}
      onError={() => setFailed(true)} onLoadedMetadata={(event) => { if (valid) event.currentTarget.currentTime = time; }}
      onSeeked={(event) => { const next = event.currentTarget.currentTime; if (!Number.isFinite(time) || Math.abs(next - time) > 0.05) onTime(next); }} />}
  </div>;
}

function ImageLibraryPicker({ assets, selected, performerId, onSelect }: { assets: LocalOptions["assets"]; selected: string; performerId: string; onSelect: (id: string) => void }) {
  const t = useTranslations("manyVids");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(12);
  const images = assets.filter((asset) => asset.mediaType === "IMAGE" && ["image/jpeg", "image/png"].includes(asset.contentType ?? "") && asset.fileSize > 0 && asset.label.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Number(b.performerIds?.includes(performerId)) - Number(a.performerIds?.includes(performerId)) || a.label.localeCompare(b.label));
  return <div className="space-y-2">
    <label>{t("searchImages")}<input className={field} value={query} onChange={(event) => { setQuery(event.target.value); setLimit(12); }} /></label>
    {selected && <div><AssetPreview id={selected} video={false} /><button type="button" className={button} onClick={() => onSelect("")}>{t("removeImage")}</button></div>}
    <div className="grid max-h-80 grid-cols-2 gap-2 overflow-auto md:grid-cols-3">
      {images.slice(0, limit).map((asset) => <button key={asset.id} type="button" aria-pressed={selected === asset.id} className="overflow-hidden rounded-lg border border-white/15 p-2 text-left aria-pressed:border-pink-400" onClick={() => onSelect(asset.id)}><AssetPreview id={asset.id} video={false} /><span className="mt-1 block truncate">{asset.label}</span></button>)}
    </div>
    {!images.length && <p>{t("noImages")}</p>}
    {images.length > limit && <button type="button" className={button} onClick={() => setLimit((n) => n + 12)}>{t("showMore")}</button>}
  </div>;
}

function AssetPreview({ id, video }: { id: string; video: boolean }) {
  const t = useTranslations("manyVids");
  const [preview, setPreview] = useState<{ id: string; url: string } | null>(null);
  const [failed, setFailed] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    if (id) void fetch(`/api/media/${encodeURIComponent(id)}/preview`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const data = await response.json();
      if (!response.ok || !data.success || !data.previewUrl) throw new Error();
      setPreview({ id, url: data.previewUrl });
    }).catch(() => { if (!controller.signal.aborted) setFailed(id); });
    return () => controller.abort();
  }, [id]);
  if (!id) return null;
  if (failed === id) return <p>{t("previewUnavailable")}</p>;
  if (preview?.id !== id) return <p>{t("loadingPreview")}</p>;
  return video ? <video controls preload="metadata" src={preview.url} className="mt-2 max-h-48 rounded-lg" /> : <img src={preview.url} alt={t("thumbnailAlt")} className="mt-2 max-h-48 rounded-lg" />;
}

function AccountSearch({ accountId, selected, onSelect }: { accountId: string; selected: string; onSelect: (performer: ManyVidsCoPerformer) => void }) {
  const t = useTranslations("manyVids");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: number; label: string; username: string }>>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function search() {
    setLoading(true); setError(""); setResults([]);
    try {
      const response = await fetch(`/api/performers/manyvids/search?platformAccountId=${encodeURIComponent(accountId)}&keywords=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error();
      setResults(data.data?.stars ?? []);
      if (!data.data?.stars?.length) setError("noAccounts");
    } catch { setError("searchFailed"); }
    finally { setLoading(false); }
  }
  return <div className="space-y-2">
    {selected && <p className="text-emerald-300">{t("accountVerified", { id: selected })}</p>}
    <label>{t("searchAccount")}<input className={field} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (query.trim().length >= 2 && !loading) void search(); } }} /></label>
    <button type="button" className={button} disabled={loading || query.trim().length < 2 || !accountId} onClick={() => void search()}>{t(loading ? "searching" : "changeAccount")}</button>
    {error && <p role="status">{t(error)}</p>}
    {results.map((result) => <button key={result.id} type="button" className={`${button} block w-full text-left`} onClick={() => { onSelect({ mode: "account", remotePerformerId: String(result.id), label: result.label || result.username }); setResults([]); }}>{result.label} · @{result.username}</button>)}
  </div>;
}

export function ManyVidsPublishingOptions({ value, onChange, accountId, videoDuration: suppliedDuration, mediaId, performerId, locale, publishMode, onBlockReason, onVideoMetadata }: {
  value: ManyVidsFormValue; onChange: (value: ManyVidsFormValue) => void; accountId: string; videoDuration: number | null; onVideoMetadata?: (asset: LocalOptions["assets"][number]) => void; mediaId: string; performerId: string; locale: string; publishMode: string; onBlockReason: (reason: string) => void;
}) {
  const t = useTranslations("manyVids");
  const format = useFormatter();
  const [catalog, setCatalog] = useState<{ accountId: string; revision: number; data: LocalOptions } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/distribution/manyvids/options?platformAccountId=${encodeURIComponent(accountId)}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error();
      if (controller.signal.aborted) return;
      setCatalog({ accountId, revision: refresh, data }); setLoadError(false);
    }).catch(() => { if (!controller.signal.aborted) setLoadError(true); });
    return () => controller.abort();
  }, [accountId, refresh]);
  useEffect(() => {
    const refreshCatalog = () => setRefresh((n) => n + 1);
    window.addEventListener("focus", refreshCatalog);
    window.addEventListener("creator-platform:media-updated", refreshCatalog);
    return () => { window.removeEventListener("focus", refreshCatalog); window.removeEventListener("creator-platform:media-updated", refreshCatalog); };
  }, []);
  const options = catalog?.accountId === accountId ? catalog.data : null;
  const asset = options?.assets.find(item => item.id === mediaId);
  const videoDuration = asset?.durationSeconds && asset.durationSeconds > 0 ? asset.durationSeconds : suppliedDuration;
  useEffect(() => {
    if (asset && onVideoMetadata && asset.durationSeconds && asset.width && asset.height) onVideoMetadata(asset);
  }, [asset, onVideoMetadata]);
  let reason = !options ? "loadingLibrary" : "";
  if (loadError) reason = "libraryFailed";
  if (value.performers.length === 0 && !value.confirmedNoPerformers) reason = "confirmPerformers";
  const states = value.performers.map((performer) => {
    if (performer.mode === "account") return coPerformerSchema.safeParse(performer).success ? "account" : "account_required";
    const docs = options?.performers.find((local) => local.id === performer.localPerformerId)?.documents ?? [];
    return performer.label.trim() && docs.some((doc) => doc.id === performer.idDocumentId && doc.role === "identity") && docs.some((doc) => doc.id === performer.consentDocumentId && doc.role === "consent" && doc.source === performer.consentSource) ? "documents_ready" : "documents_required";
  });
  if (states.includes("account_required") || states.includes("documents_required")) reason = "completePerformers";
  const keys = value.performers.map((performer) => performer.mode === "account" ? `account:${performer.remotePerformerId}` : `documents:${performer.localPerformerId}`);
  if (new Set(keys).size !== keys.length) reason = "duplicatePerformers";
  const thumbnail = value.thumbnail;
  const teaser = value.teaser;
  if (thumbnail.source === "upload_custom") {
    reason = options?.assets.some((asset) => asset.id === thumbnail.mediaAssetId && asset.mediaType === "IMAGE") ? "customThumbnailUnavailable" : "selectThumbnail";
  } else if (thumbnail.frameTime !== undefined) reason = Number.isFinite(thumbnail.frameTime) && thumbnail.frameTime >= 0 && thumbnail.frameTime < (videoDuration ?? 0) ? "exactFrameUnavailable" : "invalidFrame";
  if (teaser.source === "upload_custom") {
    const asset = options?.assets.find((item) => item.id === teaser.mediaAssetId && item.mediaType === "VIDEO");
    reason = !asset ? "selectTeaser" : !asset.durationSeconds || asset.durationSeconds > 30 || asset.fileSize <= 0 || asset.fileSize >= 50_000_000 ? "teaserLimits" : "customTeaserUnavailable";
  } else { const issue = teaserStartIssue(teaser.startTime, videoDuration); if (issue) reason = issue; }
  if (states.includes("documents_ready")) reason = "documentsUnavailable";
  if (!options) reason = loadError ? "libraryFailed" : "loadingLibrary";

  useEffect(() => { onBlockReason(reason); }, [reason, onBlockReason]);
  const updatePerformer = (index: number, performer: ManyVidsCoPerformer) => onChange({ ...value, performers: value.performers.map((item, i) => i === index ? performer : item), confirmedNoPerformers: false });
  return <div className="space-y-4 text-xs text-white/75">
    <fieldset className="space-y-2 rounded-lg border border-white/10 p-3"><legend>{t("thumbnail")}</legend>
      <label>{t("source")}<select className={field} value={thumbnail.source} onChange={(event) => onChange({ ...value, thumbnail: event.target.value === "upload_custom" ? { source: "upload_custom", mediaAssetId: "" } : { source: "generate_from_video" } })}><option value="generate_from_video">{t("generateFromVideo")}</option><option value="upload_custom">{t("customThumbnail")} — {t("localPreviewOnly")}</option></select></label>
      {thumbnail.source === "upload_custom" ? <>
        <p role="status">{t("customThumbnailNotice")}</p>
        <ImageLibraryPicker assets={options?.assets ?? []} selected={thumbnail.mediaAssetId} performerId={performerId} onSelect={(mediaAssetId) => onChange({ ...value, thumbnail: { source: "upload_custom", mediaAssetId } })} />
      </> : <FramePreview mediaId={mediaId} duration={videoDuration ?? 0} time={value.previewFrameTime ?? 0} onTime={(previewFrameTime) => onChange({ ...value, previewFrameTime, thumbnail: { source: "generate_from_video" } })} />}

    </fieldset>
    <fieldset className="space-y-2 rounded-lg border border-white/10 p-3"><legend>{t("teaser")}</legend>
      <label>{t("source")}<select className={field} value={teaser.source} onChange={(event) => onChange({ ...value, teaser: event.target.value === "upload_custom" ? { source: "upload_custom", mediaAssetId: "" } : { source: "generate_from_video", startTime: 0 } })}><option value="generate_from_video">{t("generateFromVideo")}</option><option value="upload_custom" disabled>{t("customTeaser")} — {t("notSupported")}</option></select></label>
      {teaser.source === "upload_custom" ? <><p>{t("notSupported")}</p><label>{t("libraryVideo")}<select className={field} disabled value={teaser.mediaAssetId} onChange={(event) => onChange({ ...value, teaser: { ...teaser, mediaAssetId: event.target.value } })}><option value="">{t("clearSelection")}</option>{options?.assets.filter((asset) => asset.mediaType === "VIDEO").map((asset) => <option key={asset.id} value={asset.id}>{t("assetDetails", { name: asset.label, duration: asset.durationSeconds == null ? t("unknownDuration") : format.number(asset.durationSeconds), size: format.number(asset.fileSize / 1_000_000, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}</option>)}</select></label><p>{t("teaserHelp")}</p><AssetPreview id={teaser.mediaAssetId} video /></> : <>
        <label>{t("startSeconds")}<input className={field} type="number" min="0" step="0.1" value={Number.isFinite(teaser.startTime) ? teaser.startTime : ""} onChange={(event) => onChange({ ...value, teaser: { ...teaser, startTime: event.target.valueAsNumber } })} /></label>
        <p>{t("automaticTeaserDuration")}</p>
      </>}
    </fieldset>
    <fieldset className="space-y-3 rounded-lg border border-white/10 p-3"><legend>{t("coPerformers")}</legend>
      {value.performers.length === 0 && <label className="flex gap-2"><input type="checkbox" checked={value.confirmedNoPerformers} onChange={(event) => onChange({ ...value, confirmedNoPerformers: event.target.checked })} />{t("noPerformersConfirmation")}</label>}
      {value.performers.map((performer, index) => <div key={value.performerRowIds[index]} className="space-y-2 rounded-lg border border-white/15 p-3">
        <label>{t("performerName")}<input className={field} value={performer.label} onChange={(event) => updatePerformer(index, { ...performer, label: event.target.value })} /></label>
        <p>{t("validationMethod")}</p>
        <label className="mr-3"><input type="radio" checked={performer.mode === "account"} onChange={() => updatePerformer(index, { mode: "account", label: performer.label, remotePerformerId: "" })} /> {t("hasAccount")}</label>
        <label><input type="radio" disabled checked={performer.mode === "documents"} onChange={() => updatePerformer(index, { mode: "documents", label: performer.label, localPerformerId: "", idDocumentId: "", consentDocumentId: "", consentSource: "document" })} /> {t("noAccount")} — {t("notSupported")}</label>
        {performer.mode === "account" ? <AccountSearch accountId={accountId} selected={performer.remotePerformerId} onSelect={(next) => updatePerformer(index, next)} /> : <fieldset disabled className="space-y-2 opacity-60"><p>{t("notSupported")}</p>
          <label>{t("libraryPerformer")}<select className={field} value={performer.localPerformerId} onChange={(event) => updatePerformer(index, { ...performer, localPerformerId: event.target.value, label: options?.performers.find((item) => item.id === event.target.value)?.label ?? performer.label, idDocumentId: "", consentDocumentId: "" })}><option value="">{t("select")}</option>{options?.performers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label>{t("idDocument")}<select className={field} value={performer.idDocumentId} onChange={(event) => updatePerformer(index, { ...performer, idDocumentId: event.target.value })}><option value="">{t("select")}</option>{options?.performers.find((item) => item.id === performer.localPerformerId)?.documents.filter((doc) => doc.role === "identity").map((doc) => <option key={doc.id} value={doc.id}>{doc.source === "agreement" && doc.agreementDate ? t("signedRelease", { date: format.dateTime(new Date(doc.agreementDate), { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" }) }) : doc.label}</option>)}</select></label>
          <label>{t("consentForm")}<select className={field} value={performer.consentDocumentId ? `${performer.consentSource}:${performer.consentDocumentId}` : ""} onChange={(event) => { const [source, id] = event.target.value.split(":"); updatePerformer(index, { ...performer, consentSource: source === "agreement" ? "agreement" : "document", consentDocumentId: id ?? "" }); }}><option value="">{t("select")}</option>{options?.performers.find((item) => item.id === performer.localPerformerId)?.documents.filter((doc) => doc.role === "consent").map((doc) => <option key={`${doc.source}:${doc.id}`} value={`${doc.source}:${doc.id}`}>{doc.source === "agreement" && doc.agreementDate ? t("signedRelease", { date: format.dateTime(new Date(doc.agreementDate), { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" }) }) : doc.label}</option>)}</select></label>
          <p className={states[index] === "documents_ready" ? "text-emerald-300" : "text-amber-200"}>{t(states[index] === "documents_ready" ? "documentsReady" : "documentsIncomplete")}</p>
          <p>{t("documentsHelp")}</p>
          <a href={`/${locale}/app/performers${performer.localPerformerId ? `/${encodeURIComponent(performer.localPerformerId)}` : ""}`} target="_blank" rel="noreferrer" className="underline">{t("manageDocuments")}</a>
        </fieldset>}
        <button type="button" className={button} onClick={() => onChange({ ...value, performers: value.performers.filter((_, i) => i !== index), performerRowIds: value.performerRowIds.filter((_, i) => i !== index), confirmedNoPerformers: false })}>{t("removePerformer")}</button>
      </div>)}
      <button type="button" className={button} onClick={() => onChange({ ...value, confirmedNoPerformers: false, performerRowIds: [...value.performerRowIds, crypto.randomUUID()], performers: [...value.performers, { mode: "account", remotePerformerId: "", label: "" }] })}>{t("addPerformer")}</button>
    </fieldset>
    <fieldset className="rounded-lg border border-white/10 p-3"><legend>{t("publishingSettings")}</legend><p>{t("internalScheduleHelp")}</p><p>{t("destinationSummary", { mode: t(publishMode === "NOW" ? "publishNow" : "scheduled") })}</p><p>{t("destinationsUnavailable")}</p></fieldset>
  </div>;
}
