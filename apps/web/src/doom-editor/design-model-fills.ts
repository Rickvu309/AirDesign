import type { Desc } from "@airdesign/document"
import { fillCopy } from "@/copy/fill-copy"
import { pictureCopy } from "@/copy/picture-copy"
import type { PanelControl, PanelSection } from "@/design/panel"
import type { PanelKind } from "@/design/panel-order"
import { arrange } from "@/design/panel-arrangement"
import { choiceDesc, descOf, oldControl } from "./design-controls"
import { shownFill } from "./design-paint-values"
import { oldColorOf } from "./design-values"
import type { ModelInput } from "./design-model"
import { propOf } from "@/editing/node-props"

export const imageFits = ["fill", "fit", "tile"]

function keeping(desc: Desc, names: readonly string[]): Desc {
  if (desc.kind !== "record") return desc
  return {
    kind: "record",
    fields: Object.fromEntries(Object.entries(desc.fields).filter(([name]) => names.includes(name))),
  }
}

function doomGradient(gradient: Desc): Desc {
  const kept = keeping(gradient, ["stops", "shade"])
  const shade = kept.kind === "record" ? kept.fields.shade : undefined
  if (kept.kind !== "record" || shade?.kind !== "union") return kept
  const { linear, path } = shade.cases
  if (linear === undefined || path === undefined) return kept
  const cases = { linear: keeping(linear, ["angle"]), path: keeping(path, []) }
  return { kind: "record", fields: { ...kept.fields, shade: { ...shade, cases } } }
}

export function paintDesc(): Desc {
  const whole = descOf("fills", "paint")
  if (whole.kind !== "union") return whole
  const { none, solid, gradient } = whole.cases
  if (none === undefined || solid === undefined || gradient === undefined) return whole
  return { ...whole, cases: { none, solid, gradient: doomGradient(gradient), image: { kind: "mark" } } }
}

function modeList(fit: string): PanelControl {
  const mode = oldControl("fills", "mode", { value: fit })
  return { ...mode, desc: choiceDesc(imageFits), look: { ...mode.look, name: { show: "hidden" }, form: "list" } }
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
    const color = oldControl("fills", "color", {
      value: top?.kind === "solid" ? oldColorOf(top.color) : undefined,
    })
    const weight = oldControl("fills", "weight", {
      value: iconWeightOld(propOf(node, "stroke")?.weight ?? 0, Math.min(box?.w ?? 1, box?.h ?? 1)),
    })
    return [{ trait: "pictureFill", label: fillCopy.section, open: true, strips: [[color, weight]] }]
  }
  const fills = propOf(node, "fills")
  const held = shownFill(fills)
  const image = fills?.findLast((paint) => paint.visible !== false)
  const paint = oldControl("fills", "paint", { value: held }, { desc: paintDesc() })
  const placement = image?.kind === "image" ? [[modeList(image.fit === "crop" ? "fill" : image.fit)]] : []
  const fillsSection: PanelSection = {
    trait: "fills",
    label: fillCopy.section,
    open: true,
    strips: [...arrange("fills", [paint]), ...placement],
  }
  if (kind !== "picture") return [fillsSection]
  const source = oldControl("fills", "source", { value: image?.kind === "image" ? image.asset : undefined })
  return [
    fillsSection,
    { trait: "pictureFill", label: fillCopy.section, open: true, strips: placement },
    { trait: "image", label: pictureCopy.section, open: false, strips: [[source]] },
  ]
}
