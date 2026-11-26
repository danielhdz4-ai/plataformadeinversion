import { AppShell } from "@/components/app/AppShell";
import { SavedListingsProvider } from "@/components/listings/SavedListingsProvider";
import { Suspense } from "react";
import "./immersive.css";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SavedListingsProvider>
      <div className="h-screen min-h-0 overflow-hidden">
        <Suspense fallback={null}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </div>
    </SavedListingsProvider>
  );
}
