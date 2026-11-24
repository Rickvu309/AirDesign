import type { SectionName } from "./panel"

export type PanelKind = "text" | "shape" | "picture" | "icon" | "connector" | "group" | "frame" | "many"

type PanelSectionName = SectionName | "selectionColors" | "theme" | "background"

export const panelOrder: Readonly<Record<PanelKind | "slide", readonly PanelSectionName[]>> = {
  text: ["alignment", "text", "link", "textFill"],
  shape: ["alignment", "fills", "border", "selectionColors", "geometry"],
  picture: ["alignment", "pictureFill", "border"],
  icon: ["alignment", "pictureFill"],
  connector: ["alignment", "border"],
  group: ["alignment", "selectionColors"],
  frame: ["alignment", "fills", "border", "selectionColors"],
  many: ["alignment", "text", "textFill", "fills", "link", "border", "selectionColors"],
  slide: ["theme", "background", "selectionColors"],
}

export function panelSections(
  kind: PanelKind | "slide",
  selection: readonly (PanelKind | null)[] = [],
): readonly PanelSectionName[] {
  const offered = selection.map((each) => (each === null ? [] : panelOrder[each]))
  return panelOrder[kind].filter((section) => offered.every((kinds) => kinds.includes(section)))
}
