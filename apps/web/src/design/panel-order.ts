import { paintSlots, type ScopedElement } from "@airdesign/document"
import type { PanelReads, PanelSection, SectionName } from "./panel"

export type PanelKind = "text" | "shape" | "picture" | "connector" | "group" | "table" | "chart" | "kept" | "many"

export type PanelMode = "slides" | "design"

type PanelSectionName = SectionName | "selectionColors" | "templateStyle" | "background"

export type Place = {
  readonly section: PanelSectionName
  readonly open: boolean
  readonly mode: PanelMode
}

const slides = (section: PanelSectionName): Place => ({ section, open: true, mode: "slides" })
const design = (section: PanelSectionName, open = false): Place => ({ section, open, mode: "design" })

export const panelOrder: Readonly<Record<PanelKind | "slide", readonly Place[]>> = {
  text: [
    slides("alignment"),
    slides("text"),
    slides("link"),
    slides("textFill"),
    slides("opacity"),
    design("boxFill"),
    design("paragraphSpacing"),
    design("box"),
    design("line"),
    design("effects"),
    design("body"),
    design("geometry"),
    design("identity"),
    design("image"),
    design("selectionColors", true),
  ],
  shape: [
    slides("alignment"),
    slides("fills"),
    slides("opacity"),
    slides("corners"),
    slides("border"),
    slides("shadow"),
    slides("selectionColors"),
    design("geometry"),
    design("line"),
    design("effects"),
    design("box"),
    design("text"),
    design("paragraphSpacing"),
    design("link"),
    design("body"),
    design("identity"),
    design("image"),
  ],
  picture: [
    slides("alignment"),
    slides("pictureFill"),
    slides("opacity"),
    slides("corners"),
    slides("border"),
    slides("shadow"),
    design("image"),
    design("crop"),
    design("box"),
    design("line"),
    design("effects"),
    design("geometry"),
    design("identity"),
    design("selectionColors", true),
  ],
  connector: [
    slides("alignment"),
    slides("border"),
    slides("shadow"),
    design("line"),
    design("connection"),
    design("opacity"),
    design("box"),
    design("effects"),
    design("geometry"),
    design("identity"),
    design("selectionColors", true),
  ],
  group: [slides("alignment"), slides("selectionColors"), design("box"), design("effects"), design("identity")],
  table: [slides("alignment"), design("box"), design("identity"), design("selectionColors", true)],
  chart: [slides("alignment"), design("box"), design("identity"), design("selectionColors", true)],
  kept: [design("identity", true), design("selectionColors", true)],
  many: [
    slides("alignment"),
    slides("text"),
    slides("textFill"),
    slides("fills"),
    slides("opacity"),
    design("boxFill"),
    slides("link"),
    slides("corners"),
    slides("border"),
    slides("shadow"),
    slides("selectionColors"),
    design("paragraphSpacing"),
    design("box"),
    design("line"),
    design("effects"),
  ],
  slide: [slides("templateStyle"), slides("background"), slides("selectionColors"), design("theme", true)],
}

export function panelPlaces(
  kind: PanelKind | "slide",
  mode: PanelMode,
  selection: readonly (PanelKind | null)[] = [],
): readonly Place[] {
  const places = panelOrder[kind].filter((place) => mode === "design" || place.mode === mode)
  const offered = selection.map((kind) => (kind === null ? [] : panelPlaces(kind, mode)))
  return places.filter(({ section }) => offered.every((places) => places.some((place) => place.section === section)))
}

export function sectionInMode(section: PanelSection, mode: PanelMode): PanelSection {
  if (mode === "design" || section.trait !== "fills") return section
  return {
    ...section,
    strips: section.strips.map((strip) =>
      strip.map((control) => {
        if (control.desc.kind !== "union") return control
        const { pattern: _pattern, ...cases } = control.desc.cases
        return { ...control, desc: { ...control.desc, cases } }
      }),
    ),
  }
}

export const loneRows: readonly string[] = [
  "identity.name",
  "identity.alt",
  "table.value",
  "crop.rect",
  "connection.start",
  "connection.end",
]

const panelKinds: readonly string[] = Object.keys(panelOrder).filter((kind) => kind !== "slide" && kind !== "many")

function rectangle(value: unknown): boolean {
  return typeof value === "object" && value !== null && "preset" in value && value.preset === "rect"
}

function drawn(shown: PanelReads): boolean {
  const read = shown.fields?.["geometry.shape"]
  if (read === undefined) return false
  return read.value === undefined || read.value === null ? read.own : !rectangle(read.value)
}

function imaged(shown: PanelReads): boolean {
  return paintSlots.some((slot) => {
    const value = shown.fields?.[`fills.${slot}`]?.value
    return typeof value === "object" && value !== null && "image" in value
  })
}

export function panelKind(view: ScopedElement, shown: PanelReads): PanelKind | null {
  const { kind, text } = view.facts
  if (kind === "shape" && !text && imaged(shown)) return "picture"
  if (kind === "shape") return text && !drawn(shown) ? "text" : "shape"
  return panelKinds.includes(kind) ? (kind as PanelKind) : null
}

export function hidden(kind: PanelKind | null, shown: PanelReads): readonly SectionName[] {
  const read = shown.fields?.["geometry.shape"]
  return kind === "picture" && read !== undefined && !drawn(shown) ? ["geometry"] : []
}
