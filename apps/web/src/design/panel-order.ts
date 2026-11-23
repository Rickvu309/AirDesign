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
    design("border"),
    design("geometry"),
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
    design("text"),
    design("link"),
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
    design("geometry"),
    design("selectionColors", true),
  ],
  connector: [
    slides("alignment"),
    slides("border"),
    slides("shadow"),
    design("opacity"),
    design("geometry"),
    design("selectionColors", true),
  ],
  group: [slides("alignment"), slides("selectionColors")],
  frame: [
    slides("alignment"),
    slides("fills"),
    slides("opacity"),
    slides("corners"),
    slides("border"),
    slides("shadow"),
    slides("selectionColors"),
  ],
  kept: [design("selectionColors", true)],
  many: [
    slides("alignment"),
    slides("text"),
    slides("textFill"),
    slides("fills"),
    slides("opacity"),
    slides("link"),
    slides("corners"),
    slides("border"),
    slides("shadow"),
    slides("selectionColors"),
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
  return mode === "design" && designStrips !== undefined ? { ...shown, strips: designStrips } : shown
}
