import type { SectionName } from "./panel"

export type PanelKind = "text" | "shape" | "picture" | "icon" | "connector" | "group" | "frame" | "chart" | "many"

type PanelSectionName = SectionName | "selectionColors" | "templateStyle" | "background"

const frameSections = ["alignment", "fills", "border", "selectionColors"] as const satisfies readonly PanelSectionName[]

export const panelOrder: Readonly<Record<PanelKind | "slide", readonly PanelSectionName[]>> = {
  text: ["alignment", "text", "link", "textFill"],
  shape: ["alignment", "fills", "border", "selectionColors", "geometry"],
  picture: ["alignment", "pictureFill", "border"],
  icon: ["alignment", "pictureFill"],
  connector: ["alignment", "border"],
  group: ["alignment", "selectionColors"],
  frame: frameSections,
  chart: frameSections,
  many: ["alignment", "text", "textFill", "fills", "link", "border", "selectionColors"],
  slide: ["templateStyle", "background", "selectionColors"],
}

export function panelSections(
  kind: PanelKind | "slide",
  selection: readonly (PanelKind | null)[] = [],
): readonly PanelSectionName[] {
  const offered = selection.map((each) => (each === null ? [] : panelOrder[each]))
  return panelOrder[kind].filter((section) => offered.every((kinds) => kinds.includes(section)))
}
