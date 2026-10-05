import { API, ManyVidsClient } from "./client";
import { ManyVidsError, record, type PublishInput } from "./types";
import { performerSaveFields, type PerformerState } from "./performers";

export async function searchTags(client: ManyVidsClient, query: string) {
  const response = await client.request(API, `/tags/partial/${encodeURIComponent(query)}/tags`, "TAGS");
  if (!Array.isArray(response)) throw new ManyVidsError("INVALID_TAG_RESPONSE", "TAGS");
  return response.map(record).filter((tag) => typeof tag.name === "string" && /^[1-9]\d*$/.test(String(tag.id)) && Number.isSafeInteger(Number(tag.id)))
    .map((tag) => ({ id: String(tag.id), label: tag.name as string }));
}
export async function resolveTags(client: ManyVidsClient, tags: PublishInput["tags"]): Promise<string[]> {
  const ids: string[] = [];
  for (const selection of tags) {
    const label = typeof selection === "string" ? selection : selection.label;
    const matches = (await searchTags(client, label)).filter((tag) => tag.label.toLowerCase() === label.toLowerCase() && (typeof selection === "string" || tag.id === selection.id));
    if (matches.length !== 1) throw new ManyVidsError("TAG_NOT_RESOLVED", "TAGS", 400);
    ids.push(matches[0].id);
  }
  const unique = [...new Set(ids)];
  if (unique.length < 3) throw new ManyVidsError("AT_LEAST_THREE_DISTINCT_TAGS", "TAGS", 400);
  return unique;
}
export function buildSaveFields(input: PublishInput, videoId: string, tagIds: string[], performer: PerformerState) {
  if (tagIds.some((value) => !/^\d+$/.test(value))) throw new ManyVidsError("TAG_ID_REQUIRED", "SAVE", 400);
  const body = new URLSearchParams({
    vid_id: videoId, vid_title: input.title, vid_description: input.description, vid_price: input.price.toFixed(2),
    vid_download_price: "0", vid_screenshot: "1", edit_video: "false", vid_sale: "0", free_vid: "0", stream_only: "2", vid_membership: "1",
    vid_launchType: "1", vid_publish_date: "", vid_publish_time: "", vid_token: "false", vid_name: "false", vid_custom: "false",
    vid_age: "", vid_breast_size: "", vid_ethnicity: "", sales_id: "", vid_experienced_users_only: "0",
    ...performerSaveFields(performer), ai_content_select: input.isAiGenerated ? "1" : "0", ai_3d_content_select: input.is3D ? "1" : "0",
  });
  for (const tagId of tagIds) body.append("vid_tags[]", tagId);
  return body;
}
export async function saveMetadata(client: ManyVidsClient, input: PublishInput, videoId: string, tagIds: string[], performer: PerformerState) {
  await client.form("/includes/saveVideo.php", "SAVE", buildSaveFields(input, videoId, tagIds, performer));
}
