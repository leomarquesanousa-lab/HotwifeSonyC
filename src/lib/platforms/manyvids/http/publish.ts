import { API, ManyVidsClient, WEB } from "./client";
import { generateTeaser, generateThumbnail, registerVideo, transcode } from "./media-processing";
import { resolveTags, saveMetadata } from "./metadata";
import { associatePerformer } from "./performers";
import { ManyVidsError, assertNoRemoteError, record, requireSupported, type PublishInput, type VideoSource } from "./types";
import { uploadVideo } from "./upload";

type ExpectedVideo = { videoId: string; creatorId: string; title: string; price: number; hasPerformer: boolean };

function checkIdentity(value: unknown, expected: ExpectedVideo) {
  assertNoRemoteError(value, "CONFIRM");
  const details = record(value);
  if ((details.id != null && String(details.id) !== expected.videoId) ||
      (details.creatorId != null && String(details.creatorId) !== expected.creatorId)) {
    throw new ManyVidsError("VIDEO_OWNER_MISMATCH", "CONFIRM");
  }
}

export function confirmedVideo(value: unknown, expected: ExpectedVideo, preview: unknown): string | null {
  assertNoRemoteError(value, "CONFIRM");
  const video = record(record(value).data);
  const details = record(preview);
  checkIdentity(video, expected);
  checkIdentity(details, expected);
  if (video.publiclyLaunched !== true || video.isPrivate !== false ||
      String(details.id) !== expected.videoId || String(details.creatorId) !== expected.creatorId ||
      details.title !== expected.title || Number(details.price) !== expected.price ||
      (expected.hasPerformer && video.hasCoPerformer !== true)) return null;
  if (typeof details.url !== "string" || !details.url) return null;
  try {
    const url = new URL(details.url, WEB);
    if (url.protocol !== "https:" || !["manyvids.com", "www.manyvids.com"].includes(url.hostname) || url.username || url.password || /edit-vid|login/i.test(url.pathname)) return null;
    // Public URL comes from the remote representation, not a guessed permalink pattern.
    return `${url.origin}${url.pathname}`;
  } catch { return null; }
}

const confirmationClock = {
  now: () => Date.now(),
  sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
};

export async function confirmPublication(client: ManyVidsClient, expected: ExpectedVideo, clock = confirmationClock) {
  // A fresh five-minute window after save/PUT. Only rereads: never restart the upload.
  const deadline = clock.now() + 5 * 60_000;
  while (clock.now() < deadline) {
    try {
      const details = await client.request(API, `/uploader/video/${expected.videoId}/preview-details`, "CONFIRM");
      checkIdentity(details, expected);
      const data = await client.request(API, `/store/video/${expected.videoId}`, "CONFIRM");
      const url = confirmedVideo(data, expected, details);
      if (url) return { externalPostId: expected.videoId, externalPostUrl: url };
    } catch (error) {
      if (error instanceof ManyVidsError && (error.code === "EXECUTION_TIMEOUT" ||
          (error.code === "NETWORK_OR_TIMEOUT" && clock.now() >= deadline))) break;
      // Explicit body errors and invalid identities are never eventual consistency.
      throw error;
    }
    const remaining = deadline - clock.now();
    if (remaining > 0) await clock.sleep(Math.min(5000, remaining));
  }
  // externalPostId was already persisted by onVideoCreated; never clear it here.
  throw new ManyVidsError("REMOTE_CONFIRMATION_TIMEOUT", "CONFIRM");
}

export async function publishManyVids(input: PublishInput, source: VideoSource, creatorId: string, client: ManyVidsClient, onVideoCreated: (id: string) => Promise<void>, transfer: typeof uploadVideo = uploadVideo) {
  requireSupported(input);
  await client.refresh();
  await client.timing.measure("SESSION_INIT", () => client.freshToken());
  const tags = await client.timing.measure("TAGS", () => resolveTags(client, input.tags));
  const upload = await transfer(client, source, creatorId);
  const videoId = await client.timing.measure("UNIFIED_MEDIA_REGISTER", () => registerVideo(client, upload, source));
  await onVideoCreated(videoId);
  // Verify owner using mapped read endpoint before modifying the newly created video.
  const preview = record(await client.request(API, `/uploader/video/${videoId}/preview-details`, "REGISTER"));
  if (String(preview.id) !== videoId || String(preview.creatorId) !== creatorId) throw new ManyVidsError("VIDEO_OWNER_MISMATCH", "REGISTER");
  await client.timing.measure("THUMBNAIL", () => generateThumbnail(client, upload, videoId));
  const teaserStart = input.teaser.source === "generate_from_video" ? input.teaser.startTime : 0;
  await generateTeaser(client, upload, videoId, teaserStart);
  const performer = await client.timing.measure("PERFORMERS", () => associatePerformer(client, videoId, input.performers.flatMap((item) => item.mode === "account" ? [item.remotePerformerId] : [])));
  await client.timing.measure("SAVE", () => saveMetadata(client, input, videoId, tags, performer));
  await client.timing.measure("TRANSCODING_WAIT", () => transcode(client, upload, videoId));
  await client.timing.measure("FINALIZE", () => client.json("/v1/store/videos/", "FINALIZE", {
    videoId, creatorId, premiumStatus: "not_included", isAiGenerated: input.isAiGenerated, is3D: input.is3D,
  }, "PUT"));
  return client.timing.measure("FINAL_CONFIRMATION", () => confirmPublication(client, { videoId, creatorId, title: input.title, price: input.price, hasPerformer: input.performers.length > 0 }));
}
