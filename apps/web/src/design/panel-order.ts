import type { ScopedElement } from "@airdesign/document"
import type { PanelReads, SectionName } from "./panel"

export type PanelKind = "text" | "shape" | "picture" | "connector" | "group" | "table" | "chart" | "kept"

export type Place = { readonly section: SectionName; readonly open: boolean }

const open = (section: SectionName): Place => ({ section, open: true })
const shut = (section: SectionName): Place => ({ section, open: false })

export const panelOrder: Readonly<Record<PanelKind, readonly Place[]>> = {
  text: [
    open("text"),
    open("box"),
    open("fill"),
    open("opacity"),
    shut("line"),
    shut("effects"),
    shut("body"),
    shut("geometry"),
    shut("identity"),
  ],
  shape: [
    open("fill"),
    open("line"),
    open("geometry"),
    open("box"),
    open("opacity"),
    open("text"),
    shut("effects"),
    shut("body"),
    shut("identity"),
  ],
  picture: [
    open("image"),
    open("crop"),
    open("box"),
    open("opacity"),
    shut("line"),
    shut("effects"),
    shut("geometry"),
    shut("identity"),
  ],
  connector: [
    open("line"),
    open("connection"),
    open("box"),
    open("opacity"),
    shut("effects"),
    shut("geometry"),
    shut("identity"),
  ],
  group: [open("box"), shut("effects"), shut("identity")],
  table: [open("table"), open("box"), shut("identity")],
  chart: [open("box"), shut("identity")],
  kept: [open("identity")],
}

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
