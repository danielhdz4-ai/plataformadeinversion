"use client";

import { useEffect, useRef, useState } from "react";

/** Cifra que sube desde 0 hasta `value` al entrar en pantalla. */
export function AnimatedNumber({
  value,
  durationMs = 900,
  format = (n: number) => Math.round(n).toLocaleString("es-ES"),
  className = "",
}: {
  value: number;
  durationMs?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const run = () => {
      if (started.current) return;
      started.current = true;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setDisplay(value);
        return;
      }
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / durationMs);
        const eased = 1 - Math.pow(1 - p, 3);
        setDisplay(value * eased);
        if (p < 1) requestAnimationFrame(tick);
        else setDisplay(value);
      };
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [value, durationMs]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {format(display)}
    </span>
  );
}
