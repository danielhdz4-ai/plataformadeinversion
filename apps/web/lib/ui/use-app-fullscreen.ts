"use client";

import { useEffect, useState } from "react";

/**
 * Añade al `<html>` la clase `app-immersive` para que el shell de /app ocupe
 * toda la ventana (sin márgenes, sin scroll del documento).
 * Se activa con `?fullscreen=1` o con el botón de la cabecera.
 */
export const FULLSCREEN_CLASS = "app-immersive";
const STORAGE_KEY = "pi:fullscreen";

export function isFullscreenRequested(search: string | null): boolean {
  if (!search) return false;
  const params = new URLSearchParams(search);
  const v = params.get("fullscreen");
  return v === "1" || v === "true";
}

export function useAppFullscreen(initial: boolean) {
  const [fullscreen, setFullscreen] = useState(initial);

  useEffect(() => {
    const root = document.documentElement;
    if (fullscreen) root.classList.add(FULLSCREEN_CLASS);
    else root.classList.remove(FULLSCREEN_CLASS);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, fullscreen ? "1" : "0");
    }
    return () => root.classList.remove(FULLSCREEN_CLASS);
  }, [fullscreen]);

  return { fullscreen, setFullscreen, toggle: () => setFullscreen((v) => !v) };
}

export function readStoredFullscreen(): boolean | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v == null) return null;
  return v === "1";
}
