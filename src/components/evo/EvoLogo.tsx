import { cn } from "@/lib/utils";

/** Marca EvoMatch em SVG (sem dependência de asset externo). */
export function EvoLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="EvoMatch"
      className={cn("text-primary", className)}
    >
      <defs>
        <linearGradient id="evo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="currentColor" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#evo-grad)" />
      <path
        d="M20 42 L30 20 L34 32 L40 24 L46 42"
        fill="none"
        stroke="#111827"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
