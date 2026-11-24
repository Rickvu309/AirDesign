import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { knownFile, screenFaultReads, screenFaults, webSources } from "./screen-pages.mjs"

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
  ["apps/web/src/main.tsx", 'import App from "./App.tsx"\ncreateRoot(root).render(<App />)\n'],
  ["apps/web/src/App.tsx", 'import { Editor } from "./doom-editor/doom-editor"\nexport default () => <Editor />\n'],
  ["apps/web/src/components/ui/button.tsx", "export const Button = () => null\n"],
  [
    "apps/web/src/doom-editor/doom-editor.tsx",
    'import { Button } from "@/components/ui/button"\nexport const Editor = () => <Button />\n',
  ],
])

same(
  "replaying the editor screens before 6809df540 names the old shell, which the app never reached; the sample deck is plain data",
  screenFaultReads(beforeDoomScreens),
  ["apps/web/src/editor/screens/editor-view.tsx -> apps/web/src/editor/editor-shell.tsx"],
)

const afterDoomScreens = new Map([
  ...beforeDoomScreens,
  [
    "apps/web/src/editor/screens/editor-view.tsx",
    'import { EditorSample } from "@/doom-editor/editor-sample"\nexport const EditorView = () => <EditorSample />\n',
  ],
  [
    "apps/web/src/doom-editor/editor-sample.tsx",
    'import { Editor } from "./doom-editor"\nexport const EditorSample = () => <Editor />\n',
  ],
])

same("a screen that draws the real editor through its sample seam passes", screenFaultReads(afterDoomScreens), [])

const withScreen = (screen, extra) =>
  screenFaultReads(new Map([...afterDoomScreens, ["apps/web/src/editor/screens/editor-view.tsx", screen], ...extra]))

same(
  "a dead wrapper the app never reaches does not hide the mock it draws",
  withScreen('import { Wrap } from "@/zz/wrap"\nexport const EditorView = () => <Wrap />\n', [
    ["apps/web/src/zz/wrap.tsx", 'import { MockPanel } from "./mock"\nexport const Wrap = () => <MockPanel />\n'],
    ["apps/web/src/zz/mock.tsx", "export const MockPanel = () => <div />\n"],
  ]),
  ["apps/web/src/editor/screens/editor-view.tsx -> apps/web/src/zz/wrap.tsx"],
)

same(
  "a file named like a sample that defines its own mock component fails",
  withScreen('import { PanelSample } from "@/zz/panel-sample"\nexport const EditorView = () => <PanelSample />\n', [
    [
      "apps/web/src/zz/panel-sample.tsx",
      'import { Editor } from "@/doom-editor/doom-editor"\nfunction MockPanel() {\n  return <aside />\n}\nexport const PanelSample = () => (\n  <>\n    <Editor />\n    <MockPanel />\n  </>\n)\n',
    ],
  ]),
  ["apps/web/src/editor/screens/editor-view.tsx -> apps/web/src/zz/panel-sample.tsx"],
)

same(
  "a harness built only from the app's parts, drawing no page, fails like the settings frame",
  withScreen('import { Frame } from "@/zz/frame-sample"\nexport const EditorView = () => <Frame />\n', [
    [
      "apps/web/src/zz/frame-sample.tsx",
      'import { Button } from "@/components/ui/button"\nexport const Frame = () => <Button />\n',
    ],
  ]),
  ["apps/web/src/editor/screens/editor-view.tsx -> apps/web/src/zz/frame-sample.tsx"],
)

same(
  "a screen that defines and draws its own row fails by name",
  withScreen(
    "function PreferenceRow() {\n  return <div />\n}\nexport const EditorView = () => <PreferenceRow />\n",
    [],
  ),
  ["apps/web/src/editor/screens/editor-view.tsx -> own PreferenceRow"],
)

const mock = ["apps/web/src/zz/mock.tsx", "export const MockPanel = () => <div />\n"]

same(
  "a side-effect import of a module the app never reaches is seen",
  withScreen('import "@/zz/mock"\nexport const EditorView = () => null\n', [mock]),
  ["apps/web/src/editor/screens/editor-view.tsx -> apps/web/src/zz/mock.tsx"],
)

same(
  "a re-export after an export type in a file with no semicolons is seen",
  withScreen('export type Props = { readonly size: number }\nexport { MockPanel as EditorView } from "@/zz/mock"\n', [
    mock,
  ]),
  ["apps/web/src/editor/screens/editor-view.tsx -> apps/web/src/zz/mock.tsx"],
)

same(
  "a component of its own drawn as <K.R />, called as R() or passed as a prop is seen",
  withScreen(
    'import { Editor } from "@/doom-editor/doom-editor"\nconst Kit = { Row: () => <div /> }\nfunction Called() {\n  return <div />\n}\nfunction Passed() {\n  return <div />\n}\nexport const EditorView = () => (\n  <>\n    <Kit.Row />\n    {Called()}\n    <Editor render={Passed} />\n  </>\n)\n',
    [],
  ),
  [
    "apps/web/src/editor/screens/editor-view.tsx -> own Called",
    "apps/web/src/editor/screens/editor-view.tsx -> own Kit",
    "apps/web/src/editor/screens/editor-view.tsx -> own Passed",
  ],
)

same(
  "constants, objects, lists, types, a recursive helper and a constant passed as a prop are not components",
  withScreen(
    'import { Editor } from "@/doom-editor/doom-editor"\nconst SIZE = 3\nconst Sizes = { small: SIZE, large: SIZE * 2 }\nconst Items = [Sizes.small]\ntype Props = { readonly size: number }\ninterface Shape {\n  readonly props: Props\n}\nfunction Fact(n: number): number {\n  return n < 2 ? 1 : n * Fact(n - 1)\n}\nconst Scale = Fact(3)\nexport const EditorView = (props: Props, shape: Shape) => (\n  <Editor size={Scale} items={Items} />\n)\n',
    [],
  ),
  [],
)

same(
  "a component wrapped in memo and drawn is its own component",
  withScreen(
    'import { memo } from "react"\nconst Row = memo(() => <div />)\nexport const EditorView = () => <Row />\n',
    [],
  ),
  ["apps/web/src/editor/screens/editor-view.tsx -> own Row"],
)

same(
  "an import whose every name is a type, written inline, is type-only",
  withScreen('import { type MockPanel } from "@/zz/mock"\nexport const EditorView = (panel: MockPanel) => null\n', [
    mock,
  ]),
  [],
)

same(
  "a screen's own export that it does not draw is not its own component",
  withScreen(
    'import { EditorSample } from "@/doom-editor/editor-sample"\nfunction EditorView() {\n  return <EditorSample />\n}\nexport { EditorView }\nexport default EditorView\n',
    [],
  ),
  [],
)

same(
  "a new screen-only read fails and names what to draw instead",
  screenFaults(["a/screens/x.tsx -> a/frame.tsx"], [])[0].startsWith(
    "a/screens/x.tsx draws a/frame.tsx, which the app never reaches from apps/web/src/main.tsx.",
  ),
  true,
)

same("a listed read that is fixed must leave the list", screenFaults([], ["a/screens/x.tsx -> a/frame.tsx"]), [
  `${knownFile} still lists "a/screens/x.tsx -> a/frame.tsx", which is fixed or gone. Drop it from the list.`,
])

same(
  "today's screens add nothing to the known list",
  screenFaults(
    screenFaultReads(webSources(root)),
    JSON.parse(fs.readFileSync(path.join(root, knownFile), "utf8")).known,
  ),
  [],
)
