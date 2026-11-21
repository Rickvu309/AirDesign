import { outlineOf, routed, siteTie, type Place, type Tie } from "@airdesign/document"
import type { MarkupElement } from "./element-span.js"
import { inheritedSlot } from "./inherited-slot.js"
import { decodeUtf8, sameBytes } from "./package-bytes.js"
import { requireMarkup } from "./part-markup.js"
import { readSlides } from "./read-shapes.js"
import { isShapeTag, shapeTags } from "./shape-tree.js"
import { SlideEditor } from "./slide-editor.js"
import { markupChildren, type MarkupChildren } from "./text-value-route.js"
import { endOf, type End } from "./trait-xml-connection.js"
import { presetMarkup, writtenMarkup } from "./trait-xml-geometry.js"
import { writeTrait } from "./trait-xml.js"
import type { ElementAt, Parts } from "./xml-codec.js"

type Drawn = {
  readonly kind: string
  readonly place: Place | null
  readonly preset: string | null
  readonly adjust: Readonly<Record<string, number>>
  readonly parent: string
  readonly start: End
  readonly end: End
}

const guide = /^val (-?\d+)$/

function attributeOf(element: MarkupElement | undefined, name: string): string | null {
  return element?.attributes.find((each) => each.name === name)?.value ?? null
}

function numberOf(element: MarkupElement | undefined, name: string): number | null {
  const text = attributeOf(element, name)
  const value = text === null ? NaN : Number(text)
  return Number.isSafeInteger(value) ? value : null
}

function flagOf(element: MarkupElement, name: string): boolean {
  const text = attributeOf(element, name)
  return text === "1" || text === "true"
}

function childOf(
  children: MarkupChildren,
  element: MarkupElement | undefined,
  kind: string,
): MarkupElement | undefined {
  return element === undefined ? undefined : children[element.index]?.find((each) => each.kind === kind)
}

function placeIn(children: MarkupChildren, transform: MarkupElement | undefined): Place | null {
  const offset = childOf(children, transform, "a:off")
  const extent = childOf(children, transform, "a:ext")
  const [x, y, cx, cy] = [numberOf(offset, "x"), numberOf(offset, "y"), numberOf(extent, "cx"), numberOf(extent, "cy")]
  if (transform === undefined || x === null || y === null || cx === null || cy === null) return null
  return {
    box: { x, y, cx, cy },
    rot: numberOf(transform, "rot") ?? 0,
    flipH: flagOf(transform, "flipH"),
    flipV: flagOf(transform, "flipV"),
  }
}

function inheritedPlace(parts: Parts, at: ElementAt): Place | null {
  const slot = inheritedSlot(parts, at, "transform")
  if (slot === null) return null
  const { elements } = requireMarkup(slot)
  return placeIn(markupChildren(elements), elements[0])
}

function parentOf(elements: readonly MarkupElement[], children: MarkupChildren, shape: MarkupElement): string {
  for (let above = elements[shape.parent]; above !== undefined; above = elements[above.parent]) {
    if (above.kind !== "p:grpSp") continue
    const visual = childOf(children, above, "p:nvGrpSpPr")
    return attributeOf(childOf(children, visual, "p:cNvPr"), "id") ?? ""
  }
  return ""
}

function drawnOn(parts: Parts, slide: string, part: string, bytes: Uint8Array): ReadonlyMap<string, Drawn> {
  const { elements } = requireMarkup(bytes)
  const children = markupChildren(elements)
  const drawn = new Map<string, Drawn>()
  for (const shape of elements) {
    if (!isShapeTag(shape.kind)) continue
    const tags = shapeTags[shape.kind]
    const visual = childOf(children, shape, tags.nonVisual)
    const id = attributeOf(childOf(children, visual, "p:cNvPr"), "id")
    if (id === null || drawn.has(id)) continue
    const host = tags.properties === null ? shape : childOf(children, shape, tags.properties)
    const own = placeIn(children, childOf(children, host, tags.transform))
    const geometry = childOf(children, host, "a:prstGeom")
    const adjust: Record<string, number> = {}
    for (const each of children[childOf(children, geometry, "a:avLst")?.index ?? -1] ?? []) {
      const found = guide.exec(attributeOf(each, "fmla") ?? "")
      const name = attributeOf(each, "name")
      if (found?.[1] !== undefined && name !== null) adjust[name] = Number(found[1])
    }
    const preset = childOf(children, host, "a:custGeom") !== undefined ? "custom" : attributeOf(geometry, "prst")
    const holder = childOf(children, childOf(children, shape, "p:nvCxnSpPr"), "p:cNvCxnSpPr")
    drawn.set(id, {
      kind: shape.kind,
      place: own ?? inheritedPlace(parts, { slide, part, shape: id }),
      preset,
      adjust,
      parent: parentOf(elements, children, shape),
      start: endOf(slide, childOf(children, holder, "a:stCxn")),
      end: endOf(slide, childOf(children, holder, "a:endCxn")),
    })
  }
  return drawn
}

const targets: readonly string[] = ["p:sp", "p:pic"]

function idOf(end: End): string | null {
  return "none" in end ? null : (end.shape.node.split(".")[1] ?? null)
}

function siteOf(drawn: ReadonlyMap<string, Drawn>, connector: Drawn, end: End): Tie | null {
  const id = idOf(end)
  const target = id === null ? undefined : drawn.get(id)
  if (target === undefined || "none" in end || target.place === null) return null
  if (!targets.includes(target.kind) || target.parent !== connector.parent) return null
  const outline = outlineOf(target.preset, target.adjust)
  return outline === null ? null : siteTie(target.place, outline, end.shape.site)
}

const drawnHalf = 50_000

function bent(drawn: Readonly<Record<string, number>>, next: Readonly<Record<string, number>>): boolean {
  return Object.entries(next).some(([name, value]) => (drawn[name] ?? drawnHalf) !== value)
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function moved(
  file: ReadonlyMap<string, Drawn>,
  next: ReadonlyMap<string, Drawn>,
  id: string,
  connector: Drawn,
): boolean {
  if (!same(file.get(id), connector)) return true
  return [connector.start, connector.end].some((end) => {
    const target = idOf(end)
    return target !== null && !same(file.get(target), next.get(target))
  })
}

function routedSlide(file: Parts, parts: Parts, slide: string, part: string, bytes: Uint8Array): Parts {
  const before = file.get(part)
  const now = drawnOn(parts, slide, part, bytes)
  const was = before === undefined ? new Map<string, Drawn>() : drawnOn(file, slide, part, before)
  let editor: SlideEditor | null = null
  for (const [id, connector] of now) {
    if (connector.kind !== "p:cxnSp" || connector.place === null || connector.preset === null) continue
    if ("none" in connector.start && "none" in connector.end) continue
    if (!moved(was, now, id, connector)) continue
    const start = siteOf(now, connector, connector.start)
    const end = siteOf(now, connector, connector.end)
    const route = routed(connector.place, connector.preset, connector.adjust, start, end)
    if (route === null) continue
    const { place, preset, adjust } = route
    const { box } = place
    const at = { slide, part, shape: id }
    editor ??= new SlideEditor(parts)
    editor.editShape(part, id, (scoped) => {
      let next = writeTrait(scoped, at, "box", {
        x: { set: box.x },
        y: { set: box.y },
        w: { set: box.cx },
        h: { set: box.cy },
        rot: { set: place.rot },
        flipH: { set: place.flipH },
        flipV: { set: place.flipV },
      })
      if (preset !== connector.preset || bent(connector.adjust, adjust))
        next = writtenMarkup(next, at, presetMarkup(preset, Object.keys(adjust), adjust))
      return next
    })
  }
  return editor === null ? parts : editor.flush()
}

function binds(bytes: Uint8Array): boolean {
  const text = decodeUtf8(bytes)
  return text.includes("<a:stCxn") || text.includes("<a:endCxn")
}

export function boundTargets(parts: Parts): ReadonlySet<string> {
  const bound = new Set<string>()
  for (const { slide, part } of readSlides(parts)) {
    const bytes = parts.get(part)
    if (bytes === undefined || !binds(bytes)) continue
    for (const drawn of drawnOn(parts, slide, part, bytes).values()) {
      if (drawn.kind !== "p:cxnSp") continue
      for (const end of [drawn.start, drawn.end]) if (!("none" in end)) bound.add(end.shape.node)
    }
  }
  return bound
}

export function routedParts(file: Parts, parts: Parts): Parts {
  let next = parts
  for (const { slide, part } of readSlides(parts)) {
    const bytes = parts.get(part)
    const before = file.get(part)
    if (bytes === undefined || bytes === before || (before !== undefined && sameBytes(bytes, before))) continue
    if (!binds(bytes)) continue
    next = routedSlide(file, next, slide, part, bytes)
  }
  return next
}
