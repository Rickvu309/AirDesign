import * as doom from "@airdesign/doom"
import { readStyleName } from "@airdesign/fonts"
import type { PanelControl } from "@/design/panel"
import { fitWrites } from "./crop-drag"
import { alignWrites, distributeWrites, type AlignTo, type DistributeAcross } from "./design-align"
import { defaultStroke, fillWrite, strokePaintWrite } from "./design-paint-values"
import { sizeFromHundredths, textWithWeight } from "./design-text-values"
import { propOf } from "@airdesign/doom"
import type { SlideGeometry } from "./slide-geometry"
import { shapeWrite, shownShape } from "./design-shape-values"

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

function look(context: ChangeContext, patch: doom.TextPatch): Writes {
  return eachText(context, (text) => doom.lookWrite(text, patch))
}

function onlyColor(value: unknown): doom.Color | undefined {
  if (typeof value !== "object" || value === null || !("solid" in value)) return undefined
  return doom.readColor(value.solid)
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
      return typeof value === "string"
        ? eachText(context, (text) => doom.styleWrite(text, value as doom.TextStyleName))
        : []
    case "font":
      return typeof value === "string" ? look(context, { font: value }) : []
    case "weight": {
      const picked = typeof value === "string" ? readStyleName(value) : undefined
      if (picked === undefined) return []
      const theme = doom.deckOf(context.view).theme
      return eachText(context, (text) => textWithWeight(text, theme, picked))
    }
    case "size":
      return number === undefined ? [] : look(context, { size: sizeFromHundredths(number) })
    case "bold":
    case "italic":
    case "underline":
    case "strike":
      return typeof value === "boolean" ? look(context, { [field]: value }) : []
    case "align":
      return typeof value === "string"
        ? eachText(context, (text) => doom.paraWrite(text, { align: value as NonNullable<doom.Para["align"]> }))
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
      return value === "fill" || value === "fit" || value === "crop"
        ? context.ids.flatMap((id) => fitWrites(context.view, id, value))
        : []
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
    case "border.route":
      return value === "straight" || value === "elbow" || value === "curve"
        ? setEach(context, "geometry", (id) => {
            const geometry = propOf(context.view.nodes.get(id), "geometry")
            return geometry?.kind === "line" ? { ...geometry, route: value } : undefined
          })
        : []
    case "border.start":
    case "border.end": {
      const arrow =
        value === "none" || value === "arrow" || value === "triangle" || value === "circle" ? value : undefined
      if (arrow === undefined) return []
      const atEnd = keyOf(control) === "border.end"
      return setEach(context, "geometry", (id) => {
        const geometry = propOf(context.view.nodes.get(id), "geometry")
        if (geometry?.kind !== "line") return undefined
        const [start, end] = geometry.arrows
        return { ...geometry, arrows: atEnd ? [start, arrow] : [arrow, end] }
      })
    }
    case "border.color": {
      const color = doom.readColor(value)
      if (color === undefined) return []
      return setEach(context, "strokes", (id) => strokePaintWrite(propOf(context.view.nodes.get(id), "strokes"), color))
    }
    case "image.color": {
      const color = doom.readColor(value)
      return color === undefined
        ? []
        : setEach(context, "strokes", (id) => strokePaintWrite(propOf(context.view.nodes.get(id), "strokes"), color))
    }
    default:
      return null
  }
}

function appearanceChange(context: ChangeContext, control: PanelControl, value: unknown): Writes | null {
  switch (keyOf(control)) {
    case "link.target": {
      const next = linkOf(value)
      return next === undefined ? [] : setEach(context, "link", () => next as doom.Props["link"] | null)
    }
    case "geometry.preset": {
      const next = shapeWrite({ preset: value, adjust: {} })
      return next === undefined ? [] : setEach(context, "geometry", () => next)
    }
    case "geometry.adjust":
      return setEach(context, "geometry", (id) => {
        const preset = shownShape(propOf(context.view.nodes.get(id), "geometry"))?.preset
        return preset === undefined ? undefined : shapeWrite({ preset, adjust: value })
      })
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

export function linkOf(value: unknown): string | null | undefined {
  const target = value as { readonly kind?: string; readonly url?: string; readonly slide?: string } | null
  if (target === null || target.kind === "none") return null
  return target.kind === "url" ? addressOf(target.url) : target.slide
}

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
