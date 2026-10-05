import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("auth");

  return (
    <main>
      <h1>{t("welcomeBack")}</h1>
      <p>{t("signInToContinue")}</p>
    </main>
  );
}