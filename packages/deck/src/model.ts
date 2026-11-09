import type {TextStyle} from "./text/body.ts"
import type {ShapeGeometry} from "./shape-geometry.ts"
export type Id = string & { readonly __brand: "DeckNodeId" }

export function isId(value: unknown): value is Id {
  return typeof value === "string" && /^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/.test(value)
}

export function id(value: string): Id {
  if (!isId(value)) throw new Error("Expected a short stable identifier")
  return value
}

export type ThemeId = string & { readonly __brand: "ThemeId" }
export type PlaceholderId = string & { readonly __brand: "PlaceholderId" }
export type OverlapId = string & { readonly __brand: "OverlapId" }
export function themeId(value: string): ThemeId { if (!isThemeId(value)) throw new Error("Invalid theme id"); return value }
export function placeholderId(value: string): PlaceholderId { if (!isPlaceholderId(value)) throw new Error("Invalid placeholder id"); return value }
export function overlapId(value: string): OverlapId { if (!isOverlapId(value)) throw new Error("Invalid overlap id"); return value }
export function isThemeId(value: unknown): value is ThemeId { return isId(value) }
export function isPlaceholderId(value: unknown): value is PlaceholderId { return isId(value) }
export function isOverlapId(value: unknown): value is OverlapId { return isId(value) }
export type Source = { kind: "created" } | { kind: "original"; part: string; sha256: string; objectId: string; objectType?: "chart" | "table"; textVersion?: 2; dependencies: string[] }
export type Support = { kind: "native" } | { kind: "kept"; preview: string | null } | { kind: "flagged"; reason: string; preview: string | null; preservation?: "removed" | "partial" | "reported" }
export type Box = { x: number; y: number; width: number; height: number }
export type Run = TextStyle & {text: string; color: string}
type ElementBase = { styleLinks?: ("font" | "color" | "fill")[]; id: Id; box: Box; source: Source; support: Support; theme: ThemeId | null; placeholder: PlaceholderId | null; overlap: OverlapId | null }
export type ImagePlacement = { asset: string; crop: { x: number; y: number; width: number; height: number }; focal: { x: number; y: number }; mask: "rectangle" | "ellipse"; alt: string }
export type Element = ElementBase & (
  { kind: "text"; runs: [Run, ...Run[]] } |
  { kind: "shape"; geometry: ShapeGeometry; fill: string } |
  { kind: "image"; image: ImagePlacement } |
  { kind: "group"; children: Element[] }
)
export type TemplateLayout = { template: string; version: number; family: string; master: string; part: string }
export type Slide = { background?:string; section?:string; layout?: TemplateLayout; id: Id; version: number; size: { width: number; height: number }; elements: Element[]; notes: string; theme: ThemeId | null; source: Source }
export type TemplatePin = { id: string; version: number; family: string; layout?: {master:string;part:string} }
export type Deck = { template?: TemplatePin; id: Id; version: number; slides: Slide[]; placeholders?: PlaceholderId[]; overlaps?: OverlapId[]; themes: { id: ThemeId; font: string; background: string; foreground?: string }[] }
export type Change =
  { kind: "insert"; parent: Id; index: number; value: Slide | Element } |
  { kind: "set"; target: Id; value: Slide | Element | Deck } |
  { kind: "move"; target: Id; parent: Id; index: number } |
  { kind: "remove"; target: Id }
export type ChangeSet = { changes: Change[] }
export type ChangeError = { code: "invalid-reference" | "invalid-structure" | "cycle" | "invalid-data"; message: string; retryable: false; next: string }
export type ApplyResult = { ok: true; deck: Deck; inverse: ChangeSet } | { ok: false; error: ChangeError }
