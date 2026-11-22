export type Where = "slide" | "element" | "guide" | "text" | "control" | "slides" | "grid" | "editor" | "show" | "armed"

type Chord = {
  readonly mod?: true
  readonly ctrl?: true
  readonly meta?: true
  readonly shift?: true
  readonly alt?: true
}

export type Keys = Chord & ({ readonly key: string } | { readonly code: string })

export type Pointing = {
  readonly on: "element" | "corner" | "edge" | "rotate" | "slide" | "ruler" | "guide"
  readonly drag: boolean
  readonly shift?: true
  readonly mod?: true
  readonly ctrl?: true
  readonly alt?: true
  readonly double?: true
  readonly hover?: true
}

export type GestureRow = {
  readonly id: string
  readonly group: "select" | "move" | "size" | "arrange" | "tools" | "view" | "history" | "text" | "slides" | "present"
  readonly keys: readonly Keys[]
  readonly pointing?: readonly Pointing[]
  readonly where: readonly Where[]
}

export type KeyLike = {
  readonly key: string
  readonly code?: string
  readonly metaKey: boolean
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
}

export type ArrowStep = { readonly x: number; readonly y: number }

const arrowSteps = new Map<string, ArrowStep>([
  ["ArrowLeft", { x: -1, y: 0 }],
  ["ArrowRight", { x: 1, y: 0 }],
  ["ArrowUp", { x: 0, y: -1 }],
  ["ArrowDown", { x: 0, y: 1 }],
])

const arrows = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] as const

const digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const

export const gestures = [
  { id: "select", group: "select", keys: [], pointing: [{ on: "element", drag: false }], where: ["slide"] },
  {
    id: "select-add",
    group: "select",
    keys: [],
    pointing: [{ on: "element", drag: false, shift: true }],
    where: ["slide"],
  },
  {
    id: "deep-select",
    group: "select",
    keys: [],
    pointing: [
      { on: "element", drag: false, mod: true },
      { on: "element", drag: false, mod: true, shift: true },
    ],
    where: ["slide"],
  },
  {
    id: "marquee",
    group: "select",
    keys: [],
    pointing: [
      { on: "slide", drag: true },
      { on: "slide", drag: true, shift: true },
      { on: "slide", drag: true, mod: true },
    ],
    where: ["slide"],
  },
  {
    id: "select-matching",
    group: "select",
    keys: [{ code: "KeyA", mod: true, alt: true }],
    where: ["editor"],
  },
  {
    id: "select-all",
    group: "select",
    keys: [{ key: "a", mod: true }],
    where: ["grid", "element", "slide", "text"],
  },
  {
    id: "select-inverse",
    group: "select",
    keys: [{ code: "KeyA", mod: true, shift: true }],
    where: ["element", "slide"],
  },
  { id: "select-next", group: "select", keys: [{ key: "Tab" }, { key: "Tab", shift: true }], where: ["element"] },
  {
    id: "step-in",
    group: "select",
    keys: [],
    pointing: [{ on: "element", drag: false, double: true }],
    where: ["slide"],
  },
  {
    id: "select-parent",
    group: "select",
    keys: [{ key: "Enter", shift: true }, { code: "Backslash" }],
    where: ["element"],
  },
  {
    id: "measure",
    group: "select",
    keys: [],
    pointing: [{ on: "element", drag: false, alt: true, hover: true }],
    where: ["slide"],
  },
  { id: "deselect", group: "select", keys: [{ key: "Escape" }], where: ["element", "text", "guide"] },
  { id: "edit-text", group: "select", keys: [{ key: "Enter" }], where: ["element"] },
  { id: "leave-control", group: "select", keys: [{ key: "Enter" }, { key: "Escape" }], where: ["control"] },
  { id: "delete", group: "select", keys: [{ key: "Delete" }, { key: "Backspace" }], where: ["element", "guide"] },
  { id: "move", group: "move", keys: [], pointing: [{ on: "element", drag: true }], where: ["slide"] },
  {
    id: "duplicate-drag",
    group: "move",
    keys: [],
    pointing: [
      { on: "element", drag: true, alt: true },
      { on: "element", drag: true, alt: true, shift: true },
    ],
    where: ["slide"],
  },
  {
    id: "snap-off",
    group: "move",
    keys: [],
    pointing: [
      { on: "element", drag: true, ctrl: true },
      { on: "corner", drag: true, ctrl: true },
    ],
    where: ["slide"],
  },
  { id: "nudge", group: "move", keys: arrows.map((key) => ({ key })), where: ["element"] },
  {
    id: "nudge-far",
    group: "move",
    keys: arrows.map((key) => ({ key, shift: true }) as const),
    where: ["element"],
  },
  {
    id: "resize",
    group: "size",
    keys: [],
    pointing: [
      { on: "corner", drag: true },
      { on: "edge", drag: true },
    ],
    where: ["slide"],
  },
  { id: "rotate", group: "size", keys: [], pointing: [{ on: "rotate", drag: true }], where: ["slide"] },
  { id: "crop", group: "size", keys: [], pointing: [{ on: "element", drag: false, double: true }], where: ["slide"] },
  {
    id: "resize-keys",
    group: "size",
    keys: arrows.map((key) => ({ key, alt: true, shift: true }) as const),
    where: ["element"],
  },
  {
    id: "rotate-keys",
    group: "size",
    keys: [
      { key: "ArrowUp", mod: true, alt: true },
      { key: "ArrowDown", mod: true, alt: true },
      { key: "ArrowUp", mod: true, alt: true, shift: true },
      { key: "ArrowDown", mod: true, alt: true, shift: true },
    ],
    where: ["element"],
  },
  { id: "flip-horizontal", group: "size", keys: [{ code: "KeyH", shift: true }], where: ["element"] },
  { id: "flip-vertical", group: "size", keys: [{ code: "KeyV", shift: true }], where: ["element"] },
  {
    id: "resize-to-fit",
    group: "size",
    keys: [{ code: "KeyR", mod: true, alt: true, shift: true }],
    where: ["editor"],
  },
  { id: "forward", group: "arrange", keys: [{ code: "BracketRight", mod: true }], where: ["element"] },
  { id: "backward", group: "arrange", keys: [{ code: "BracketLeft", mod: true }], where: ["element"] },
  {
    id: "front",
    group: "arrange",
    keys: [
      { code: "BracketRight" },
      { code: "BracketRight", mod: true, shift: true },
      { code: "BracketRight", meta: true, alt: true },
    ],
    where: ["element"],
  },
  {
    id: "back",
    group: "arrange",
    keys: [
      { code: "BracketLeft" },
      { code: "BracketLeft", mod: true, shift: true },
      { code: "BracketLeft", meta: true, alt: true },
    ],
    where: ["element"],
  },
  { id: "duplicate", group: "arrange", keys: [{ code: "KeyD", mod: true }], where: ["element"] },
  { id: "group", group: "arrange", keys: [{ code: "KeyG", mod: true }], where: ["element"] },
  {
    id: "ungroup",
    group: "arrange",
    keys: [
      { code: "KeyG", mod: true, shift: true },
      { key: "Backspace", mod: true },
    ],
    where: ["element"],
  },
  { id: "frame", group: "arrange", keys: [{ code: "KeyG", mod: true, alt: true }], where: ["element"] },
  {
    id: "mask",
    group: "arrange",
    keys: [
      { code: "KeyM", mod: true, alt: true },
      { code: "KeyM", meta: true, ctrl: true },
    ],
    where: ["editor"],
  },
  { id: "auto-layout", group: "arrange", keys: [{ code: "KeyA", shift: true }], where: ["element"] },
  {
    id: "remove-auto-layout",
    group: "arrange",
    keys: [{ code: "KeyA", alt: true, shift: true }],
    where: ["editor"],
  },
  { id: "align-left", group: "arrange", keys: [{ code: "KeyA", alt: true }], where: ["editor"] },
  { id: "align-center", group: "arrange", keys: [{ code: "KeyH", alt: true }], where: ["editor"] },
  { id: "align-right", group: "arrange", keys: [{ code: "KeyD", alt: true }], where: ["editor"] },
  { id: "align-top", group: "arrange", keys: [{ code: "KeyW", alt: true }], where: ["editor"] },
  { id: "align-middle", group: "arrange", keys: [{ code: "KeyV", alt: true }], where: ["editor"] },
  { id: "align-bottom", group: "arrange", keys: [{ code: "KeyS", alt: true }], where: ["editor"] },
  { id: "rename", group: "arrange", keys: [{ code: "KeyR", mod: true }], where: ["editor"] },
  { id: "hide", group: "arrange", keys: [{ code: "KeyH", mod: true, shift: true }], where: ["editor"] },
  { id: "lock", group: "arrange", keys: [{ code: "KeyL", mod: true, shift: true }], where: ["editor"] },
  { id: "undo", group: "history", keys: [{ key: "z", mod: true }], where: ["editor"] },
  { id: "copy", group: "history", keys: [{ code: "KeyC", mod: true }], where: ["editor"] },
  { id: "cut", group: "history", keys: [{ code: "KeyX", mod: true }], where: ["editor"] },
  { id: "paste", group: "history", keys: [{ code: "KeyV", mod: true }], where: ["editor"] },
  { id: "paste-over", group: "history", keys: [{ code: "KeyV", mod: true, shift: true }], where: ["editor"] },
  { id: "paste-replace", group: "history", keys: [{ code: "KeyR", mod: true, shift: true }], where: ["editor"] },
  { id: "copy-png", group: "history", keys: [{ code: "KeyC", mod: true, shift: true }], where: ["editor"] },
  { id: "copy-properties", group: "history", keys: [{ code: "KeyC", mod: true, alt: true }], where: ["editor"] },
  { id: "paste-properties", group: "history", keys: [{ code: "KeyV", mod: true, alt: true }], where: ["editor"] },
  {
    id: "redo",
    group: "history",
    keys: [
      { key: "z", mod: true, shift: true },
      { key: "y", ctrl: true },
    ],
    where: ["editor"],
  },
  {
    id: "zoom-in",
    group: "view",
    keys: [{ key: "=", mod: true }, { key: "+", mod: true }, { key: "+" }],
    where: ["editor"],
  },
  {
    id: "zoom-out",
    group: "view",
    keys: [{ key: "-", mod: true }, { key: "_", mod: true }, { key: "-" }, { key: "_" }],
    where: ["editor"],
  },
  { id: "zoom-fit", group: "view", keys: [{ code: "Digit1", shift: true }], where: ["editor"] },
  {
    id: "zoom-actual",
    group: "view",
    keys: [
      { code: "Digit0", shift: true },
      { key: "0", mod: true },
    ],
    where: ["editor"],
  },
  { id: "zoom-selection", group: "view", keys: [{ code: "Digit2", shift: true }], where: ["editor"] },
  { id: "design-mode", group: "view", keys: [{ key: "d", shift: true }], where: ["editor"] },
  { id: "rulers", group: "view", keys: [{ key: "r", shift: true }], where: ["editor"] },
  {
    id: "layout-guides",
    group: "view",
    keys: [
      { key: "g", shift: true },
      { code: "Digit4", ctrl: true, shift: true },
    ],
    where: ["editor"],
  },
  { id: "guide-add", group: "view", keys: [], pointing: [{ on: "ruler", drag: true }], where: ["editor"] },
  {
    id: "guide-duplicate",
    group: "view",
    keys: [],
    pointing: [{ on: "guide", drag: true, alt: true }],
    where: ["editor"],
  },
  { id: "tool-move", group: "tools", keys: [{ key: "v" }], where: ["editor"] },
  { id: "tool-hand", group: "tools", keys: [{ key: "h" }], where: ["editor"] },
  { id: "tool-text", group: "tools", keys: [{ key: "t" }], where: ["editor", "slides"] },
  { id: "actions", group: "tools", keys: [{ key: "k", mod: true }], where: ["editor"] },
  { id: "tool-frame", group: "tools", keys: [{ key: "f" }], where: ["editor", "slides"] },
  { id: "tool-rectangle", group: "tools", keys: [{ key: "r" }], where: ["editor", "slides"] },
  { id: "tool-ellipse", group: "tools", keys: [{ key: "o" }], where: ["editor", "slides"] },
  { id: "tool-line", group: "tools", keys: [{ key: "l" }], where: ["editor", "slides"] },
  { id: "tool-arrow", group: "tools", keys: [{ code: "KeyL", shift: true }], where: ["editor", "slides"] },
  { id: "place-shape", group: "tools", keys: [{ key: "Enter" }], where: ["armed"] },
  { id: "place-image", group: "tools", keys: [{ code: "KeyK", mod: true, shift: true }], where: ["editor", "slides"] },
  { id: "tool-eyedropper", group: "tools", keys: [{ key: "i" }], where: ["element"] },
  { id: "layers-panel", group: "view", keys: [{ code: "Digit1", alt: true }], where: ["editor"] },
  { id: "hide-ui", group: "view", keys: [{ code: "Backslash", mod: true }], where: ["editor"] },
  { id: "slide-list", group: "view", keys: [{ code: "Backslash", mod: true, shift: true }], where: ["editor"] },
  { id: "export", group: "view", keys: [{ code: "KeyE", mod: true, shift: true }], where: ["editor"] },
  { id: "pan", group: "view", keys: [{ code: "Space" }], where: ["editor"] },
  { id: "pan-arrows", group: "view", keys: arrows.map((key) => ({ key })), where: ["grid"] },
  {
    id: "shortcuts",
    group: "view",
    keys: [{ key: "?", ctrl: true, shift: true }],
    where: ["editor"],
  },
  { id: "bold", group: "text", keys: [{ key: "b", mod: true }], where: ["element", "text"] },
  { id: "italic", group: "text", keys: [{ key: "i", mod: true }], where: ["element", "text"] },
  { id: "underline", group: "text", keys: [{ key: "u", mod: true }], where: ["element", "text"] },
  { id: "strike", group: "text", keys: [{ code: "KeyX", mod: true, shift: true }], where: ["element", "text"] },
  { id: "size-up", group: "text", keys: [{ key: ">", mod: true }], where: ["element", "text"] },
  { id: "size-down", group: "text", keys: [{ key: "<", mod: true }], where: ["element", "text"] },
  { id: "text-left", group: "text", keys: [{ code: "KeyL", mod: true, alt: true }], where: ["element", "text"] },
  { id: "text-center", group: "text", keys: [{ code: "KeyT", mod: true, alt: true }], where: ["element", "text"] },
  { id: "text-right", group: "text", keys: [{ code: "KeyR", mod: true, alt: true }], where: ["element", "text"] },
  { id: "text-justify", group: "text", keys: [{ code: "KeyJ", mod: true, alt: true }], where: ["element", "text"] },
  { id: "bullets", group: "text", keys: [{ code: "Digit8", mod: true, shift: true }], where: ["element", "text"] },
  {
    id: "list-indent",
    group: "text",
    keys: [{ key: "Tab" }, { code: "BracketRight", mod: true }],
    where: ["text"],
  },
  {
    id: "list-outdent",
    group: "text",
    keys: [
      { key: "Tab", shift: true },
      { code: "BracketLeft", mod: true },
    ],
    where: ["text"],
  },
  { id: "slide-duplicate", group: "slides", keys: [{ key: "d", mod: true }], where: ["slides"] },
  { id: "slide-delete", group: "slides", keys: [{ key: "Delete" }, { key: "Backspace" }], where: ["slides"] },
  {
    id: "slide-up",
    group: "slides",
    keys: [
      { key: "ArrowUp", alt: true },
      { code: "BracketLeft", mod: true },
    ],
    where: ["slides"],
  },
  {
    id: "slide-down",
    group: "slides",
    keys: [
      { key: "ArrowDown", alt: true },
      { code: "BracketRight", mod: true },
    ],
    where: ["slides"],
  },
  { id: "slide-add", group: "slides", keys: [{ key: "Enter" }], where: ["slides"] },
  {
    id: "slide-previous",
    group: "slides",
    keys: [{ key: "ArrowUp" }, { key: "PageUp" }],
    where: ["slides"],
  },
  {
    id: "slide-next",
    group: "slides",
    keys: [{ key: "ArrowDown" }, { key: "PageDown" }],
    where: ["slides"],
  },
  { id: "slide-open", group: "slides", keys: [{ key: "Enter" }], where: ["grid"] },
  { id: "slide-earlier", group: "slides", keys: [{ key: "ArrowLeft", alt: true }], where: ["grid"] },
  { id: "slide-later", group: "slides", keys: [{ key: "ArrowRight", alt: true }], where: ["grid"] },
  {
    id: "slide-menu",
    group: "slides",
    keys: [{ key: "ContextMenu" }, { key: "F10", shift: true }],
    where: ["slides"],
  },
  { id: "present", group: "present", keys: [{ key: "F5" }], where: ["editor"] },
  {
    id: "present-here",
    group: "present",
    keys: [
      { key: "F5", shift: true },
      { key: "Enter", mod: true },
      { key: "Enter", mod: true, alt: true },
    ],
    where: ["editor"],
  },
  {
    id: "show-next",
    group: "present",
    keys: [{ key: "ArrowRight" }, { key: "ArrowDown" }, { key: "PageDown" }, { key: " " }, { key: "n" }],
    where: ["show"],
  },
  {
    id: "show-previous",
    group: "present",
    keys: [{ key: "ArrowLeft" }, { key: "ArrowUp" }, { key: "PageUp" }],
    where: ["show"],
  },
  { id: "show-first", group: "present", keys: [{ key: "Home" }], where: ["show"] },
  { id: "show-last", group: "present", keys: [{ key: "End" }], where: ["show"] },
  { id: "show-number", group: "present", keys: digits.map((key) => ({ key })), where: ["show"] },
  { id: "show-go", group: "present", keys: [{ key: "Enter" }], where: ["show"] },
  { id: "show-erase", group: "present", keys: [{ key: "Backspace" }], where: ["show"] },
  { id: "show-stop", group: "present", keys: [{ key: "Escape" }], where: ["show"] },
  { id: "show-presenter", group: "present", keys: [{ key: "p" }], where: ["show"] },
  { id: "opacity", group: "arrange", keys: digits.map((key) => ({ key })), where: ["element"] },
  {
    id: "remove-fill",
    group: "arrange",
    keys: [
      { code: "Slash", alt: true },
      { code: "Comma", alt: true },
    ],
    where: ["element"],
  },
  {
    id: "remove-border",
    group: "arrange",
    keys: [
      { code: "Slash", shift: true },
      { code: "Comma", shift: true },
    ],
    where: ["element"],
  },
  { id: "numbers", group: "text", keys: [{ code: "Digit7", mod: true, shift: true }], where: ["element"] },
  {
    id: "weight-up",
    group: "text",
    keys: [{ code: "Period", mod: true, alt: true, shift: true }],
    where: ["element", "text"],
  },
  {
    id: "weight-down",
    group: "text",
    keys: [{ code: "Comma", mod: true, alt: true, shift: true }],
    where: ["element", "text"],
  },
] as const satisfies readonly GestureRow[]

export type GestureId = (typeof gestures)[number]["id"]

const rows: readonly (GestureRow & { readonly id: GestureId })[] = gestures

function printed(key: string): boolean {
  return key.length === 1 && key.toLowerCase() === key.toUpperCase()
}

function chorded(keys: Keys, event: KeyLike): boolean {
  const mod = event.metaKey || event.ctrlKey
  const held =
    keys.ctrl === true && keys.meta === true
      ? event.ctrlKey && event.metaKey
      : keys.ctrl === true
        ? event.ctrlKey && !event.metaKey
        : keys.meta === true
          ? event.metaKey && !event.ctrlKey
          : mod === (keys.mod === true)
  return held && event.altKey === (keys.alt === true)
}

function pressed(keys: Keys, event: KeyLike): boolean {
  if (!chorded(keys, event)) return false
  if ("code" in keys) return event.code === keys.code && event.shiftKey === (keys.shift === true)
  if (event.key.toLowerCase() !== keys.key.toLowerCase()) return false
  return printed(keys.key) || event.shiftKey === (keys.shift === true)
}

export function gestureFor(event: KeyLike, where: Where): GestureId | null {
  return rows.find((row) => row.where.includes(where) && row.keys.some((keys) => pressed(keys, event)))?.id ?? null
}

export function releases(event: { readonly key: string; readonly code?: string }, id: GestureId): boolean {
  const row = rows.find((each) => each.id === id)
  return (
    row?.keys.some((keys) =>
      "code" in keys ? event.code === keys.code : event.key.toLowerCase() === keys.key.toLowerCase(),
    ) ?? false
  )
}

export function arrowOf(key: string): ArrowStep | null {
  return arrowSteps.get(key) ?? null
}
