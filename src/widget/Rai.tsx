// Rai à l'écran (D-044) : une pose (une ou deux images qui alternent), un souffle léger, et les
// effets manga dessinés en CSS (Zzz, bulle de morve, aura, flash, lignes de vitesse…).
// Toutes les animations portent sur `opacity` et `transform` : le compositeur s'en charge.

import attenteA from "../assets/rai/attente-a.webp";
import attenteB from "../assets/rai/attente-b.webp";
import baseBlink from "../assets/rai/base-blink.webp";
import base from "../assets/rai/base.webp";
import bulletin from "../assets/rai/bulletin.webp";
import dodoB from "../assets/rai/dodo-b.webp";
import esquive from "../assets/rai/esquive.webp";
import focusA from "../assets/rai/focus-a.webp";
import focusB from "../assets/rai/focus-b.webp";
import pauseA from "../assets/rai/pause-a.webp";
import pauseB from "../assets/rai/pause-b.webp";
import reveil from "../assets/rai/reveil.webp";
import superA from "../assets/rai/super-a.webp";
import superB from "../assets/rai/super-b.webp";
import sursaut from "../assets/rai/sursaut.webp";
import transfo from "../assets/rai/transfo.webp";
import victoire from "../assets/rai/victoire.webp";
import type { Pose } from "../companion/engine";
import styles from "./Rai.module.css";

/** Images d'une pose et durée d'un cycle (deux images qui alternent). */
const POSES: Record<Pose, { frames: string[]; cycle?: number; label: string }> = {
  base: { frames: [base], label: "Rai attend, détendu" },
  blink: { frames: [baseBlink], label: "Rai ferme les yeux" },
  attente: { frames: [attenteA, attenteB], cycle: 3.2, label: "Rai s'impatiente" },
  focus: { frames: [focusA, focusB], cycle: 0.9, label: "Rai travaille" },
  transfo: { frames: [transfo], label: "Rai se transforme" },
  super: { frames: [superA, superB], cycle: 1.2, label: "Rai en forme super" },
  dodo: { frames: [dodoB], label: "Rai dort" },
  sursaut: { frames: [sursaut], label: "Rai sursaute" },
  reveil: { frames: [reveil], label: "Rai sonne la fin du focus" },
  pause: { frames: [pauseA, pauseB], cycle: 2.8, label: "Rai mange un onigiri" },
  victoire: { frames: [victoire], label: "Rai fête ta tâche" },
  esquive: { frames: [esquive], label: "Rai file" },
  bulletin: { frames: [bulletin], label: "Rai lit le bulletin du jour" },
};

export const RAI_SIZE = 112;

export function Rai(props: {
  pose: Pose;
  /** Sur le bord gauche, il se retourne pour regarder l'écran. */
  flip: boolean;
  style?: React.CSSProperties;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const p = POSES[props.pose];
  const calm = props.pose === "base" || props.pose === "blink";
  return (
    <div
      className={`${styles.rai} ${styles[props.pose] ?? ""}`}
      style={props.style}
      role="img"
      data-hit
      aria-label={p.label}
      title="Rai · cliquer : le taquiner · glisser : le déplacer"
      onMouseDown={props.onMouseDown}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
    >
      {/* Ce qui suit le personnage (et se retourne avec lui) ; le texte reste à l'endroit. */}
      <div className={`${styles.stage} ${props.flip ? styles.flip : ""}`}>
        {props.pose === "super" && <span className={styles.aura} aria-hidden="true" />}
        <div className={styles.body}>
          {calm ? (
            // Repos : l'image yeux fermés passe en fondu par-dessus, sans à-coup.
            <>
              <img src={base} alt="" draggable={false} />
              <img
                src={baseBlink}
                alt=""
                draggable={false}
                className={props.pose === "blink" ? styles.shown : styles.hidden}
              />
            </>
          ) : (
            p.frames.map((src, i) => (
              <img
                key={src}
                src={src}
                alt=""
                draggable={false}
                className={p.frames.length > 1 ? (i === 0 ? styles.fa : styles.fb) : undefined}
                style={p.cycle ? ({ "--cycle": `${p.cycle}s` } as React.CSSProperties) : undefined}
              />
            ))
          )}
        </div>
        {props.pose === "dodo" && <i className={styles.snot} aria-hidden="true" />}
        {props.pose === "transfo" && <span className={styles.flash} aria-hidden="true" />}
        {props.pose === "super" && (
          <span className={styles.sparks} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        )}
        {props.pose === "victoire" && (
          <span className={styles.stars} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        )}
        {props.pose === "sursaut" && <span className={styles.sweat} aria-hidden="true" />}
        {props.pose === "esquive" && <span className={styles.speed} aria-hidden="true" />}
      </div>
      {props.pose === "dodo" && (
        <span className={styles.sleep} aria-hidden="true">
          <b>z</b>
          <b>z</b>
          <b>Z</b>
        </span>
      )}
      {(props.pose === "sursaut" || props.pose === "reveil") && (
        <span className={styles.mark} aria-hidden="true">
          {props.pose === "sursaut" ? "!?" : "!!"}
        </span>
      )}
    </div>
  );
}
