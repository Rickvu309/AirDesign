import { gestures } from "@airdesign/render"
import { describe, expect, it } from "vitest"

const sources: Readonly<Record<string, string>> = import.meta.glob(
  [
    "./**/*.{ts,tsx}",
    "../../../packages/render/src/**/*.{ts,tsx}",
    "!./**/*.test.{ts,tsx}",
    "!../../../packages/render/src/**/*.test.{ts,tsx}",
    "!./copy/**",
    "!../../../packages/render/src/gestures.ts",
  ],
  { query: "?raw", import: "default", eager: true },
)

const keyName =
  "Arrow(?:Up|Down|Left|Right)|Home|End|PageUp|PageDown|Enter|Escape|Tab|Backspace|Delete|Insert|ContextMenu|F\\d{1,2}|Meta|Control|Alt|Shift|Space|Key[A-Z]|Digit\\d|Bracket(?:Left|Right)|Slash|Backslash|Backquote"

const readings = [
  new RegExp(`"(${keyName})"`, "g"),
  new RegExp(`\\b(${keyName})\\s*:(?!:)`, "g"),
  /\.(?:key|code)(?:\.toLowerCase\(\)|\.toUpperCase\(\))?\s*[!=]==?\s*"(.)"/g,
]

function repoPath(path: string): string {
  return path.startsWith("../../../") ? path.slice("../../../".length) : `apps/web/src/${path.slice(2)}`
}

function keysIn(text: string): readonly string[] {
  const keys = readings.flatMap((reading) => [...text.matchAll(reading)].map((found) => found[1] ?? ""))
  return [...new Set(keys)].toSorted()
}

const keysRead: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.entries(sources)
    .map(([path, text]) => [repoPath(path), keysIn(text)] as const)
    .filter(([, keys]) => keys.length > 0),
)

const arrows = ["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"]
const field = ["Enter", "Escape"]
const list = [...arrows, "End", "Home"]
const upDown = ["ArrowDown", "ArrowUp", "End", "Home"]

const controlKeys: Readonly<Record<string, readonly string[]>> = {
  "apps/web/src/aira/aira-composer.tsx": ["Enter"],
  "apps/web/src/decks/decks-shell.tsx": ["Escape"],
  "apps/web/src/design/color-picker.tsx": arrows,
  "apps/web/src/design/controls/alignment-grid.tsx": arrows,
  "apps/web/src/design/controls/dash.tsx": field,
  "apps/web/src/design/controls/link.tsx": field,
  "apps/web/src/design/controls/number.tsx": ["ArrowDown", "ArrowUp", ...field],
  "apps/web/src/design/controls/picture-adjust.tsx": field,
  "apps/web/src/design/controls/text.tsx": field,
  "apps/web/src/design/custom-color.tsx": [...list, ...field],
  "apps/web/src/aira/adjust-tone.tsx": arrows,
  "apps/web/src/editor/deck-title-edit.tsx": field,
  "apps/web/src/editor/editor-grid-keys.ts": list,
  "apps/web/src/editor/editor-key-ownership.ts": ["Escape"],
  "apps/web/src/editor/grid-menu.tsx": ["Enter"],
  "apps/web/src/editor/notes-bar.tsx": upDown,
  "apps/web/src/editor/resizable-panel.tsx": ["ArrowLeft", "ArrowRight", "End", "Home"],
  "apps/web/src/design/shape-grid.tsx": list,
  "apps/web/src/editor/slide-sidebar.tsx": upDown,
  "apps/web/src/editor/zoom-menu.tsx": ["ArrowDown", "ArrowUp", ...field, "Tab"],
  "apps/web/src/present/use-present.ts": [" ", "Enter", "Tab"],
}

describe("the gesture table holds every editor key", () => {
  it("finds a key read by name, by place on the keyboard, by a map or by its letter", () => {
    expect(keysIn('if (event.key === "Home") go()')).toEqual(["Home"])
    expect(keysIn('event.code !== "KeyQ" && event.code === "BracketLeft"')).toEqual(["BracketLeft", "KeyQ"])
    expect(keysIn("const keys = { PageDown: next, F2: rename }")).toEqual(["F2", "PageDown"])
    expect(keysIn('if (event.key.toLowerCase() === "q") quit()')).toEqual(["q"])
    expect(keysIn('const step = field.key === "bold" ? 1 : 0')).toEqual([])
  })

  it("reads every key outside a control through the gesture table", () => {
    const strays = Object.entries(keysRead).flatMap(([file, keys]) =>
      keys.filter((key) => !(controlKeys[file] ?? []).includes(key)).map((key) => `${file} reads "${key}"`),
    )
    expect(strays).toEqual([])
  })

  it("lists only keys a control still reads", () => {
    const stale = Object.entries(controlKeys).flatMap(([file, keys]) =>
      keys.filter((key) => !(keysRead[file] ?? []).includes(key)).map((key) => `${file} no longer reads "${key}"`),
    )
    expect(stale).toEqual([])
  })

  it("handles every row that has keys outside the table", () => {
    const handlers = Object.values(sources).join("\n")
    const unhandled = gestures
      .filter((row) => row.keys.length > 0)
      .map((row) => row.id)
      .filter((id) => !handlers.includes(`"${id}"`))
    expect(unhandled).toEqual([])
  })
})
