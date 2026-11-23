import * as doom from "@airdesign/doom"
import type { PanelModel, PanelSection } from "@/design/panel"
import type { PanelKind } from "@/design/panel-order"
import { choiceDesc, type Desc } from "@/design/control-desc"
import { doomControl } from "./design-controls"
import { cornersSection, opacitySection, shadowSection } from "./design-model-appearance"
import { borderSections } from "./design-model-border"
import { fillSections } from "./design-model-fills"
import { textSections } from "./design-model-text"
import { isGroup } from "./group-scale"
import { boxCopy } from "@/copy/box-copy"
import { geometryCopy } from "@/copy/geometry-copy"
import { linkCopy } from "@/copy/link-copy"
import { shownShape } from "./design-shape-values"
import { propOf } from "@/editing/node-props"
import type { LinkedWords } from "./text-edit"

export type ModelInput = {
  readonly view: doom.Doom
  readonly id: doom.NodeId
  readonly theme: doom.Theme
  readonly slides: readonly doom.NodeId[]
  readonly words?: LinkedWords | null
}

const visible = (paint: doom.Paint) => paint.visible !== false

export function kindOf(view: doom.Doom, id: doom.NodeId): PanelKind {
  const node = view.nodes.get(id)
  if (node === undefined) return "shape"
  if (node.type === "frame") return isGroup(view, id) ? "group" : "frame"
  const geometry = propOf(node, "geometry")
  if (geometry?.kind === "line") return "connector"
  if (geometry?.kind === "icon") return "picture"
  const fills = (propOf(node, "fills") ?? []).filter(visible)
  const text = propOf(node, "text")
  if (text === undefined && fills.some((paint) => paint.kind === "image")) return "picture"
  const drawn = geometry !== undefined && geometry.kind !== "rect"
  const painted = fills.length > 0 || (propOf(node, "strokes") ?? []).some(visible)
  return text !== undefined && !drawn && !painted ? "text" : "shape"
}

const alignments = ["left", "center", "right", "top", "middle", "bottom"]
const distributions = ["horizontal", "vertical"]

function alignmentSection(): PanelSection {
  const align = doomControl({ trait: "box", field: "align" }, boxCopy.align, choiceDesc(alignments), {
    value: undefined,
  })
  const distribute = doomControl({ trait: "box", field: "distribute" }, boxCopy.distribute, choiceDesc(distributions), {
    value: undefined,
  })
  return { trait: "alignment", label: null, open: true, strips: [[align, distribute]] }
}

function linkSection(input: ModelInput): PanelSection[] {
  const held = input.words == null ? propOf(input.view.nodes.get(input.id), "link") : input.words.link
  const slide = held !== undefined && input.slides.includes(held as doom.NodeId)
  const target = held === undefined ? undefined : slide ? { kind: "slide", slide: held } : { kind: "url", url: held }
  const control = doomControl(
    { trait: "link", field: "target" },
    linkCopy.target,
    { kind: "link" },
    { value: target },
    { slides: input.slides },
  )
  return [{ trait: "link", label: linkCopy.section, open: true, strips: [[control]] }]
}

const adjustDesc: Desc = {
  kind: "named",
  item: { kind: "number", unit: "count", min: -2_147_483_647, max: 2_147_483_647 },
  max: 8,
}

function geometrySection(view: doom.Doom, id: doom.NodeId): PanelSection[] {
  const node = view.nodes.get(id)
  if (node?.type !== "shape") return []
  const shown = shownShape(propOf(node, "geometry"))
  if (shown === null) return []
  const preset = doomControl({ trait: "geometry", field: "preset" }, geometryCopy.shape, choiceDesc(doom.shapeNames), {
    value: shown.preset,
  })
  const named = Object.keys(shown.adjust).some((name) => geometryCopy.adjust(shown.preset, name) !== undefined)
  const adjust = doomControl(
    { trait: "geometry", field: "adjust" },
    geometryCopy.shape,
    adjustDesc,
    { value: shown.adjust },
    { parent: { preset: shown.preset } },
  )
  const strips = named ? [[preset], [adjust]] : [[preset]]
  return [{ trait: "geometry", label: geometryCopy.section, open: true, strips }]
}

export function nodeModel(input: ModelInput): PanelModel {
  const { view, id } = input
  const kind = kindOf(view, id)
  const layout = propOf(view.nodes.get(id), "layout")
  const iconed = propOf(view.nodes.get(id), "geometry")?.kind === "icon"
  const drawn = kind === "shape" || kind === "frame" || kind === "connector" || (kind === "picture" && !iconed)
  return {
    node: id,
    nodes: [id],
    kind,
    ...(layout !== undefined && layout.mode !== "none" ? { frame: "auto" as const } : {}),
    sections: [
      alignmentSection(),
      ...textSections(input, kind),
      ...fillSections(input, kind),
      ...(kind === "group" ? [] : opacitySection(input, kind)),
      ...(kind === "shape" || kind === "frame" || (kind === "picture" && !iconed) ? cornersSection(input) : []),
      ...(drawn ? borderSections(input, kind) : []),
      ...(drawn || kind === "picture" ? shadowSection(input) : []),
      ...(kind === "text" ? linkSection(input) : []),
      ...geometrySection(view, id),
    ],
  }
}
