"use client";

import { RoiCalculatorApp } from "@/components/calculator/RoiCalculatorApp";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function CalculatorPageContent() {
  const searchParams = useSearchParams();
  const price = Number(searchParams.get("price"));
  const rent = Number(searchParams.get("rent"));
  return (
    <RoiCalculatorApp
      initialPurchasePrice={Number.isFinite(price) && price > 0 ? price : undefined}
      initialMonthlyRent={Number.isFinite(rent) && rent > 0 ? rent : undefined}
    />
  );
}

export default function CalculatorPage() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <Suspense fallback={<div className="p-8 text-sm text-ink-muted">Cargando calculadora…</div>}>
        <CalculatorPageContent />
      </Suspense>
    </div>
  );
}

