import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@airdesign/ui/styles.css";
import "@airdesign/ui/base.css";
import "./app.css";
import { IconButton, Select } from "@airdesign/ui";
import { Editor, type EditorState } from "./EditorApp";
import { HomeDrafts } from "./HomeDrafts";

const base: EditorState = { panel: "file", canvas: "slide", zoom: "45%", inspector: "docked", header: "docked", slides: 1 };
const screens: { id: string; label: string; render: () => React.ReactNode }[] = [
  { id: "home", label: "1. Home, Drafts", render: () => <HomeDrafts /> },
  { id: "start", label: "2. Getting started", render: () => <Editor initial={{ ...base, zoom: "100%", empty: true, overlay: "start" }} /> },
  { id: "slide", label: "3. Slide editor", render: () => <Editor initial={base} /> },
  { id: "overview", label: "4. Slides overview", render: () => <Editor initial={{ ...base, canvas: "overview", header: "floating", inspector: "floating", zoom: "12%", slides: 3, selected: [3] }} /> },
  { id: "agents", label: "5. Agents panel", render: () => <Editor initial={{ ...base, panel: "agents", zoom: "38%" }} /> },
  { id: "inserts", label: "6. Inserts panel", render: () => <Editor initial={{ ...base, panel: "inserts", zoom: "38%" }} /> },
  { id: "inserts-overview", label: "7. Inserts and overview", render: () => <Editor initial={{ ...base, panel: "inserts", canvas: "overview", inspector: "floating", zoom: "12%", slides: 3, selected: [3] }} /> },
  { id: "media-overview", label: "8. Media and overview", render: () => <Editor initial={{ ...base, panel: "media", canvas: "overview", inspector: "floating", zoom: "12%", slides: 3, selected: [2, 3] }} /> },
  { id: "media", label: "9. Media, slide view", render: () => <Editor initial={{ ...base, panel: "media", inspector: "none", zoom: "48%" }} /> },
  { id: "shapes", label: "10. Shapes tray", render: () => <Editor initial={{ ...base, panel: "inserts", canvas: "overview", inspector: "floating", zoom: "12%", slides: 3, selected: [3], shapes: true }} /> },
  { id: "share", label: "11. Share", render: () => <Editor initial={{ ...base, panel: "media", inspector: "none", zoom: "48%", overlay: "share" }} /> },
];
const read = () => screens.find((x) => x.id === location.hash.slice(1))?.id ?? "home";

const bare = new URLSearchParams(location.search).has("bare");

function App() {
  const [id, setId] = useState(read);
  const [dark, setDark] = useState(false);
  useEffect(() => { const f = () => setId(read()); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);
  const cur = screens.find((x) => x.id === id)!;
  return (
    <div className="shell" data-bare={bare || undefined}>
      {!bare && <header className="switcher">
        <strong>AirDesign screens</strong>
        <Select label="Screen" labelHidden value={id} onChange={(e) => { location.hash = e.target.value; }} options={screens.map((x) => ({ value: x.id, label: x.label }))} style={{ width: 240 }} />
        <IconButton icon={dark ? "sun" : "moon"} label={dark ? "Light theme" : "Dark theme"} onClick={() => setDark(!dark)} />
      </header>}
      <div className="stage-wrap" key={id}>{cur.render()}</div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
