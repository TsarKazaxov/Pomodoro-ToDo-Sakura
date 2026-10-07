// Point d'entrée commun aux fenêtres : chacune affiche sa vue selon son libellé.

import { useEffect } from "react";
import { MainApp } from "./main/MainApp";
import { PetalRain } from "./overlay/PetalRain";
import { useSakura } from "./state/store";
import { useThemeAttribute } from "./ui/hooks";
import { Widget } from "./widget/Widget";

export function App({ view }: { view: "widget" | "main" | "rain" }) {
  const theme = useSakura((s) => s.data?.settings.theme);
  useThemeAttribute(theme);
  useEffect(() => {
    document.documentElement.classList.toggle("transparent", view !== "main");
  }, [view]);
  if (view === "rain") return <PetalRain />;
  if (view === "widget") return <Widget />;
  return <MainApp />;
}
