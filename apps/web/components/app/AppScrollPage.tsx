/** Páginas sin mapa a pantalla completa (calculadora, guardados, ficha). */
export function AppScrollPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f3f2ef]">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}
