import { fillCopy } from "@/copy/fill-copy"
import { pictureCopy } from "@/copy/picture-copy"
import { choiceDesc, type Desc } from "@/design/control-desc"
import type { PanelControl, PanelSection } from "@/design/panel"
import type { PanelKind } from "@/design/panel-order"
import { arrange } from "@/design/panel-arrangement"
import { doomControl } from "./design-controls"
import { shownFill } from "./design-paint-values"
import type { ModelInput } from "./design-model"
import { propOf } from "@/editing/node-props"

export const imageFits = ["fill", "fit", "tile"]

const mark: Desc = { kind: "mark" }
const colorDesc: Desc = { kind: "color" }

const gradientDesc: Desc = {
  kind: "record",
  fields: {
    stops: {
      kind: "list",
      item: {
        kind: "record",
        fields: { pos: { kind: "number", unit: "fraction", min: 0, max: 100_000 }, color: colorDesc },
      },
      min: 2,
      max: 10,
    },
    shade: {
      kind: "union",
      cases: {
        linear: { kind: "record", fields: { angle: { kind: "number", unit: "angle", min: 0, max: 21_599_999 } } },
        path: { kind: "record", fields: {} },
      },
      plain: null,
    },
  },
}

export const paintDesc: Desc = {
  kind: "union",
  cases: { none: mark, solid: colorDesc, gradient: gradientDesc, image: mark },
  plain: "solid",
}

const iconWeightDesc: Desc = { kind: "number", unit: "hundredth-point", min: 50, max: 300 }

const imageControl = (field: string, label: string, desc: Desc, value: unknown) =>
  doomControl({ trait: "image", field }, label, desc, { value })

function modeList(fit: string): PanelControl {
  const mode = imageControl("mode", pictureCopy.mode, choiceDesc(imageFits), fit)
  return { ...mode, look: { ...mode.look, name: { show: "hidden" }, form: "list" } }
}

const lucideWeight = 24

export function iconWeightOld(stroke: number, side: number): number {
  return Math.round((stroke / Math.max(1, side)) * lucideWeight * 100)
}

export function fillSections(input: ModelInput, kind: PanelKind): PanelSection[] {
  const node = input.view.nodes.get(input.id)
  if (kind === "connector" || kind === "group" || node === undefined) return []
  const geometry = propOf(node, "geometry")
  if (geometry?.kind === "icon") {
    const strokes = propOf(node, "strokes") ?? []
    const top = strokes.findLast((paint) => paint.visible !== false)
    const box = propOf(node, "box")
    const color = imageControl("color", pictureCopy.color, colorDesc, top?.kind === "solid" ? top.color : undefined)
    const weight = imageControl(
      "weight",
      pictureCopy.weight,
      iconWeightDesc,
      iconWeightOld(propOf(node, "stroke")?.weight ?? 0, Math.min(box?.w ?? 1, box?.h ?? 1)),
    )
    return [{ trait: "pictureFill", label: fillCopy.section, strips: [[color, weight]] }]
  }
  const fills = propOf(node, "fills")
  const held = shownFill(fills)
  const image = fills?.findLast((paint) => paint.visible !== false)
  const paint = doomControl({ trait: "fills", field: "paint" }, fillCopy.value, paintDesc, { value: held })
  const placement = image?.kind === "image" ? [[modeList(image.fit === "crop" ? "fill" : image.fit)]] : []
  const fillsSection: PanelSection = {
    trait: "fills",
    label: fillCopy.section,
    strips: [...arrange("fills", [paint]), ...placement],
  }
  if (kind !== "picture") return [fillsSection]
  const source = imageControl(
    "source",
    pictureCopy.source,
    { kind: "asset" },
    image?.kind === "image" ? image.asset : undefined,
  )
  return [
    fillsSection,
    { trait: "pictureFill", label: fillCopy.section, strips: placement },
    { trait: "image", label: pictureCopy.section, strips: [[source]] },
  ]
}
