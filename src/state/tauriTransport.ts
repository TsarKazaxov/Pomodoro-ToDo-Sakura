// Transport entre fenêtres par événements Tauri (D-026).

import { emit, listen } from "@tauri-apps/api/event";
import type { ClientMessage, Reward, Snapshot, Transport } from "./store";

const EV = {
  action: "sakura://action",
  state: "sakura://state",
  reward: "sakura://reward",
  hello: "sakura://hello",
} as const;

export const tauriTransport: Transport = {
  sendAction: (msg) => void emit<ClientMessage>(EV.action, msg),
  onAction: (cb) => void listen<ClientMessage>(EV.action, (e) => cb(e.payload)),
  broadcastState: (s) => void emit<Snapshot>(EV.state, s),
  onState: (cb) => void listen<Snapshot>(EV.state, (e) => cb(e.payload)),
  broadcastReward: (r) => void emit<Reward>(EV.reward, r),
  onReward: (cb) => void listen<Reward>(EV.reward, (e) => cb(e.payload)),
  requestState: () => void emit(EV.hello),
  onRequestState: (cb) => void listen(EV.hello, () => cb()),
};
