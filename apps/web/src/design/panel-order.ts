import type { PanelSection, SectionName } from "./panel"

export type PanelKind = "text" | "shape" | "picture" | "connector" | "group" | "frame" | "kept" | "many"

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
    slides("geometry"),
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
