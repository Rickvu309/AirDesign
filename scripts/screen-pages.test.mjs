import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { knownFile, screenFaults, screenOnlyReads, webSources } from "./screen-pages.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const beforeDoomScreens = new Map([
  [
    "apps/web/src/editor/editor-screens.tsx",
    'import { EditorView } from "@/editor/screens/editor-view"\nexport const screens = { "/screens/e01": EditorView }\n',
  ],
  [
    "apps/web/src/editor/screens/editor-view.tsx",
    'import { EditorShell } from "@/editor/editor-shell"\nimport { galleryDeck } from "@/editor/gallery-deck"\nimport { editorCopy } from "@/copy/editor-copy"\nexport const EditorView = () => <EditorShell deck={galleryDeck} />\n',
  ],
  [
    "apps/web/src/editor/editor-shell.tsx",
    'import { AgentPanel } from "./agent-panel"\nexport const EditorShell = () => null\n',
  ],
  ["apps/web/src/editor/agent-panel.tsx", "export const AgentPanel = () => null\n"],
  ["apps/web/src/editor/gallery-deck.ts", "export const galleryDeck = {}\n"],
  ["apps/web/src/copy/editor-copy.ts", "export const editorCopy = {}\n"],
  [
    "apps/web/src/App.tsx",
    'import { DoomEditor } from "./doom-editor/doom-editor"\nexport default () => <DoomEditor />\n',
  ],
  ["apps/web/src/doom-editor/doom-editor.tsx", "export const DoomEditor = () => null\n"],
])

same(
  "replaying the editor screens before 6809df540 names the old shell and deck that no page of the app drew",
  screenOnlyReads(beforeDoomScreens),
  [
    "apps/web/src/editor/screens/editor-view.tsx -> apps/web/src/editor/editor-shell.tsx",
    "apps/web/src/editor/screens/editor-view.tsx -> apps/web/src/editor/gallery-deck.ts",
  ],
)

const afterDoomScreens = new Map([
  ...beforeDoomScreens,
  [
    "apps/web/src/editor/screens/editor-view.tsx",
    'import { EditorSample } from "@/doom-editor/editor-sample"\nexport const EditorView = () => <EditorSample />\n',
  ],
  [
    "apps/web/src/doom-editor/editor-sample.tsx",
    'import { DoomEditor } from "./doom-editor"\nexport const EditorSample = () => <DoomEditor />\n',
  ],
])

same("a screen that draws the real editor through its sample seam passes", screenOnlyReads(afterDoomScreens), [])

same(
  "a new screen-only read fails and names what to draw instead",
  screenFaults(["a/screens/x.tsx -> a/frame.tsx"], [])[0].startsWith(
    "a/screens/x.tsx draws a/frame.tsx, which no page of the app draws.",
  ),
  true,
)

same("a listed read that is fixed must leave the list", screenFaults([], ["a/screens/x.tsx -> a/frame.tsx"]), [
  `${knownFile} still lists "a/screens/x.tsx -> a/frame.tsx", which is fixed or gone. Drop it from the list.`,
])

same(
  "today's screens add nothing to the known list",
  screenFaults(
    screenOnlyReads(webSources(root)),
    JSON.parse(fs.readFileSync(path.join(root, knownFile), "utf8")).known,
  ),
  [],
)
