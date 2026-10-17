import { AppShell } from "@/components/app/AppShell";
import { SavedListingsProvider } from "@/components/listings/SavedListingsProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SavedListingsProvider>
      <div className="h-screen min-h-0 overflow-hidden">
        <AppShell>{children}</AppShell>
      </div>
    </SavedListingsProvider>
  );
}
