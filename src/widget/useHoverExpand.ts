// Déploiement au survol (D-021) : s'ouvre quand le curseur reste immobile 300 ms sur le widget,
// se replie 600 ms après sa sortie, sauf pendant la saisie dans l'ajout rapide (D-039).
// Déploiement au clic (D-041) : ouvert par un clic, ou cliqué une fois ouvert, le widget est
// « épinglé » : il ne se replie plus à la sortie du curseur, seulement au clic à l'extérieur
// (autre app ou bord transparent de la fenêtre), à Échap ou au bouton « Réduire ».

import { useCallback, useEffect, useRef, useState } from "react";

export const OPEN_DELAY_MS = 300;
export const CLOSE_DELAY_MS = 600;

/**
 * Seul un champ de saisie retient le widget ouvert. Le menu « Tâche en cours » non : une fois
 * la tâche choisie il garde le focus, et le widget restait bloqué en grand (D-039).
 */
export const holdsOpen = (el: Element | null) =>
  !!el &&
  (el.tagName === "TEXTAREA" ||
    (el.tagName === "INPUT" && ["text", "search", ""].includes((el as HTMLInputElement).type)));

export function useHoverExpand(root: React.RefObject<HTMLElement | null>) {
  const [open, setOpen] = useState(false);
  const openT = useRef<number | undefined>(undefined);
  const closeT = useRef<number | undefined>(undefined);
  const hovering = useRef(false);
  /** Pendant un glisser-déposer du widget, le survol ne doit pas le déployer. */
  const suspended = useRef(false);
  /** Après « Réduire » ou Échap, pas de réouverture tant que le curseur n'est pas sorti. */
  const waitLeave = useRef(false);
  /** Ouvert ou touché au clic : reste ouvert jusqu'à un clic à l'extérieur. */
  const pinned = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;

  const typing = useCallback(() => {
    const a = document.activeElement;
    return !!root.current && !!a && root.current.contains(a) && holdsOpen(a) && document.hasFocus();
  }, [root]);

  const armOpen = useCallback(() => {
    window.clearTimeout(openT.current);
    if (suspended.current || waitLeave.current) return;
    openT.current = window.setTimeout(() => {
      if (!suspended.current) setOpen(true);
    }, OPEN_DELAY_MS);
  }, []);

  const armClose = useCallback(() => {
    window.clearTimeout(closeT.current);
    if (pinned.current) return;
    closeT.current = window.setTimeout(() => {
      if (!pinned.current && !hovering.current && !typing()) setOpen(false);
    }, CLOSE_DELAY_MS);
  }, [typing]);

  /** Repli immédiat : bouton « Réduire », touche Échap. */
  const collapse = useCallback(() => {
    window.clearTimeout(openT.current);
    window.clearTimeout(closeT.current);
    const a = document.activeElement;
    if (a instanceof HTMLElement && root.current?.contains(a)) a.blur();
    waitLeave.current = hovering.current;
    pinned.current = false;
    setOpen(false);
  }, [root]);

  /** Ouverture au clic : immédiate et épinglée. */
  const pin = useCallback(() => {
    window.clearTimeout(openT.current);
    window.clearTimeout(closeT.current);
    pinned.current = true;
    setOpen(true);
  }, []);

  const suspend = useCallback((on: boolean) => {
    suspended.current = on;
    window.clearTimeout(openT.current);
  }, []);

  useEffect(() => {
    // Clic dans une autre app : la fenêtre perd le focus, le widget se replie.
    const onWindowBlur = () => {
      hovering.current = false;
      if (pinned.current) {
        collapse();
        return;
      }
      const a = document.activeElement;
      if (a instanceof HTMLElement && root.current?.contains(a)) a.blur();
      armClose();
    };
    // Le curseur sort de la fenêtre sans que la carte reçoive « mouseleave » (sortie rapide).
    const onDocLeave = () => {
      hovering.current = false;
      waitLeave.current = false;
      window.clearTimeout(openT.current);
      armClose();
    };
    // Clic dans la fenêtre mais hors de la carte (marge transparente autour de l'ombre).
    const onDocDown = (e: MouseEvent) => {
      if (openRef.current && !root.current?.contains(e.target as Node)) collapse();
    };
    window.addEventListener("blur", onWindowBlur);
    document.documentElement.addEventListener("mouseleave", onDocLeave);
    document.addEventListener("mousedown", onDocDown);
    return () => {
      window.removeEventListener("blur", onWindowBlur);
      document.documentElement.removeEventListener("mouseleave", onDocLeave);
      document.removeEventListener("mousedown", onDocDown);
      window.clearTimeout(openT.current);
      window.clearTimeout(closeT.current);
    };
  }, [armClose, collapse, root]);

  const handlers = {
    onMouseEnter() {
      hovering.current = true;
      window.clearTimeout(closeT.current);
      if (!openRef.current) armOpen();
    },
    onMouseMove() {
      // Tout mouvement relance le délai : on ne s'ouvre pas quand le curseur ne fait que passer.
      if (!openRef.current) armOpen();
    },
    onMouseLeave() {
      hovering.current = false;
      waitLeave.current = false;
      window.clearTimeout(openT.current);
      armClose();
    },
    onBlur() {
      // Après la perte de focus d'un champ, se replier si le curseur n'est plus là.
      window.setTimeout(() => {
        if (!hovering.current) armClose();
      }, 0);
    },
    onMouseDown() {
      // Un clic dans le widget déjà ouvert (au survol) l'épingle.
      if (openRef.current) {
        pinned.current = true;
        window.clearTimeout(closeT.current);
      }
    },
    onKeyDown(e: React.KeyboardEvent) {
      if (e.key === "Escape") collapse();
    },
  };

  return { open, setOpen, handlers, collapse, suspend, pin };
}
