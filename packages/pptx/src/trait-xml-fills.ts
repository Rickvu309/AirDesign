import { namesAlpha, paintSlots, type Alpha, type TraitPatch } from "@airdesign/document"
import { alphaKept, colorsOf, fadedBytes, shownAlpha, type Faded } from "./alpha-codec.js"
import { embedded } from "./blip-edit.js"
import { fillMarkup, imageMarkup, type Drawn, type FillTag } from "./fill-markup.js"
import { shownStack, writtenStack } from "./fill-stack.js"
import { changedPart, hostOf, ownFill, pictureAsShape, writtenFill, type FillHost } from "./fill-host.js"
import { inheritedFill, ownBackground, shownFill, type Fill, type SlotFill } from "./fill-read.js"
import { decodeUtf8 } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { iconOf } from "./picture-read.js"
import { tileScaleXml } from "./picture-tile.js"
import { cropFieldXml } from "./trait-xml-crop.js"
import { blipOverlay, imageAlpha, imageFieldsXml, withoutOverlay, writtenImageAlpha } from "./trait-xml-image.js"
import { markupChildren } from "./text-value-route.js"
import { whole, writeFields, type ElementAt, type Parts, type TraitXml } from "./xml-codec.js"

const none: Fill = { none: true }
const image: Fill = { image: true }
const fadedKinds: readonly string[] = ["a:solidFill", "a:gradFill", "a:pattFill"]

type Wanted = SlotFill | "inherit" | null

type Shown = Fill | "inherit" | null

function pictured(paint: Wanted): boolean {
  return typeof paint === "object" && paint !== null && "image" in paint
}

function shownBehind(parts: Parts, at: ElementAt): Fill | null {
  const behind = shownFill(parts, at)?.value ?? null
  return behind === null || "none" in behind ? null : behind
}

function nativeSlots(parts: Parts, at: ElementAt): readonly (Fill | null)[] {
  const host = hostOf(parts, at)
  if (host === "bg") return [ownBackground(parts, at.part), none, none, none]
  const overlay = blipOverlay(parts, at) ?? none
  if (host === "sp") {
    const fill = shownFill(parts, at)?.value ?? null
    return [fill, none, none, fill !== null && pictured(fill) ? overlay : none]
  }
  const behind = shownBehind(parts, at)
  return behind === null ? [image, none, none, overlay] : [behind, image, none, overlay]
}

export function shownSlots(parts: Parts, at: ElementAt): readonly (SlotFill | null)[] {
  const stack = shownStack(parts, at)
  if (stack === null) return nativeSlots(parts, at)
  return [stack[0] ?? none, stack[1] ?? none, stack[2] ?? none, stack[3] ?? none]
}

function hiddenPaint(paint: Wanted): boolean {
  return typeof paint === "object" && paint !== null && "hidden" in paint
}

function entriesOf(wanted: readonly Wanted[]): readonly SlotFill[] {
  return wanted.map((paint) => (paint === null || paint === "inherit" ? none : paint))
}

function backgroundIcon(parts: Parts, part: string): string | null {
  const { elements } = requireMarkup(partBytes(parts, part))
  const children = markupChildren(elements)
  const inside = (index: number | undefined, kind: string) =>
    index === undefined ? undefined : children[index]?.find((each) => each.kind === kind)
  const root = elements.find((element) => element.parent < 0)
  const fill = inside(
    inside(inside(inside(root?.index, "p:cSld")?.index, "p:bg")?.index, "p:bgPr")?.index,
    "a:blipFill",
  )
  const blip = inside(fill?.index, "a:blip")
  return blip === undefined || embedded(blip) === null ? null : (iconOf(parts, part, children, blip)?.name ?? null)
}

function shownSource(parts: Parts, at: ElementAt): string | null {
  if (hostOf(parts, at) === "bg") return backgroundIcon(parts, at.part)
  return imageFieldsXml.source.at === "whole" ? imageFieldsXml.source.codec.read(parts, at) : null
}

function shownValue(parts: Parts, at: ElementAt): Fill | null {
  return at.shape === "slide" ? ownBackground(parts, at.part) : (shownFill(parts, at)?.value ?? null)
}

function shownBytes(parts: Parts, at: ElementAt): Uint8Array | null {
  const bytes = partBytes(parts, at.part)
  const own = ownFill(bytes, at)
  if (own !== undefined) return bytes.subarray(own.start, own.end)
  return at.shape === "slide" ? null : inheritedFill(parts, at)
}

function colourAlpha(parts: Parts, at: ElementAt): Faded {
  const value = shownValue(parts, at)
  return value === null ? null : shownAlpha(colorsOf(value))
}

export function fillAlpha(parts: Parts, at: ElementAt): Faded {
  return shownSlots(parts, at).some(pictured) ? imageAlpha(parts, at) : colourAlpha(parts, at)
}

function fadedFill(parts: Parts, at: ElementAt, alpha: Alpha): Parts {
  const bytes = partBytes(parts, at.part)
  const own = ownFill(bytes, at)
  if (own !== undefined) {
    if (!fadedKinds.includes(own.kind)) return parts
    const next = fadedBytes(bytes.subarray(own.start, own.end), alpha)
    return changedPart(parts, at.part, bytes, { start: own.start, end: own.end, next })
  }
  const copied = at.shape === "slide" ? null : inheritedFill(parts, at)
  const root = copied === null ? undefined : requireMarkup(copied).elements[0]
  if (copied === null || root === undefined || !fadedKinds.includes(root.kind)) return parts
  return writtenFill(parts, at, { tag: root.kind as FillTag, xml: decodeUtf8(fadedBytes(copied, alpha)) })
}

function writtenAlpha(parts: Parts, at: ElementAt, alpha: Alpha): Parts {
  const slots = shownSlots(parts, at)
  if (!slots.some(pictured)) return fadedFill(parts, at, alpha)
  const faded = writtenImageAlpha(parts, at, alpha)
  return hostOf(parts, at) === "pic" && !pictured(slots[0] ?? null) ? fadedFill(faded, at, alpha) : faded
}

const colourCodec = alphaKept(
  {
    read: shownValue,
    write: (parts: Parts, at: ElementAt, value: Fill) =>
      writtenFill(parts, at, fillMarkup(value as Drawn, shownBytes(parts, at))),
  },
  colourAlpha,
  fadedFill,
  (value) => namesAlpha(colorsOf(value)),
)

type Painted = { readonly parts: Parts; readonly sourced: boolean; readonly stacked?: true }

function onShape(parts: Parts, at: ElementAt, host: FillHost): Parts {
  return host === "pic" ? pictureAsShape(parts, at) : parts
}

function newImage(parts: Parts, at: ElementAt, source: string | undefined): Painted {
  if (source === undefined) throw new Error("fills-image")
  const next = new Map(parts)
  return { parts: writtenFill(next, at, imageMarkup(next, at, source)), sourced: true }
}

function stackedPaints(
  parts: Parts,
  at: ElementAt,
  host: FillHost,
  paints: readonly Fill[],
  shown: readonly (Fill | null)[],
  source: string | undefined,
): Painted {
  if (host === "bg") throw new Error("fills-stack")
  const imaged = paints.some(pictured)
  if (host === "pic" && imaged) return { parts, sourced: false, stacked: true }
  const next = onShape(parts, at, host)
  const [bottom] = paints
  const painted =
    imaged && !shown.some(pictured)
      ? newImage(next, at, source)
      : { parts: imaged || bottom === undefined ? next : colourCodec.write(next, at, bottom), sourced: false }
  return { ...painted, stacked: true }
}

function writtenPaints(
  parts: Parts,
  at: ElementAt,
  wanted: readonly Shown[],
  shown: readonly (Fill | null)[],
  source: string | undefined,
): Painted {
  const host = hostOf(parts, at)
  if (wanted.includes(null)) throw new Error("fills-unread")
  const [bottom, ...above] = wanted
  const paints = wanted.flatMap((paint) => (paint === null || paint === "inherit" || "none" in paint ? [] : [paint]))
  if (bottom === "inherit") {
    if (above.some((paint) => paint !== "inherit" && paint !== null && !("none" in paint)))
      throw new Error("fills-stack")
    return { parts: writtenFill(onShape(parts, at, host), at, null), sourced: false }
  }
  const [first, second, ...rest] = paints
  if (first === undefined)
    return { parts: writtenFill(onShape(parts, at, host), at, fillMarkup(none as Drawn)), sourced: false }
  if (second === undefined && !pictured(first))
    return { parts: colourCodec.write(onShape(parts, at, host), at, first), sourced: false }
  if (second === undefined && host === "pic") return { parts: writtenFill(parts, at, null), sourced: false }
  if (second === undefined)
    return shown.some(pictured) && source === undefined ? { parts, sourced: false } : newImage(parts, at, source)
  if (rest.length === 0 && host === "pic" && pictured(second) && !pictured(first))
    return { parts: writtenFill(parts, at, fillMarkup(first as Drawn, shownBytes(parts, at))), sourced: false }
  return stackedPaints(parts, at, host, paints, shown, source)
}

const settingsXml = {
  slot: null,
  fields: {
    crop: cropFieldXml,
    mode: imageFieldsXml.mode,
    tileScale: tileScaleXml,
    source: imageFieldsXml.source,
    weight: imageFieldsXml.weight,
    alpha: whole({
      read: (parts, at) => {
        const shown = fillAlpha(parts, at)
        return shown === "mixed" ? null : shown
      },
      write: writtenAlpha,
    }),
    recolor: imageFieldsXml.recolor,
    blur: imageFieldsXml.blur,
  },
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function writtenFills(parts: Parts, at: ElementAt, patch: TraitPatch<"fills">): Parts {
  const shown = shownSlots(parts, at)
  const wanted = paintSlots.map((slot, at): Wanted => {
    const edit = patch[slot]
    if (edit === undefined || edit === "opening") return shown[at] ?? null
    return edit === "inherit" ? "inherit" : edit.set
  })
  const source = typeof patch.source === "object" ? patch.source.set : undefined
  const moved = wanted.some((paint, slot) => !same(paint, shown[slot] ?? null))
  const background = hostOf(parts, at) === "bg" && source !== undefined && source !== shownSource(parts, at)
  const base = moved ? withoutOverlay(parts, at) : parts
  const native = nativeSlots(base, at)
  const visible = wanted.map((paint): Shown =>
    paint === null || paint === "inherit" || !("hidden" in paint) ? paint : none,
  )
  const repainted = visible.some((paint, slot) => !same(paint, native[slot] ?? null))
  const written =
    repainted || background
      ? writtenPaints(base, at, visible, native, source)
      : moved
        ? { parts: base, sourced: false }
        : null
  const listed = written?.stacked === true || wanted.some(hiddenPaint) ? entriesOf(wanted) : null
  const painted =
    written === null
      ? { parts, sourced: false }
      : { ...written, parts: writtenStack(written.parts, at, listed, written.stacked === true) }
  const { p0: _p0, p1: _p1, p2: _p2, p3: _p3, source: _source, ...rest } = patch
  const imaged = wanted.some(pictured)
  const kept = imaged ? rest : { ...(rest.alpha === undefined ? {} : { alpha: rest.alpha }) }
  const settings = painted.sourced || patch.source === undefined || !imaged ? kept : { ...kept, source: patch.source }
  return writeFields(painted.parts, at, settingsXml as unknown as TraitXml<"fills">, settings as TraitPatch<"fills">)
}

function slotXml(slot: (typeof paintSlots)[number]) {
  return whole<SlotFill>(
    {
      read: (parts, at) => shownSlots(parts, at)[paintSlots.indexOf(slot)] ?? null,
      write: (parts, at, value) => writtenFills(parts, at, { [slot]: { set: value } }),
    },
    slot === "p0" ? (parts, at) => writtenFills(parts, at, { p0: "inherit" }) : null,
  )
}

export const fillsXml: TraitXml<"fills"> = {
  slot: null,
  fields: {
    p0: slotXml("p0"),
    p1: slotXml("p1"),
    p2: slotXml("p2"),
    p3: slotXml("p3"),
    source: whole({
      read: shownSource,
      write: (parts, at, value) => writtenFills(parts, at, { source: { set: value } }),
    }),
    weight: settingsXml.fields.weight,
    mode: settingsXml.fields.mode,
    tileScale: settingsXml.fields.tileScale,
    crop: settingsXml.fields.crop,
    recolor: settingsXml.fields.recolor,
    blur: settingsXml.fields.blur,
    alpha: settingsXml.fields.alpha,
  },
}
