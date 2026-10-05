// Déploiement au survol (D-021) : s'ouvre quand le curseur reste immobile 300 ms sur le widget,
// se replie 600 ms après sa sortie, sauf si un champ du widget a le focus.

import { useCallback, useEffect, useRef, useState } from "react";

export const OPEN_DELAY_MS = 300;
export const CLOSE_DELAY_MS = 600;

const isField = (el: Element | null) =>
  !!el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA");

export function useHoverExpand(root: React.RefObject<HTMLElement | null>) {
  const [open, setOpen] = useState(false);
  const openT = useRef<number | undefined>(undefined);
  const closeT = useRef<number | undefined>(undefined);
  const hovering = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;

  const fieldFocused = useCallback(() => {
    const a = document.activeElement;
    return !!root.current && !!a && root.current.contains(a) && isField(a);
  }, [root]);

  const armOpen = useCallback(() => {
    window.clearTimeout(openT.current);
    openT.current = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS);
  }, []);

  const armClose = useCallback(() => {
    window.clearTimeout(closeT.current);
    closeT.current = window.setTimeout(() => {
      if (!hovering.current && !fieldFocused()) setOpen(false);
    }, CLOSE_DELAY_MS);
  }, [fieldFocused]);

  useEffect(
    () => () => {
      window.clearTimeout(openT.current);
      window.clearTimeout(closeT.current);
    },
    [],
  );

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
      window.clearTimeout(openT.current);
      armClose();
    },
    onBlur() {
      // Après la perte de focus d'un champ, se replier si le curseur n'est plus là.
      window.setTimeout(() => {
        if (!hovering.current) armClose();
      }, 0);
    },
  };

  return { open, setOpen, handlers };
}
