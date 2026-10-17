export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warn" | "info";
}) {
  const tones = {
    neutral: "border-neutral-300 bg-white text-neutral-800",
    success: "border-neutral-950 bg-neutral-950 text-white",
    warn: "border-neutral-400 bg-neutral-100 text-neutral-900",
    info: "border-neutral-300 bg-neutral-50 text-neutral-800",
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
