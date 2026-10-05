import "@fontsource/shippori-mincho/latin-500.css";
import "@fontsource/shippori-mincho/latin-700.css";
import "@fontsource/zen-kaku-gothic-new/latin-400.css";
import "@fontsource/zen-kaku-gothic-new/latin-500.css";
import "@fontsource/zen-kaku-gothic-new/latin-700.css";
import "./styles/tokens.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { startWindow } from "./bootstrap";

const view = startWindow();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App view={view} />
  </StrictMode>,
);
