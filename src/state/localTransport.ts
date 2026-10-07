// Transport de l'aperçu navigateur (`npm run dev`, sans Tauri) : BroadcastChannel entre onglets.
// Ouvrir `/?view=widget` dans un onglet et `/` dans un autre reproduit les deux fenêtres.

import type { ClientMessage, Reward, Snapshot, Transport } from "./store";

type Msg =
  | { t: "action"; m: ClientMessage }
  | { t: "state"; s: Snapshot }
  | { t: "reward"; r: Reward }
  | { t: "hello" };

const ch = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("sakura") : null;
const on = (cb: (m: Msg) => void) =>
  ch?.addEventListener("message", (e: MessageEvent<Msg>) => cb(e.data));

export const localTransport: Transport = {
  sendAction: (m) => ch?.postMessage({ t: "action", m } satisfies Msg),
  onAction: (cb) => on((m) => m.t === "action" && cb(m.m)),
  broadcastState: (s) => ch?.postMessage({ t: "state", s } satisfies Msg),
  onState: (cb) => on((m) => m.t === "state" && cb(m.s)),
  broadcastReward: (r) => ch?.postMessage({ t: "reward", r } satisfies Msg),
  onReward: (cb) => on((m) => m.t === "reward" && cb(m.r)),
  requestState: () => ch?.postMessage({ t: "hello" } satisfies Msg),
  onRequestState: (cb) => on((m) => m.t === "hello" && cb()),
};
