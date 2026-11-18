import { alphaOf, fadedColor, opaque, type Alpha, type Color, type FieldValue } from "@airdesign/document"
import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { requireMarkup } from "./part-markup.js"
import type { ElementAt, PartCodec, Parts } from "./xml-codec.js"

export type Faded = Alpha | "mixed" | null

type Fill = FieldValue<"fills", "p0"> | FieldValue<"border", "fill">

const alphaOps: readonly string[] = ["alpha", "alphaMod", "alphaOff"]
const colorKinds: readonly string[] = ["a:schemeClr", "a:srgbClr", "a:sysClr", "a:prstClr", "a:scrgbClr", "a:hslClr"]

function clamped(value: number): number {
  return Math.min(opaque, Math.max(0, Math.round(value)))
}

export function shownAlpha(colors: readonly Color[]): Faded {
  const [first, ...rest] = colors.map((color) => alphaOf(color) as Alpha)
  if (first === undefined) return null
  return rest.every((each) => each === first) ? first : "mixed"
}

export function agreed(alphas: readonly Faded[]): Faded {
  const shown = alphas.filter((each) => each !== null)
  const [first, ...rest] = shown
  if (first === undefined) return null
  return first !== "mixed" && rest.every((each) => each === first) ? first : "mixed"
}

function attributeOf(element: MarkupElement, name: string): number | null {
  const text = element.attributes.find((each) => each.name === name)?.value
  return text === undefined || !/^-?\d+$/.test(text) ? null : Number(text)
}

export function fragmentAlpha(fragment: Uint8Array): Faded {
  const { elements } = requireMarkup(fragment)
  const colors = elements.filter((element) => colorKinds.includes(element.kind))
  return agreed(
    colors.map((color) => {
      let alpha: number = opaque
      for (const kid of elements.filter((each) => each.parent === color.index)) {
        const value = attributeOf(kid, "val")
        if (value === null) continue
        if (kid.kind === "a:alpha") alpha = value
        else if (kid.kind === "a:alphaMod") alpha = (alpha * value) / opaque
        else if (kid.kind === "a:alphaOff") alpha += value
      }
      return clamped(alpha) as Alpha
    }),
  )
}

export function colorsOf(fill: Fill): readonly Color[] {
  if ("solid" in fill) return [fill.solid]
  if ("gradient" in fill) return fill.gradient.stops.map((stop) => stop.color)
  if ("pattern" in fill) return [fill.pattern.fg, fill.pattern.bg]
  return []
}

export function fadedFill(fill: FieldValue<"border", "fill">, alpha: Alpha): FieldValue<"border", "fill">
export function fadedFill(fill: Fill, alpha: Alpha): Fill
export function fadedFill(fill: Fill, alpha: Alpha): Fill {
  if ("solid" in fill) return { solid: fadedColor(fill.solid, alpha) }
  if ("gradient" in fill) {
    const stops = fill.gradient.stops.map((stop) => ({ ...stop, color: fadedColor(stop.color, alpha) }))
    return { gradient: { ...fill.gradient, stops } }
  }
  if ("pattern" in fill) {
    const { fg, bg } = fill.pattern
    return { pattern: { ...fill.pattern, fg: fadedColor(fg, alpha), bg: fadedColor(bg, alpha) } }
  }
  return fill
}

function openText(bytes: Uint8Array, element: MarkupElement): string {
  return decodeUtf8(bytes.subarray(element.start, element.openEnd - (element.selfClosing ? 2 : 1))).trimEnd()
}

function fadedElement(bytes: Uint8Array, element: MarkupElement, kids: readonly MarkupElement[], alpha: Alpha): string {
  const kept = kids
    .filter((kid) => !alphaOps.includes(kid.kind.slice(2)))
    .map((kid) => decodeUtf8(bytes.subarray(kid.start, kid.end)))
  const inner = [...kept, ...(alpha >= opaque ? [] : [`<a:alpha val="${String(alpha)}"/>`])].join("")
  const open = openText(bytes, element)
  return inner === "" ? `${open}/>` : `${open}>${inner}</${element.kind}>`
}

export function fadedBytes(fragment: Uint8Array, alpha: Alpha): Uint8Array {
  const { elements } = requireMarkup(fragment)
  const edits: ByteEdit[] = elements
    .filter((element) => colorKinds.includes(element.kind))
    .map((element) => {
      const kids = elements.filter((each) => each.parent === element.index)
      return { start: element.start, end: element.end, next: encodeUtf8(fadedElement(fragment, element, kids, alpha)) }
    })
  return edits.length === 0 ? fragment : spliceBytes(fragment, edits)
}

export function alphaKept<V>(
  codec: PartCodec<V>,
  alpha: (parts: Parts, at: ElementAt) => Faded,
  fade: (parts: Parts, at: ElementAt, alpha: Alpha) => Parts,
  names: (value: V) => boolean,
): PartCodec<V> {
  return {
    read: codec.read,
    write(parts, at, value) {
      const before = alpha(parts, at)
      const next = codec.write(parts, at, value)
      if (before === null || before === "mixed" || before >= opaque || names(value)) return next
      return fade(next, at, before)
    },
  }
}
