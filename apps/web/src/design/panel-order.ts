import type { ScopedElement } from "@airdesign/document"
import type { PanelReads, SectionName } from "./panel"

export type PanelKind = "text" | "shape" | "picture" | "connector" | "group" | "table" | "chart" | "kept" | "many"

export type Place = { readonly section: SectionName; readonly open: boolean }

const open = (section: SectionName): Place => ({ section, open: true })
const shut = (section: SectionName): Place => ({ section, open: false })

export const panelOrder: Readonly<Record<PanelKind, readonly Place[]>> = {
  text: [
    open("alignment"),
    open("text"),
    open("fill"),
    open("opacity"),
    shut("box"),
    shut("line"),
    shut("effects"),
    shut("body"),
    shut("geometry"),
    shut("identity"),
  ],
  shape: [
    open("alignment"),
    open("fill"),
    open("opacity"),
    open("geometry"),
    open("line"),
    shut("effects"),
    shut("box"),
    shut("text"),
    shut("body"),
    shut("identity"),
  ],
  picture: [
    open("alignment"),
    open("image"),
    open("crop"),
    open("opacity"),
    shut("box"),
    shut("line"),
    shut("effects"),
    shut("geometry"),
    shut("identity"),
  ],
  connector: [
    open("alignment"),
    open("line"),
    open("connection"),
    open("opacity"),
    shut("box"),
    shut("effects"),
    shut("geometry"),
    shut("identity"),
  ],
  group: [open("alignment"), shut("box"), shut("effects"), shut("identity")],
  table: [open("alignment"), open("table"), shut("box"), shut("identity")],
  chart: [open("alignment"), shut("box"), shut("identity")],
  kept: [open("identity")],
  many: [open("alignment"), open("fill"), open("line"), open("opacity"), open("text"), shut("box"), shut("effects")],
}

export const loneRows: readonly string[] = [
  "identity.name",
  "identity.alt",
  "table.value",
  "crop.rect",
  "connection.start",
  "connection.end",
]

const panelKinds: readonly string[] = Object.keys(panelOrder)

function rectangle(value: unknown): boolean {
  return typeof value === "object" && value !== null && "preset" in value && value.preset === "rect"
}

function drawn(shown: PanelReads): boolean {
  const read = shown.fields?.["geometry.shape"]
  if (read === undefined) return false
  return read.value === undefined || read.value === null ? read.own : !rectangle(read.value)
}

export function panelKind(view: ScopedElement, shown: PanelReads): PanelKind | null {
  const { kind, text } = view.facts
  if (kind === "shape") return text && !drawn(shown) ? "text" : "shape"
  return panelKinds.includes(kind) ? (kind as PanelKind) : null
}

export function hidden(kind: PanelKind | null, shown: PanelReads): readonly SectionName[] {
  const read = shown.fields?.["geometry.shape"]
  return kind === "picture" && read !== undefined && !drawn(shown) ? ["geometry"] : []
}
