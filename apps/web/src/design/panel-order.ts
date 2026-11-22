import { paintSlots, readTextValue, type ScopedElement } from "@airdesign/document"
import type { PanelReads, PanelSection, SectionName } from "./panel"

export type PanelKind = "text" | "shape" | "picture" | "connector" | "group" | "frame" | "chart" | "kept" | "many"

export type PanelMode = "slides" | "design"

type PanelSectionName = SectionName | "selectionColors" | "templateStyle" | "background" | "layoutGuides"

export type Place = {
  readonly section: PanelSectionName
  readonly open: boolean
  readonly mode: PanelMode
  readonly only?: true
}

const slides = (section: PanelSectionName): Place => ({ section, open: true, mode: "slides" })
const slidesOnly = (section: PanelSectionName): Place => ({ ...slides(section), only: true })
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
    design("layout", true),
    design("box"),
    design("border"),
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
    design("effects"),
    design("layout", true),
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
    slidesOnly("pictureFill"),
    slides("opacity"),
    slides("corners"),
    slides("border"),
    slides("shadow"),
    design("fills", true),
    design("image"),
    design("crop"),
    design("layout", true),
    design("box"),
    design("effects"),
    design("geometry"),
    design("identity"),
    design("selectionColors", true),
  ],
  connector: [
    slides("alignment"),
    slides("border"),
    slides("shadow"),
    design("connection"),
    design("opacity"),
    design("box"),
    design("effects"),
    design("geometry"),
    design("identity"),
    design("selectionColors", true),
  ],
  group: [
    slides("alignment"),
    slides("selectionColors"),
    design("layout", true),
    design("box"),
    design("effects"),
    design("identity"),
  ],
  frame: [
    slides("alignment"),
    slides("fills"),
    slides("opacity"),
    slides("corners"),
    slides("border"),
    slides("shadow"),
    slides("selectionColors"),
    design("layout", true),
    design("box"),
    design("effects"),
    design("identity"),
  ],
  chart: [
    slides("alignment"),
    design("layout", true),
    design("box"),
    design("identity"),
    design("selectionColors", true),
  ],
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
    design("effects"),
  ],
  slide: [slides("templateStyle"), slides("background"), slides("selectionColors"), design("layoutGuides", true)],
}

export function panelPlaces(
  kind: PanelKind | "slide",
  mode: PanelMode,
  selection: readonly (PanelKind | null)[] = [],
): readonly Place[] {
  const places = panelOrder[kind].filter((place) => (mode === "design" ? place.only !== true : place.mode === mode))
  const offered = selection.map((kind) => (kind === null ? [] : panelPlaces(kind, mode)))
  return places.filter(({ section }) => offered.every((places) => places.some((place) => place.section === section)))
}

export function sectionInMode(section: PanelSection, mode: PanelMode): PanelSection {
  const { designStrips, ...shown } = section
  if (mode === "design") return designStrips === undefined ? shown : { ...shown, strips: designStrips }
  if (section.trait !== "fills") return shown
  return {
    ...shown,
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

function filled(shown: PanelReads): boolean {
  const value = shown.fields?.["fills.p0"]?.value
  return typeof value === "object" && value !== null && !("none" in value)
}

export function wordless(view: ScopedElement): boolean {
  if (view.value === null) return true
  const text = readTextValue(view.value)
  if (text === null) return view.value === ""
  return text.every((paragraph) => paragraph.runs.every((run) => run.text === ""))
}

function imaged(shown: PanelReads): boolean {
  return paintSlots.some((slot) => {
    const value = shown.fields?.[`fills.${slot}`]?.value
    return typeof value === "object" && value !== null && "image" in value
  })
}

export function panelKind(view: ScopedElement, shown: PanelReads): PanelKind | null {
  const { kind, text } = view.facts
  if (view.facts.frame !== undefined) return "frame"
  if (kind === "shape" && !text && imaged(shown)) return "picture"
  if (kind === "shape") return text && !drawn(shown) && !(wordless(view) && filled(shown)) ? "text" : "shape"
  return panelKinds.includes(kind) ? (kind as PanelKind) : null
}

export function hidden(kind: PanelKind | null, shown: PanelReads): readonly SectionName[] {
  const read = shown.fields?.["geometry.shape"]
  return kind === "picture" && read !== undefined && !drawn(shown) ? ["geometry"] : []
}
