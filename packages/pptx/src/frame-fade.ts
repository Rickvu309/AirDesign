import {
  layoutNodes,
  opaque,
  readLayout,
  shapeOf,
  type Alpha,
  type ElementId,
  type LayoutView,
  type Register,
} from "@airdesign/document"
import { scaledBytes } from "./alpha-codec.js"
import type { MarkupElement } from "./element-span.js"
import { changedPart } from "./fill-host.js"
import { withFiledFrames } from "./filed-frames.js"
import { slideAddresses } from "./package-address.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { shapeById } from "./shape-tree.js"
import { SlideEditor } from "./slide-editor.js"
import { markupChildren } from "./text-value-route.js"
import { shownAlphas, writeTrait } from "./trait-xml.js"
import type { ElementAt, Parts } from "./xml-codec.js"

type Faded = "fills" | "border" | "text"

const faded: readonly Faded[] = ["fills", "border", "text"]
const paints: readonly string[] = ["a:solidFill", "a:gradFill", "a:pattFill"]

function ownMarkup(bytes: Uint8Array, shape: string, trait: Faded): MarkupElement | undefined {
  const { elements } = requireMarkup(bytes)
  const children = markupChildren(elements)
  const within = (parent: MarkupElement | undefined, kinds: readonly string[]) =>
    parent === undefined ? undefined : children[parent.index]?.find((each) => kinds.includes(each.kind))
  const host = shapeById(elements, shape)
  if (trait === "text") return within(host, ["p:txBody"])
  const properties = within(host, ["p:spPr"])
  return trait === "border" ? within(properties, ["a:ln"]) : within(properties, paints)
}

function scaledMarkup(parts: Parts, at: ElementAt, trait: Faded, scale: Alpha): Parts {
  const bytes = partBytes(parts, at.part)
  const own = ownMarkup(bytes, at.shape, trait)
  if (own === undefined) return parts
  const next = scaledBytes(bytes.subarray(own.start, own.end), scale)
  return changedPart(parts, at.part, bytes, { start: own.start, end: own.end, next })
}

function fadedLayer(parts: Parts, at: ElementAt, scale: Alpha): Parts {
  const shown = shownAlphas(parts, at)
  let next = parts
  for (const trait of faded) {
    const alpha = shown[trait]
    if (alpha === "mixed") next = scaledMarkup(next, at, trait, scale)
    else if (alpha !== null)
      next = writeTrait(next, at, trait, { alpha: { set: Math.round((alpha * scale) / opaque) as Alpha } })
  }
  return next
}

function layersIn(register: Register, view: LayoutView): readonly ElementId[] {
  return [
    view.backdrop,
    ...view.children.flatMap((child) => {
      const inner = readLayout(register, child.node)
      return inner === null ? [child.node] : layersIn(register, inner)
    }),
  ]
}

export function fadedFrames(parts: Parts, opened: Register): Parts {
  const register = withFiledFrames(parts, opened)
  const nodes = layoutNodes(register)
  if (nodes.length === 0) return parts
  let slideParts: ReadonlyMap<string, string> | null = null
  let editor: SlideEditor | null = null
  for (const node of nodes) {
    const view = readLayout(register, node)
    if (view === null || view.opacity >= opaque) continue
    slideParts ??= new Map(slideAddresses(parts).map((address) => [address.slide, address.part]))
    const slide = shapeOf(node).slide
    const part = slideParts.get(slide)
    if (part === undefined) continue
    editor ??= new SlideEditor(parts)
    for (const layer of layersIn(register, view)) {
      const shape = shapeOf(layer).shape
      editor.editShape(part, shape, (scoped) => fadedLayer(scoped, { slide, part, shape }, view.opacity))
    }
  }
  return editor === null ? parts : editor.flush()
}
