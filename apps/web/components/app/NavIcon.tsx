import type { ReactNode } from "react";

export type IconName = "scan" | "explore" | "opportunities" | "saved" | "calculator" | "home";

const paths: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.8V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.8" />
    </>
  ),
  scan: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M11 8v6M8 11h6" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  explore: (
    <>
      <path d="M3 6l7-3 11 5v11l-11-5-7 3V6z" />
      <path d="M10 3v11M21 8l-11 5" />
    </>
  ),
  opportunities: (
    <>
      <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 16.8 5.7 21l2.3-7-6-4.6h7.6L12 2z" />
    </>
  ),
  saved: (
    <>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </>
  ),
  calculator: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h8" />
    </>
  ),
};

export function NavIcon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}
