// Tintement de bol, synthétisé (brief §3). `strikes` coups montants sur une gamme pentatonique
// (sol, la, si, ré), pour la récompense graduelle (D-019).

let ctx: AudioContext | null = null;
const SCALE = [392, 440, 494, 587];
const PARTIALS: [number, number, number][] = [
  [392, 1, 5.5],
  [394.2, 0.6, 5],
  [1062, 0.35, 3.4],
  [2018, 0.16, 2.2],
  [3110, 0.07, 1.4],
];

export function chime(strikes: number, gain: number) {
  if (gain <= 0) return;
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
    const master = ctx.createGain();
    master.gain.value = Math.min(1, gain) * 0.22;
    master.connect(ctx.destination);
    for (let k = 0; k < strikes; k++) {
      const t = ctx.currentTime + k * 0.17;
      const ratio = SCALE[Math.min(k, SCALE.length - 1)]! / SCALE[0]!;
      const amp = k === strikes - 1 ? 1 : 0.7;
      for (const [f, a, d] of PARTIALS) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = f * ratio;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(a * amp, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(master);
        o.start(t);
        o.stop(t + d + 0.1);
      }
    }
  } catch {
    // Audio indisponible : silence.
  }
}
