import * as doom from "@airdesign/doom"
import { readStyleName } from "@airdesign/fonts"
import type { PanelControl } from "@/design/panel"
import { alignWrites, distributeWrites, type AlignTo, type DistributeAcross } from "./design-align"
import {
  defaultStroke,
  fillWrite,
  shadowOpacityWrite,
  shadowWrite,
  strokePaintWrite,
  type ShadowName,
} from "./design-paint-values"
import { lineNew, lookWrite, paraWrite, sizeNew, styleWrite, type LookPatch } from "./design-text-values"
import { cornerEmu, pointEmu, doomColorOf, wholeFraction } from "./design-values"
import { propOf } from "@/editing/node-props"
import type { SlideGeometry } from "./slide-geometry"
import type { Color as OldColor } from "@airdesign/document"

export type ChangeContext = {
  readonly view: doom.Doom
  readonly ids: readonly doom.NodeId[]
  readonly geometry: SlideGeometry
  readonly size: { readonly w: number; readonly h: number }
  readonly slides: readonly doom.NodeId[]
}

type Writes = readonly doom.Write[]

const keyOf = (control: PanelControl) => `${control.trait}.${control.field}`

function eachText(context: ChangeContext, change: (text: doom.Text) => doom.Text): Writes {
  return context.ids.flatMap((node): doom.Write[] => {
    const text = propOf(context.view.nodes.get(node), "text")
    return text === undefined ? [] : [{ node, prop: "text", value: change(text) }]
  })
}

function look(context: ChangeContext, patch: LookPatch): Writes {
  return eachText(context, (text) => lookWrite(text, patch))
}

function onlyColor(value: unknown): doom.Color | undefined {
  if (typeof value !== "object" || value === null || !("solid" in value)) return undefined
  return doomColorOf(value.solid as OldColor)
}

function setEach<K extends doom.PropName>(
  context: ChangeContext,
  prop: K,
  value: (id: doom.NodeId) => doom.Props[K] | null | undefined,
): Writes {
  return context.ids.flatMap((node): doom.Write[] => {
    const next = value(node)
    return next === undefined ? [] : [{ node, prop, value: next }]
  })
}

function textChange(context: ChangeContext, control: PanelControl, value: unknown): Writes | null {
  const { field } = control
  const number = typeof value === "number" ? value : undefined
  switch (field) {
    case "style":
      return typeof value === "string" ? eachText(context, (text) => styleWrite(text, value as doom.TextStyleName)) : []
    case "font":
      return typeof value === "string" ? look(context, { font: value }) : []
    case "weight": {
      const style = typeof value === "string" ? readStyleName(value) : undefined
      return style === undefined ? [] : look(context, { bold: style.weight >= 600, italic: style.italic })
    }
    case "size":
      return number === undefined ? [] : look(context, { size: sizeNew(number) })
    case "letterSpacing":
      return number === undefined ? [] : look(context, { tracking: Math.round(number) / 100 })
    case "lineHeight":
      return number === undefined ? [] : eachText(context, (text) => paraWrite(text, { lineHeight: lineNew(number) }))
    case "bold":
    case "italic":
    case "underline":
    case "strike":
      return typeof value === "boolean" ? look(context, { [field]: value }) : []
    case "align":
      return typeof value === "string"
        ? eachText(context, (text) => paraWrite(text, { align: value as NonNullable<doom.Para["align"]> }))
        : []
    case "list":
      return eachText(context, (text) => ({
        ...text,
        paras: text.paras.map((para) => {
          const { list: _list, ...rest } = para
          return value === "bullets"
            ? { ...rest, list: "bullet" }
            : value === "numbers"
              ? { ...rest, list: "number" }
              : rest
        }),
      }))
    case "case":
      return value === "none" || value === "upper" || value === "lower" || value === "title"
        ? look(context, { case: value })
        : []
    case "fill": {
      const color = onlyColor(value)
      return color === undefined ? [] : look(context, { color })
    }
    default:
      return null
  }
}

function paintChange(context: ChangeContext, control: PanelControl, value: unknown): Writes | null {
  switch (keyOf(control)) {
    case "fills.paint":
      return setEach(context, "fills", (id) => fillWrite(propOf(context.view.nodes.get(id), "fills"), value))
    case "textFill.value": {
      const color = onlyColor(value)
      return color === undefined ? [] : look(context, { color })
    }
    case "image.mode":
      return setEach(context, "fills", (id) => {
        const fills = propOf(context.view.nodes.get(id), "fills") ?? []
        const at = fills.findLastIndex((paint) => paint.kind === "image")
        const fit = value as doom.ImagePaint["fit"]
        const held = fills[at]
        if (at < 0 || held?.kind !== "image") return undefined
        return fills.map((paint, index) => (index === at ? { ...held, fit } : paint))
      })
    default:
      return null
  }
}

function strokeChange(context: ChangeContext, control: PanelControl, value: unknown): Writes | null {
  const plain: doom.StrokeStyle = { weight: 4, align: "center", dash: "solid" }
  const styled = (id: doom.NodeId) => propOf(context.view.nodes.get(id), "stroke") ?? plain
  switch (keyOf(control)) {
    case "border.border": {
      if (value === "none") return setEach(context, "strokes", () => null)
      if (value !== "solid" && value !== "dash" && value !== "dot") return []
      return context.ids.flatMap((node): doom.Write[] => {
        const held = propOf(context.view.nodes.get(node), "strokes") ?? []
        const writes: doom.Write[] = [{ node, prop: "stroke", value: { ...styled(node), dash: value } }]
        if (!held.some((paint) => paint.visible !== false))
          writes.unshift({ node, prop: "strokes", value: [...held, defaultStroke] })
        return writes
      })
    }
    case "border.color": {
      const color = doomColorOf(value as OldColor)
      if (color === undefined) return []
      return setEach(context, "strokes", (id) => strokePaintWrite(propOf(context.view.nodes.get(id), "strokes"), color))
    }
    case "border.width":
      return typeof value === "number"
        ? setEach(context, "stroke", (id) => ({
            ...styled(id),
            weight: Math.max(0, Math.round((value / pointEmu) * 100) / 100),
          }))
        : []
    case "image.color": {
      const color = doomColorOf(value as OldColor)
      return color === undefined
        ? []
        : setEach(context, "strokes", (id) => strokePaintWrite(propOf(context.view.nodes.get(id), "strokes"), color))
    }
    case "image.weight":
      return typeof value === "number"
        ? setEach(context, "stroke", (id) => {
            const box = propOf(context.view.nodes.get(id), "box")
            const side = Math.min(box?.w ?? 1, box?.h ?? 1)
            return { ...styled(id), weight: Math.round((value / 100 / 24) * side * 100) / 100 }
          })
        : []
    default:
      return null
  }
}

function appearanceChange(context: ChangeContext, control: PanelControl, value: unknown): Writes | null {
  switch (keyOf(control)) {
    case "opacity.opacity":
      return typeof value === "number"
        ? setEach(context, "opacity", () => {
            const next = Math.min(1, Math.max(0, value / wholeFraction))
            return next === 1 ? null : next
          })
        : []
    case "corners.corners":
      return typeof value === "number"
        ? setEach(context, "radius", () => {
            const next = Math.max(0, Math.round(value / cornerEmu))
            return next === 0 ? null : next
          })
        : []
    case "shadow.shadow":
      return typeof value === "string"
        ? setEach(context, "effects", (id) =>
            shadowWrite(value as ShadowName, propOf(context.view.nodes.get(id), "effects")),
          )
        : []
    case "shadow.opacity":
      return typeof value === "number"
        ? setEach(context, "effects", (id) =>
            shadowOpacityWrite(propOf(context.view.nodes.get(id), "effects"), value / wholeFraction),
          )
        : []
    case "link.target": {
      const target = value as { readonly kind?: string; readonly url?: string; readonly slide?: string } | null
      if (target === null || target.kind === "none") return setEach(context, "link", () => null)
      const next = target.kind === "url" ? addressOf(target.url) : target.slide
      return next === undefined ? [] : setEach(context, "link", () => next as doom.Props["link"])
    }
    case "box.align":
      return alignWrites(context.view, context.geometry, context.ids, value as AlignTo, context.size)
    case "box.distribute":
      return distributeWrites(context.view, context.geometry, context.ids, value as DistributeAcross)
    default:
      return null
  }
}

const addressOf = (typed: string | undefined): string | undefined =>
  typed === undefined || /^[a-z][a-z0-9+.-]*:/i.test(typed) ? typed : `https://${typed}`

export function changeWrites(context: ChangeContext, control: PanelControl, value: unknown): Writes {
  if (control.trait === "text" || control.trait === "textFill") {
    const written =
      control.trait === "textFill" ? paintChange(context, control, value) : textChange(context, control, value)
    if (written !== null) return written
  }
  return (
    paintChange(context, control, value) ??
    strokeChange(context, control, value) ??
    appearanceChange(context, control, value) ??
    []
  )
}
