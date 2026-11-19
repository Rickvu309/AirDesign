export type Where = "slide" | "element" | "text" | "slides" | "editor"

type Chord = { readonly mod?: true; readonly ctrl?: true; readonly shift?: true; readonly alt?: true }

export type Keys = Chord & ({ readonly key: string } | { readonly code: string })

export type Pointing = {
  readonly on: "element" | "corner"
  readonly drag: boolean
  readonly shift?: true
  readonly mod?: true
}

export type GestureRow = {
  readonly id: string
  readonly group: "select" | "move" | "size" | "arrange" | "view" | "history" | "text" | "slides"
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

const arrows = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] as const

export const gestures = [
  { id: "select", group: "select", keys: [], pointing: [{ on: "element", drag: false }], where: ["slide"] },
  {
    id: "select-add",
    group: "select",
    keys: [],
    pointing: [
      { on: "element", drag: false, shift: true },
      { on: "element", drag: false, mod: true },
    ],
    where: ["slide"],
  },
  { id: "select-next", group: "select", keys: [{ key: "Tab" }, { key: "Tab", shift: true }], where: ["element"] },
  { id: "step-in", group: "select", keys: [], pointing: [{ on: "element", drag: false }], where: ["slide"] },
  { id: "deselect", group: "select", keys: [{ key: "Escape" }], where: ["element", "text"] },
  { id: "edit-text", group: "select", keys: [{ key: "Enter" }], where: ["element"] },
  { id: "delete", group: "select", keys: [{ key: "Delete" }, { key: "Backspace" }], where: ["element"] },
  { id: "move", group: "move", keys: [], pointing: [{ on: "element", drag: true }], where: ["slide"] },
  { id: "nudge", group: "move", keys: arrows.map((key) => ({ key })), where: ["element"] },
  {
    id: "nudge-far",
    group: "move",
    keys: arrows.map((key) => ({ key, shift: true }) as const),
    where: ["element"],
  },
  { id: "resize", group: "size", keys: [], pointing: [{ on: "corner", drag: true }], where: ["slide"] },
  {
    id: "resize-keys",
    group: "size",
    keys: arrows.map((key) => ({ key, alt: true, shift: true }) as const),
    where: ["element"],
  },
  { id: "forward", group: "arrange", keys: [{ code: "BracketRight", mod: true }], where: ["element"] },
  { id: "backward", group: "arrange", keys: [{ code: "BracketLeft", mod: true }], where: ["element"] },
  { id: "front", group: "arrange", keys: [{ code: "BracketRight", mod: true, shift: true }], where: ["element"] },
  { id: "back", group: "arrange", keys: [{ code: "BracketLeft", mod: true, shift: true }], where: ["element"] },
  { id: "group", group: "arrange", keys: [{ code: "KeyG", mod: true }], where: ["element"] },
  { id: "ungroup", group: "arrange", keys: [{ code: "KeyG", mod: true, shift: true }], where: ["element"] },
  { id: "auto-layout", group: "arrange", keys: [{ code: "KeyA", shift: true }], where: ["element"] },
  { id: "hide", group: "arrange", keys: [{ code: "KeyH", mod: true, shift: true }], where: ["editor"] },
  { id: "undo", group: "history", keys: [{ key: "z", mod: true }], where: ["editor"] },
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
    keys: [
      { key: "=", mod: true },
      { key: "+", mod: true },
    ],
    where: ["editor"],
  },
  {
    id: "zoom-out",
    group: "view",
    keys: [
      { key: "-", mod: true },
      { key: "_", mod: true },
    ],
    where: ["editor"],
  },
  {
    id: "zoom-fit",
    group: "view",
    keys: [
      { key: "0", mod: true },
      { code: "Digit1", shift: true },
    ],
    where: ["editor"],
  },
  { id: "zoom-selection", group: "view", keys: [{ code: "Digit2", shift: true }], where: ["editor"] },
  { id: "design-mode", group: "view", keys: [{ key: "d", shift: true }], where: ["editor"] },
  { id: "tool-move", group: "view", keys: [{ key: "v" }], where: ["editor"] },
  { id: "tool-hand", group: "view", keys: [{ key: "h" }], where: ["editor"] },
  { id: "bold", group: "text", keys: [{ key: "b", mod: true }], where: ["element", "text"] },
  { id: "italic", group: "text", keys: [{ key: "i", mod: true }], where: ["element", "text"] },
  { id: "underline", group: "text", keys: [{ key: "u", mod: true }], where: ["element", "text"] },
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
] as const satisfies readonly GestureRow[]

export type GestureId = (typeof gestures)[number]["id"]

const rows: readonly (GestureRow & { readonly id: GestureId })[] = gestures

function printed(key: string): boolean {
  return key.length === 1 && key.toLowerCase() === key.toUpperCase()
}

function chorded(keys: Keys, event: KeyLike): boolean {
  const mod = event.metaKey || event.ctrlKey
  const held = keys.ctrl === true ? event.ctrlKey && !event.metaKey : mod === (keys.mod === true)
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
