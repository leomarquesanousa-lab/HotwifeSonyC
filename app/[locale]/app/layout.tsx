import type {
  ReactNode,
} from "react";

import AppHeader from "@/src/components/app/AppHeader";
import AppSidebar from "@/src/components/app/AppSidebar";
import {
  UploadManagerProvider,
} from "@/src/components/app/UploadManagerProvider";

export default function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <UploadManagerProvider>
      <div className="min-h-screen bg-[#080b12] text-white">
        <AppHeader />

        <div className="flex min-h-[calc(100vh-64px)]">
          <AppSidebar />

          <div className="min-w-0 flex-1">
            {children}
          </div>
        </div>
      </div>
    </UploadManagerProvider>
  );
}
