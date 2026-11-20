import { decodedXmlText, type MarkupElement } from "./element-span.js"
import { maskAt, maskElement } from "./mask-extension.js"
import { decodeUtf8 } from "./package-bytes.js"
import { paintAttribute } from "./paint-color.js"
import { requireMarkup } from "./part-markup.js"
import { isShapeTag, shapeTags } from "./shape-tree.js"
import { markupChildren, type MarkupChildren } from "./text-value-route.js"

export type MaskLook = "kept" | "native" | "picture" | "none"

export type MaskRun = {
  readonly mask: string
  readonly masked: readonly string[]
  readonly run: readonly string[]
  readonly look: MaskLook
}

export type Sibling = {
  readonly element: MarkupElement
  readonly identity: MarkupElement
  readonly id: string
  readonly hidden: boolean
  readonly mask: boolean
}

export type Baked = { readonly digest: string; readonly markup: string }

const full = 100_000

function identityOf(children: MarkupChildren, shape: MarkupElement): MarkupElement | undefined {
  if (!isShapeTag(shape.kind)) return undefined
  const visual = children[shape.index]?.find(
    (each) => each.kind === shapeTags[shape.kind as keyof typeof shapeTags].nonVisual,
  )
  return visual === undefined ? undefined : children[visual.index]?.find((each) => each.kind === "p:cNvPr")
}

export function siblingsOf(children: MarkupChildren, parent: MarkupElement): readonly Sibling[] {
  return (children[parent.index] ?? []).flatMap((element) => {
    const identity = identityOf(children, element)
    const id = identity === undefined ? null : paintAttribute(identity, "id")
    if (identity === undefined || id === null) return []
    const hidden = paintAttribute(identity, "hidden")
    return [{ element, identity, id, hidden: hidden === "1" || hidden === "true", mask: maskAt(children, element) }]
  })
}

export function digestOf(bytes: Uint8Array, spans: readonly MarkupElement[], skip?: MarkupElement): string {
  let hash = 0x811c9dc5
  let second = 0x01000193
  for (const span of spans) {
    for (let at = span.start; at < span.end; at += 1) {
      if (skip !== undefined && at >= skip.start && at < skip.end) continue
      const byte = bytes[at] ?? 0
      hash = Math.imul(hash ^ byte, 0x01000193) >>> 0
      second = Math.imul(second ^ byte, 0x811c9dc5) >>> 0
    }
    hash = Math.imul(hash ^ 0xff, 0x01000193) >>> 0
  }
  return `${hash.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`
}

export function bakedElement(children: MarkupChildren, shape: MarkupElement): MarkupElement | undefined {
  const root = maskElement(children, shape)
  return root === undefined ? undefined : children[root.index]?.find((each) => each.kind === "adm:baked")
}

export function bakedOf(bytes: Uint8Array, children: MarkupChildren, shape: MarkupElement): Baked | null {
  const baked = bakedElement(children, shape)
  const digest = baked === undefined ? null : paintAttribute(baked, "digest")
  if (baked === undefined || digest === null) return null
  const text = baked.selfClosing ? "" : decodeUtf8(bytes.subarray(baked.openEnd, baked.closeStart))
  return { digest, markup: decodedXmlText(text) }
}

export function runDigest(bytes: Uint8Array, children: MarkupChildren, run: readonly Sibling[]): string {
  const mask = run[0]
  return digestOf(
    bytes,
    run.map((each) => each.element),
    mask === undefined ? undefined : bakedElement(children, mask.element),
  )
}

function child(children: MarkupChildren, element: MarkupElement | undefined, kind: string) {
  return element === undefined ? undefined : children[element.index]?.find((each) => each.kind === kind)
}

function number(element: MarkupElement | undefined, name: string, missing: number): number | null {
  if (element === undefined) return null
  const value = paintAttribute(element, name)
  if (value === null) return missing
  return /^[+-]?\d+$/.test(value) ? Number(value) : null
}

export type Placed = { readonly x: number; readonly y: number; readonly cx: number; readonly cy: number }

export function placedOf(children: MarkupChildren, shape: MarkupElement): (Placed & { turned: boolean }) | null {
  const properties = child(children, shape, "p:spPr")
  const xfrm = child(children, properties, "a:xfrm")
  const off = child(children, xfrm, "a:off")
  const ext = child(children, xfrm, "a:ext")
  const x = number(off, "x", 0)
  const y = number(off, "y", 0)
  const cx = number(ext, "cx", 0)
  const cy = number(ext, "cy", 0)
  if (xfrm === undefined || x === null || y === null || cx === null || cy === null || cx <= 0 || cy <= 0) return null
  const turned =
    (number(xfrm, "rot", 0) ?? 1) !== 0 ||
    ["flipH", "flipV"].some((name) => {
      const value = paintAttribute(xfrm, name)
      return value === "1" || value === "true"
    })
  return { x, y, cx, cy, turned }
}

export function geometryOf(children: MarkupChildren, shape: MarkupElement): MarkupElement | undefined {
  const properties = child(children, shape, "p:spPr")
  return children[properties?.index ?? -1]?.find((each) => each.kind === "a:prstGeom" || each.kind === "a:custGeom")
}

const plainProperties = new Set(["a:xfrm", "a:prstGeom", "a:noFill"])

function plainPicture(children: MarkupChildren, picture: MarkupElement): boolean {
  if (picture.kind !== "p:pic") return false
  const properties = child(children, picture, "p:spPr")
  if (properties === undefined) return false
  for (const each of children[properties.index] ?? []) {
    if (!plainProperties.has(each.kind)) return false
    if (each.kind === "a:prstGeom" && paintAttribute(each, "prst") !== "rect") return false
  }
  const fill = child(children, picture, "p:blipFill")
  const blip = child(children, fill, "a:blip")
  const stretch = child(children, fill, "a:stretch")
  const rect = child(children, stretch, "a:fillRect")
  if (blip === undefined || rect === undefined || child(children, fill, "a:tile") !== undefined) return false
  return ["l", "t", "r", "b"].every((side) => (number(rect, side, 0) ?? 1) === 0)
}

export function nativeLook(children: MarkupChildren, mask: Sibling, masked: readonly Sibling[]): boolean {
  const picture = masked[0]?.element
  if (masked.length !== 1 || picture === undefined || mask.element.kind === "p:grpSp") return false
  const outline = placedOf(children, mask.element)
  const placed = placedOf(children, picture)
  if (outline === null || placed === null || outline.turned || placed.turned) return false
  return geometryOf(children, mask.element) !== undefined && plainPicture(children, picture)
}

export function cropOf(
  children: MarkupChildren,
  picture: MarkupElement,
): Readonly<Record<"l" | "t" | "r" | "b", number>> {
  const rect = child(children, child(children, picture, "p:blipFill"), "a:srcRect")
  const side = (name: string) => (rect === undefined ? 0 : (number(rect, name, 0) ?? 0)) / full
  return { l: side("l"), t: side("t"), r: side("r"), b: side("b") }
}

function runsUnder(bytes: Uint8Array, children: MarkupChildren, parent: MarkupElement): MaskRun[] {
  const siblings = siblingsOf(children, parent)
  const runs: MaskRun[] = []
  siblings.forEach((mask, at) => {
    if (!mask.mask || mask.hidden) return
    let end = at + 1
    while (end < siblings.length && !(siblings[end]!.mask && !siblings[end]!.hidden)) end += 1
    const run = siblings.slice(at, end)
    const masked = run.slice(1).filter((each) => !each.hidden)
    const baked = bakedOf(bytes, children, mask.element)
    const kept = baked !== null && baked.digest === runDigest(bytes, children, run)
    const look: MaskLook = kept
      ? "kept"
      : masked.length === 0
        ? "none"
        : nativeLook(children, mask, masked)
          ? "native"
          : "picture"
    runs.push({ mask: mask.id, masked: masked.map((each) => each.id), run: run.map((each) => each.id), look })
  })
  return runs
}

export function maskRuns(bytes: Uint8Array): readonly MaskRun[] {
  const { elements } = requireMarkup(bytes)
  if (!elements.some((each) => each.kind === "adm:mask")) return []
  const children = markupChildren(elements)
  return elements
    .filter((each) => each.kind === "p:spTree" || each.kind === "p:grpSp")
    .flatMap((parent) => runsUnder(bytes, children, parent))
}
