export function AppPanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-b border-neutral-200 bg-white px-4 py-3">
      <h1 className="text-lg font-semibold text-neutral-950">{title}</h1>
      {subtitle && <p className="text-xs text-neutral-600">{subtitle}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
