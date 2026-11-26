"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

const KEY = "brasa-theme";

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

/** Script inline para aplicar el tema antes del primer paint (evita flash). */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${KEY}");if(t!=="dark"&&t!=="light"){t="dark"}var r=document.documentElement;r.classList.remove("dark","light");r.classList.add(t);r.style.colorScheme=t;}catch(e){document.documentElement.classList.add("dark")}})();`;

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY);
    const initial: Theme = stored === "light" ? "light" : "dark";
    setTheme(initial);
    apply(initial);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      window.localStorage.setItem(KEY, next);
      apply(next);
      return next;
    });
  }, []);

  return { theme, setTheme: (t: Theme) => {
    window.localStorage.setItem(KEY, t);
    apply(t);
    setTheme(t);
  }, toggle };
}
