import { useEffect, useState } from "react";
import type { Theme } from "../core/types";

/** Heure courante, rafraîchie sur la seconde (et non à chaque image). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let id: number | undefined;
    // Aligné sur la seconde : l'affichage mm:ss change pile au bon moment.
    const first = window.setTimeout(
      () => {
        setNow(Date.now());
        id = window.setInterval(() => setNow(Date.now()), intervalMs);
      },
      intervalMs - (Date.now() % intervalMs),
    );
    return () => {
      window.clearTimeout(first);
      if (id !== undefined) window.clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}

export function useReducedMotion(): boolean {
  const [rm, setRm] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setRm(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return rm;
}

/** Applique le thème choisi dans les réglages ; « auto » suit macOS. */
export function useThemeAttribute(theme: Theme | undefined) {
  useEffect(() => {
    const el = document.documentElement;
    if (!theme || theme === "auto") el.removeAttribute("data-theme");
    else el.setAttribute("data-theme", theme);
  }, [theme]);
}
