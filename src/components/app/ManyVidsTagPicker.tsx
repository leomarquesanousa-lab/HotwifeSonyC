"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { ManyVidsTag } from "@/src/lib/platforms/manyvids/http/types";

export function ManyVidsTagPicker({ accountId, value, onChange }: {
  accountId: string; value: ManyVidsTag[]; onChange: (tags: ManyVidsTag[]) => void;
}) {
  const t = useTranslations("manyVids");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ scope: string; tags: ManyVidsTag[]; failed: boolean } | null>(null);
  const [active, setActive] = useState(0);
  const term = query.trim();
  const scope = `${accountId}:${term}`;
  const ready = result?.scope === scope;
  const tags = ready ? result.tags.filter((tag) => !value.some((item) => item.id === tag.id)) : [];
  const canSearch = term.length >= 2 && Boolean(accountId) && value.length < 10;
  useEffect(() => {
    if (!canSearch) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch(`/api/distribution/manyvids/tags?platformAccountId=${encodeURIComponent(accountId)}&keywords=${encodeURIComponent(term)}`, { signal: controller.signal, cache: "no-store" })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok || !body.success || !Array.isArray(body.tags)) throw new Error();
          if (!controller.signal.aborted) setResult({ scope, tags: body.tags, failed: false });
        }).catch(() => { if (!controller.signal.aborted) setResult({ scope, tags: [], failed: true }); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [accountId, term, scope, canSearch]);
  function select(tag: ManyVidsTag) {
    if (value.length < 10 && !value.some((item) => item.id === tag.id)) onChange([...value, tag]);
    setQuery(""); setActive(0);
  }
  const noExactMatch = ready && !result.failed && !result.tags.some((tag) => tag.label.toLowerCase() === term.toLowerCase());
  return <div className="space-y-2">
    <label className="block">{t("tags")}
      <input className="mt-1 w-full rounded-lg border border-white/15 bg-[#111722] p-2" role="combobox" aria-autocomplete="list" aria-controls={listId} aria-expanded={canSearch} aria-activedescendant={canSearch && tags[active] ? `${listId}-${active}` : undefined}
        value={query} maxLength={100} disabled={!accountId || value.length >= 10} placeholder={t("searchTags")} onChange={(event) => { setQuery(event.target.value); setActive(0); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); setActive((n) => Math.min(n + 1, tags.length - 1)); }
          if (event.key === "ArrowUp") { event.preventDefault(); setActive((n) => Math.max(0, n - 1)); }
          if (event.key === "Escape") setQuery("");
          if (event.key === "Enter") { event.preventDefault(); if (tags[active]) select(tags[active]); }
        }} />
    </label>
    <p className="text-xs text-white/50">{t("tagSelectionHelp", { count: value.length })}</p>
    <div className="flex flex-wrap gap-2">{value.map((tag) => <button type="button" key={tag.id} className="rounded-full border border-white/20 px-3 py-1" aria-label={t("removeTag", { tag: tag.label })} onClick={() => onChange(value.filter((item) => item.id !== tag.id))}>{tag.label} ×</button>)}</div>
    {canSearch && <div className="rounded-lg border border-white/20 bg-[#111722] p-2">
      {!ready && <p role="status">{t("searching")}</p>}
      {ready && result.failed && <p role="status">{t("tagSearchFailed")}</p>}
      <div id={listId} role="listbox">{tags.map((tag, index) => <button type="button" role="option" aria-selected={index === active} id={`${listId}-${index}`} key={tag.id} className="block w-full rounded p-2 text-left hover:bg-white/10 aria-selected:bg-white/10" onClick={() => select(tag)}>{tag.label}</button>)}</div>
      {ready && !result.failed && tags.length === 0 && <p>{t("noTagResults")}</p>}
      {noExactMatch && <button type="button" disabled className="mt-2 opacity-50">{t("createTagUnavailable", { tag: term })}</button>}
    </div>}
  </div>;
}
