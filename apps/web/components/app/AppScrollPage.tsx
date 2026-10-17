/** Páginas sin mapa a pantalla completa (calculadora, guardados, ficha). */
export function AppScrollPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f6f3]">
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">{children}</div>
    </div>
  );
}
