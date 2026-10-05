import type {
  ReactNode,
} from "react";

import AppHeader from "@/src/components/app/AppHeader";
import { redirect } from 'next/navigation';
import { requireAdministrativeAccess } from '@/src/lib/auth/admin-access';
import { AuthError } from '@/src/lib/auth/request';
import AppSidebar from "@/src/components/app/AppSidebar";
import {
  UploadManagerProvider,
} from "@/src/components/app/UploadManagerProvider";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  let access;
  try { access = await requireAdministrativeAccess(); }
  catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect('/login');
    if (error instanceof AuthError && error.status === 403) redirect('/account');
    throw error;
  }
  return (
    <UploadManagerProvider>
      <div className="min-h-screen bg-[#080b12] text-white">
        <AppHeader role={access.membership.role}/>

        <div className="flex min-h-[calc(100vh-64px)]">
          <AppSidebar role={access.membership.role}/>

          <div className="min-w-0 flex-1">
            {children}
          </div>
        </div>
      </div>
    </UploadManagerProvider>
  );
}
