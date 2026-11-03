import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@airdesign/ui/styles.css";
import "@airdesign/ui/base.css";
import "./app.css";
import { IconButton, Select, restoreEditor } from "@airdesign/ui";
import { Editor } from "./EditorApp.js";
import { HomeDrafts } from "./HomeDrafts.js";

function DraftingDemo() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 3000;
    const interval = setInterval(() => {
      const elapsed = performance.now() - start;
      const p = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(p);
      if (p >= 100) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <Editor
      initial={restoreEditor(
        { deck: "empty", overlay: "drafting" },
        { zoom: "100%", slides: 0, draftPrompt: "Pitch deck for an AI design tool" },
      )}
      draftProgress={progress}
    />
  );
}

const screens: { id: string; label: string; render: () => React.ReactNode }[] = [
  { id: "home", label: "1. Home, Drafts", render: () => <HomeDrafts /> },
  {
    id: "start",
    label: "2. Getting started",
    render: () => (
      <Editor
        initial={restoreEditor(
          { deck: "empty", overlay: "start" },
          { zoom: "100%", slides: 0 },
        )}
      />
    ),
  },
  { id: "slide", label: "3. Slide editor", render: () => <Editor initial={restoreEditor()} /> },
  {
    id: "overview",
    label: "4. Slides overview",
    render: () => (
      <Editor
        initial={restoreEditor(
          { canvas: "overview", layout: "floating" },
          { zoom: "12%", slides: 3, selected: [3] },
        )}
      />
    ),
  },
  {
    id: "agents",
    label: "5. Agents panel",
    render: () => <Editor initial={restoreEditor({ panel: "agents" }, { zoom: "38%" })} />,
  },
  {
    id: "inserts",
    label: "6. Inserts panel",
    render: () => <Editor initial={restoreEditor({ panel: "inserts" }, { zoom: "38%" })} />,
  },
  {
    id: "inserts-overview",
    label: "7. Inserts and overview",
    render: () => (
      <Editor
        initial={restoreEditor(
          { panel: "inserts", canvas: "overview", layout: "floating" },
          { zoom: "12%", slides: 3, selected: [3] },
        )}
      />
    ),
  },
  {
    id: "media-overview",
    label: "8. Media and overview",
    render: () => (
      <Editor
        initial={restoreEditor(
          { panel: "media", canvas: "overview", layout: "floating" },
          { zoom: "12%", slides: 3, selected: [2, 3] },
        )}
      />
    ),
  },
  {
    id: "media",
    label: "9. Media, slide view",
    render: () => (
      <Editor
        initial={restoreEditor({ panel: "media", layout: "focus" }, { zoom: "48%" })}
      />
    ),
  },
  {
    id: "shapes",
    label: "10. Shapes tray",
    render: () => (
      <Editor
        initial={restoreEditor(
          { panel: "inserts", canvas: "overview", layout: "floating", tray: "shapes" },
          { zoom: "12%", slides: 3, selected: [3] },
        )}
      />
    ),
  },
  {
    id: "share",
    label: "11. Share",
    render: () => (
      <Editor
        initial={restoreEditor(
          { panel: "media", layout: "focus", overlay: "share" },
          { zoom: "48%" },
        )}
      />
    ),
  },
  {
    id: "templates",
    label: "12. Template gallery",
    render: () => (
      <Editor
        initial={restoreEditor(
          { deck: "empty", overlay: "templates" },
          { zoom: "100%", slides: 0 },
        )}
      />
    ),
  },
  {
    id: "drafting",
    label: "13. Drafting with AI",
    render: () => <DraftingDemo />,
  },
  {
    id: "present",
    label: "14. Present",
    render: () => (
      <Editor
        initial={restoreEditor(
          {},
          { zoom: "100%", slides: 3, presenting: true },
        )}
      />
    ),
  },
  {
    id: "invited",
    label: "15. Invite sent",
    render: () => (
      <Editor
        initial={restoreEditor(
          { panel: "media", layout: "focus", overlay: "invited" },
          { zoom: "48%", slides: 1, invitees: ["grace@example.com", "alan@example.com"] },
        )}
      />
    ),
  },
  {
    id: "empty-editor",
    label: "16. Empty editor",
    render: () => (
      <Editor
        initial={restoreEditor(
          { deck: "empty", overlay: "none" },
          { zoom: "100%" },
        )}
      />
    ),
  },
  {
    id: "home-list",
    label: "17. Home, List view",
    render: () => <HomeDrafts initialView="list" />,
  },
  {
    id: "home-empty",
    label: "18. Home, No drafts",
    render: () => <HomeDrafts empty />,
  },
];

const read = () => screens.find((x) => x.id === location.hash.slice(1))?.id ?? "home";

const bare = new URLSearchParams(location.search).has("bare");

function App() {
  const [id, setId] = useState(read);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const f = () => setId(read());
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  const cur = screens.find((x) => x.id === id)!;
  return (
    <div className="shell" data-bare={bare || undefined}>
      {!bare && (
        <header className="switcher">
          <strong>AirDesign screens</strong>
          <Select
            label="Screen"
            labelHidden
            value={id}
            onChange={(e) => {
              location.hash = e.target.value;
            }}
            options={screens.map((x) => ({ value: x.id, label: x.label }))}
            style={{ width: 240 }}
          />
          <IconButton
            icon={dark ? "sun" : "moon"}
            label={dark ? "Light theme" : "Dark theme"}
            onClick={() => setDark(!dark)}
          />
        </header>
      )}
      <div className="stage-wrap" key={id}>
        {cur.render()}
      </div>
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
