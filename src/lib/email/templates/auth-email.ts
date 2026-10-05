import { createTranslator } from "next-intl";
export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}
export async function authEmailTemplate(
  kind: "verification" | "reset",
  localeInput: string | undefined,
  name: string | null | undefined,
  url: string,
) {
  const locale = "en-US";
  const messages = (await import(`../../../../i18n/messages/${locale}.json`))
    .default;
  const t = createTranslator({ locale, messages: messages.authEmail[kind] });
  const lines = [
    name?.trim() ? t("greeting", { name: name.trim() }) : "",
    t("body"),
    t("expires"),
    t("ignore"),
  ].filter(Boolean);
  return {
    subject: t("subject"),
    text: [t("heading"), ...lines, url].join("\n\n"),
    html: `<!doctype html><html lang="en"><body style="background:#080b12;color:#fff;font-family:Arial,sans-serif;padding:32px"><main style="max-width:560px;margin:auto"><p>Creator Platform</p><h1>${escapeHtml(t("heading"))}</h1>${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}<p><a style="color:#60a5fa" href="${escapeHtml(url)}">${escapeHtml(t("button"))}</a></p></main></body></html>`,
  };
}
