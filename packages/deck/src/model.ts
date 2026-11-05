export type Id = string & { readonly __brand: "DeckNodeId" }

export function isId(value: unknown): value is Id {
  return typeof value === "string" && /^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/.test(value)
}

export function id(value: string): Id {
  if (!isId(value)) throw new Error("Expected a short stable identifier")
  return value
}

export type Source = { kind: "created" } | { kind: "original"; part: string; sha256: string; objectId: string; dependencies: string[] }
export type Support = { kind: "native" } | { kind: "kept"; preview: string | null } | { kind: "flagged"; reason: string; preview: string | null }
export type Box = { x: number; y: number; width: number; height: number }
export type Run = { text: string; bold: boolean; font: string; size: number; color: string }
type ElementBase = { id: Id; box: Box; source: Source; support: Support; theme: string | null; placeholder: string | null; overlap: string | null }
export type Element = ElementBase & (
  { kind: "text"; runs: Run[] } |
  { kind: "shape"; geometry: "rectangle" | "ellipse" | "triangle"; fill: string } |
  { kind: "group"; children: Element[] }
)
export type Slide = { id: Id; version: number; size: { width: number; height: number }; elements: Element[]; notes: string; theme: string | null; source: Source }
export type Deck = { id: Id; version: number; slides: Slide[]; themes: { id: string; font: string; background: string }[] }
export type Change =
  { kind: "insert"; parent: Id; index: number; value: Slide | Element } |
  { kind: "set"; target: Id; value: Slide | Element | Deck } |
  { kind: "move"; target: Id; parent: Id; index: number } |
  { kind: "remove"; target: Id }
export type ChangeSet = { changes: Change[] }
export type ChangeError = { code: "invalid-reference" | "invalid-structure" | "cycle" | "invalid-data"; message: string; retryable: false; next: string }
export type ApplyResult = { ok: true; deck: Deck; inverse: ChangeSet } | { ok: false; error: ChangeError }
