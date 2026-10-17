import { AppShell } from "@/components/app/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen min-h-0 overflow-hidden">
      <AppShell>{children}</AppShell>
    </div>
  );
}
