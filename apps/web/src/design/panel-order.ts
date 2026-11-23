import type { SectionName } from "./panel"

export type PanelKind = "text" | "shape" | "picture" | "connector" | "group" | "frame" | "many"

type PanelSectionName = SectionName | "selectionColors" | "templateStyle" | "background"

export const panelOrder: Readonly<Record<PanelKind | "slide", readonly PanelSectionName[]>> = {
  text: ["alignment", "text", "link", "textFill", "opacity"],
  shape: ["alignment", "fills", "opacity", "corners", "border", "shadow", "selectionColors", "geometry"],
  picture: ["alignment", "pictureFill", "opacity", "corners", "border", "shadow"],
  connector: ["alignment", "border", "shadow"],
  group: ["alignment", "selectionColors"],
  frame: ["alignment", "fills", "opacity", "corners", "border", "shadow", "selectionColors"],
  many: ["alignment", "text", "textFill", "fills", "opacity", "link", "corners", "border", "shadow", "selectionColors"],
  slide: ["templateStyle", "background", "selectionColors"],
}

export function panelSections(
  kind: PanelKind | "slide",
  selection: readonly (PanelKind | null)[] = [],
): readonly PanelSectionName[] {
  const offered = selection.map((each) => (each === null ? [] : panelOrder[each]))
  return panelOrder[kind].filter((section) => offered.every((kinds) => kinds.includes(section)))
}
