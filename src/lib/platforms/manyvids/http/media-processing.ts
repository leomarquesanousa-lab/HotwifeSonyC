import { ManyVidsClient } from "./client";
import { ManyVidsError, id, record, type ManyVidsStage, type UploadedVideo, type VideoSource } from "./types";

const flags = { save: false, stripping: false, stt: false, teaser: false, thumbnail: false, transcoding: false, intervalThumbs: false };
const teaserClock = { now: () => Date.now(), sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)) };
export function teaserPollingState(value: unknown, videoId: string) {
  const body = record(value);
  const pending = Array.isArray(body.pendingVid) ? body.pendingVid : [];
  // `vid` identifies the video; do not confuse it with a processing row's `id`.
  const matching = pending.map(record).filter(item =>
    (typeof item.vid === "string" || (typeof item.vid === "number" && Number.isSafeInteger(item.vid))) && String(item.vid) === videoId);
  return {
    success: body.success === true,
    pendingVidCount: pending.length,
    expectedVideoFound: matching.length > 0,
    video_preview_mp4Present: matching.some(item => typeof item.video_preview_mp4 === "string" && item.video_preview_mp4.trim().length > 0),
  };
}
function checkOperation(value: unknown, key: string, stage: ManyVidsStage) {
  if (record(record(value)[key]).statusCode !== 200) throw new ManyVidsError("PROCESSING_REJECTED", stage);
}
export async function registerVideo(client: ManyVidsClient, upload: UploadedVideo, source: VideoSource) {
  const result = await client.json("/unified-media/unified-upload/v2", "REGISTER", {
    ...flags, save: true, stripping: true,
    saveRequest: { ETag: upload.etag, file_name: upload.key.slice(upload.key.indexOf("/") + 1), file_original_name: source.originalFileName, file_size: source.fileSize,
      videoDetails: { duration_raw: source.durationSeconds, videoHeight: source.height, videoWidth: source.width } },
    sttRequest: upload,
  });
  checkOperation(result, "save", "REGISTER");
  // Persist the ID before making subsequent requests (including processing validation).
  const message = record(record(record(result).save).message);
  return id(record(message.video).id, "REGISTER");
}
export async function generateThumbnail(client: ManyVidsClient, upload: UploadedVideo, videoId: string) {
  const result = await client.json("/unified-media/unified-upload/v2", "THUMBNAIL", { ...flags, thumbnail: true, sttRequest: { ...upload, videoId: Number(videoId) } });
  checkOperation(result, "stt", "THUMBNAIL");
}
export async function transcode(client: ManyVidsClient, upload: UploadedVideo, videoId: string) {
  const result = await client.json("/unified-media/unified-upload/v2", "TRANSCODE", { ...flags, transcoding: true, intervalThumbs: true, sttRequest: { ...upload, videoId: Number(videoId) } });
  checkOperation(result, "stt", "TRANSCODE");
}
export async function generateTeaser(client: ManyVidsClient, upload: UploadedVideo, videoId: string, startTime: number, clock = teaserClock) {
  const startedAt = clock.now();
  await client.timing.measure("TEASER_CREATE", () => client.form("/api/video/preview", "TEASER", new URLSearchParams({ video_id: videoId, start_time: String(startTime) })));
  return client.timing.measure("TEASER_POLL", async () => {
    for (let attempt = 0; attempt < 40; attempt++) {
      // The observed transition is an MP4 appearing for this video, not p/pr/cs/e changing.
      const polling = await client.form("/includes/get_edit_preview_vid_status.php", "TEASER", new URLSearchParams({ video_id: videoId, origin_Etag: upload.etag, initialTranscode: "false" }));
      const state = teaserPollingState(polling, videoId);
      console.info("MANYVIDS_TEASER_POLL", { iteration: attempt + 1, httpStatus: client.lastResponseStatus ?? null, ...state, elapsedMs: clock.now() - startedAt });
      if (state.success && state.expectedVideoFound && state.video_preview_mp4Present) {
        client.timing.start("TEASER_READY")(true);
        return;
      }
      if (attempt < 39) await clock.sleep(3000);
    }
    throw new ManyVidsError("TEASER_NOT_CONFIRMED", "TEASER");
  });
}
