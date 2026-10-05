import { redirect } from "next/navigation";

import DashboardClient from "@/src/components/app/DashboardClient";
import { requireSession } from "../../../src/lib/auth/session";

type Props = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function AppPage({
  params,
}: Props) {
  const { locale } =
    await params;

  const auth =
    await requireSession();

  if (!auth) {
    redirect(
      `/${locale}/login`,
    );
  }

  const { user } =
    auth;

  return (
    <DashboardClient
      locale={
        locale
      }
      firstName={
        user.firstName
      }
    />
  );
}