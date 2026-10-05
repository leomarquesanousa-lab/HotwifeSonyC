"use client";

import { useEffect, useState, type SetStateAction } from "react";
import { z } from "zod";
import { emptyManyVidsOptions, type ManyVidsFormValue } from "./ManyVidsPublishingOptions";
import { manyVidsTagSchema, type ManyVidsTag } from "@/src/lib/platforms/manyvids/http/types";

type Draft = { title: string; description: string; price: string; tags: ManyVidsTag[]; options: ManyVidsFormValue };
const storageKey = "creator-platform:manyvids-drafts:v1";
// Draft validation deliberately allows incomplete fields. Submission has its own strict schema.
const optionsSchema = z.object({
  performers: z.array(z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("account"), remotePerformerId: z.string(), label: z.string() }),
    z.object({ mode: z.literal("documents"), localPerformerId: z.string(), idDocumentId: z.string(), consentDocumentId: z.string(), consentSource: z.enum(["document", "agreement"]), label: z.string() }),
  ])),
  thumbnail: z.discriminatedUnion("source", [
    z.object({ source: z.literal("generate_from_video") }), z.object({ source: z.literal("upload_custom"), mediaAssetId: z.string() }),
  ]),
  teaser: z.discriminatedUnion("source", [
    z.object({ source: z.literal("generate_from_video"), startTime: z.number().nullable().transform((value) => value ?? NaN) }), z.object({ source: z.literal("upload_custom"), mediaAssetId: z.string() }),
  ]),
  confirmedNoPerformers: z.boolean(), performerRowIds: z.array(z.string()), previewFrameTime: z.number().nullable().transform((value) => value ?? NaN).optional(),
});

function readDrafts(): Record<string, Draft> {
  if (typeof window === "undefined") return {};
  try {
    const data: unknown = JSON.parse(sessionStorage.getItem(storageKey) || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return Object.fromEntries(Object.entries(data).flatMap(([key, draft]) => {
      if (!draft || typeof draft !== "object") return [];
      const tags = manyVidsTagSchema.array().max(10).safeParse(draft.tags);
      const options = optionsSchema.safeParse(draft.options);
      if (![draft.title, draft.description, draft.price].every((v) => typeof v === "string") || !tags.success || !options.success) return [];
      return [[key, { title: draft.title, description: draft.description, price: draft.price, tags: tags.data, options: options.data }]];
    }));
  } catch { return {}; }
}

// Store edits by creator/video, independent of fetched object identity, account visibility and locale.
// Only local form values are kept in this tab; never cookies, tokens, URLs or document contents.
export function useManyVidsDraft(scope: string, initialTitle: string, initialDescription: string) {
  const [drafts, setDrafts] = useState(readDrafts);
  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(drafts)); } catch { /* In-memory editing still works when storage is unavailable. */ }
  }, [drafts]);
  const draft: Draft = drafts[scope] ?? { title: initialTitle, description: initialDescription, price: "", tags: [], options: emptyManyVidsOptions() };
  function update<K extends keyof Draft>(key: K, value: SetStateAction<Draft[K]>) {
    setDrafts((current) => {
      const previous = current[scope] ?? draft;
      const next = { ...current, [scope]: { ...previous, [key]: typeof value === "function" ? (value as (old: Draft[K]) => Draft[K])(previous[key]) : value } };
      return next;
    });
  }
  return {
    manyVidsTitle: draft.title, setManyVidsTitle: (value: SetStateAction<string>) => update("title", value),
    manyVidsDescription: draft.description, setManyVidsDescription: (value: SetStateAction<string>) => update("description", value),
    manyVidsPrice: draft.price, setManyVidsPrice: (value: SetStateAction<string>) => update("price", value),
    manyVidsTags: draft.tags, setManyVidsTags: (value: SetStateAction<ManyVidsTag[]>) => update("tags", value),
    manyVidsOptions: draft.options, setManyVidsOptions: (value: SetStateAction<ManyVidsFormValue>) => update("options", value),
  };
}
