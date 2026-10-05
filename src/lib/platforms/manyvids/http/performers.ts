import { ManyVidsClient, WEB } from "./client";
import { ManyVidsError, record } from "./types";

export type PerformerState = { kind: "none" } | { kind: "account"; ids: string[]; associated: boolean } | { kind: "documents_required" } | { kind: "documents_ready" };
export function performerSaveFields(state: PerformerState) {
  if (state.kind === "documents_required" || state.kind === "documents_ready") throw new ManyVidsError("DOCUMENTS_NOT_SUPPORTED", "PERFORMER", 400);
  if (state.kind === "account" && (!state.associated || !state.ids.length)) throw new ManyVidsError("PERFORMER_NOT_ASSOCIATED", "PERFORMER");
  // HAR-confirmed account-only path: no document upload. Never reuse for document workflows.
  return { co_performer: state.kind === "account" ? "YES" : "NO", documentUploadStatus: "0", age_and_consent: "0" };
}
export async function associatePerformer(client: ManyVidsClient, videoId: string, performerIds: string[]): Promise<PerformerState> {
  if (!performerIds.length) return { kind: "none" };
  const token = await client.freshToken();
  const body = new FormData();
  body.set("vidId", videoId);
  for (const performerId of performerIds) body.append("coStarIds[]", performerId);
  const response = record(await client.request(WEB, `/api/coperformers?mvtoken=${encodeURIComponent(token)}`, "PERFORMER", { method: "POST", headers: { "X-Requested-With": "XMLHttpRequest" }, body }));
  if (!response.msg) throw new ManyVidsError("PERFORMER_ASSOCIATION_NOT_CONFIRMED", "PERFORMER");
  return { kind: "account", ids: performerIds, associated: true };
}
