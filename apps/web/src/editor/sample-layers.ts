import { elementId } from "@airdesign/document"
import { layerTree, type LayerKind, type LayerRow } from "@/editor/layer-tree"

type Flags = { readonly hidden?: true; readonly locked?: true }

const row = (
  shape: number,
  name: string,
  kind: LayerKind,
  parent: number | null = null,
  flags: Flags = {},
): LayerRow => ({
  node: elementId(`258.${String(shape)}`),
  parent: parent === null ? null : elementId(`258.${String(parent)}`),
  name,
  kind,
  hidden: flags.hidden === true,
  locked: flags.locked === true,
})

export const sampleLayers = layerTree([
  row(2, "Eyebrow", "text", null, { locked: true }),
  row(3, "Headline", "text"),
  row(4, "Revenue chart", "frame"),
  row(5, "Baseline", "connector", 4),
  row(6, "Bars", "group", 4),
  row(7, "Q3 24", "shape", 6),
  row(8, "Q3 25", "shape", 6),
  row(9, "Axis labels", "text", 4),
  row(10, "Draft stamp", "shape", null, { hidden: true }),
  row(11, "Source note", "text"),
])

export const sampleSelected = [elementId("258.6")]
