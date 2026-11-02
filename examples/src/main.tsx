import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@airdesign/ui/styles.css";
import "@airdesign/ui/base.css";
import "./app.css";
import { IconButton, Tabs } from "@airdesign/ui";
import { Home } from "./Home";
import { Editor } from "./Editor";

const screens = { home: Home, editor: Editor } as const;
type Screen = keyof typeof screens;
const read = (): Screen => (location.hash.slice(1) in screens ? (location.hash.slice(1) as Screen) : "home");

function App() {
  const [screen, setScreen] = useState<Screen>(read);
  const [dark, setDark] = useState(new URLSearchParams(location.search).has("dark"));
  useEffect(() => { const f = () => setScreen(read()); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);
  const Current = screens[screen];
  return (
    <div className="shell">
      <header className="switcher">
        <strong>AirDesign UI examples</strong>
        <Tabs label="Screen" value={screen} onValueChange={(id) => { location.hash = id; }} items={[{ id: "home", label: "Home" }, { id: "editor", label: "Slide editor" }]} />
        <IconButton icon={dark ? "sun" : "moon"} label={dark ? "Light theme" : "Dark theme"} onClick={() => setDark(!dark)} />
      </header>
      <Current />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
