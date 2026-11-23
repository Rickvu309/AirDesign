import { designBytes, designOrder } from "./design.js"
import { bytesOf } from "@airdesign/doom"
import { onlyKeys, record } from "./plain-object.js"

export const fillsFormat = 57

export const imageFormat = 63

type Loose = Record<string, unknown>

const slots = ["p0", "p1", "p2", "p3"]

const imageFields = ["source", "mode", "recolor", "blur", "overlay", "alpha"]

function paintEdit(edit: unknown): unknown {
  const picture = record(record(edit)?.set)?.picture
  return picture === undefined ? edit : { set: { image: picture } }
}

function fillsFields(raw: unknown): Loose | null {
  const fields = record(raw)
  if (fields === null) return null
  const fills: Loose = {}
  for (const [field, edit] of Object.entries(fields)) {
    if (field === "value") fills.p0 = paintEdit(edit)
    else if (field === "alpha") fills.alpha = edit
    else return null
  }
  return fills
}

function renamedTraits(patch: Loose, from: readonly string[], fields: Loose): Loose {
  const moved = (trait: string) => from.includes(trait) || trait === "fills"
  const at = Object.keys(patch).findIndex(moved)
  const kept = Object.entries(patch).filter(([trait]) => !moved(trait))
  return Object.fromEntries([...kept.slice(0, at), ["fills", fields], ...kept.slice(at)])
}

function fillsPatch(raw: unknown): unknown {
  const patch = record(raw)
  if (patch === null || !Object.hasOwn(patch, "fill")) return raw
  const fills = fillsFields(patch.fill)
  if (fills === null || Object.hasOwn(patch, "fills")) return null
  return renamedTraits(patch, ["fill"], fills)
}

function slotImages(fields: Loose): Loose | null {
  const split: Loose = { ...fields }
  for (const slot of slots) {
    const image = record(record(fields[slot])?.set)?.image
    if (typeof image !== "string") continue
    if (Object.hasOwn(split, "source")) return null
    split[slot] = { set: { image: true } }
    split.source = { set: image }
  }
  return split
}

function imagePatch(raw: unknown): unknown {
  const patch = record(raw)
  if (patch === null) return raw
  const image = record(patch.image)
  const crop = record(patch.crop)
  const fills = record(patch.fills)
  const split = fills === null ? {} : slotImages(fills)
  if (split === null) return null
  const pictured = fills !== null && Object.keys(split).some((field) => split[field] !== fills[field])
  if (image === null && crop === null && !pictured) return raw
  if (
    image !== null &&
    !onlyKeys(
      image,
      imageFields.filter((field) => Object.hasOwn(image, field)),
    )
  )
    return null
  if (crop !== null && !onlyKeys(crop, ["rect"])) return null
  const moved: Loose = { ...split }
  const fields: readonly (readonly [string, unknown])[] = [
    ...Object.entries(image ?? {}),
    ...(crop === null ? [] : [["crop", crop.rect] as const]),
  ]
  for (const [field, edit] of fields) {
    if (Object.hasOwn(moved, field)) return null
    moved[field] = edit
  }
  return renamedTraits(patch, ["image", "crop"], moved)
}

export function stamped(raw: Loose, patch: unknown, format: number): unknown {
  if (patch === null) return null
  return patch === raw.patch ? raw : { ...raw, v: format, patch }
}

export function fillsRow(raw: Loose): unknown {
  return stamped(raw, fillsPatch(raw.patch), fillsFormat)
}

export function imageRow(raw: Loose): unknown {
  return stamped(raw, imagePatch(raw.patch), imageFormat)
}

export type Renames = Readonly<Record<string, string>>

const fillsKeys: Renames = { fill: "fills" }

const imageKeys: Renames = { "image.source": "fills.source", "image.recolor": "fills.recolor", crop: "fills.crop" }

function shownPaint(shown: unknown): unknown {
  return Array.isArray(shown) && shown[0] === "picture" ? ["image", ...shown.slice(1)] : shown
}

function renamedDesign(raw: unknown, renames: Renames): unknown {
  const design = record(raw)
  if (design === null || !Object.keys(design).some((key) => Object.hasOwn(renames, key))) return raw
  const renamed = Object.fromEntries(
    Object.entries(design).map(([key, shown]) =>
      Object.hasOwn(renames, key) ? [renames[key], key === "fill" ? shownPaint(shown) : shown] : [key, shown],
    ),
  )
  if (bytesOf(JSON.stringify(renamed)) <= designBytes) return renamed
  const fitted: Loose = {}
  for (const key of designOrder) {
    if (!Object.hasOwn(renamed, key)) continue
    if (bytesOf(JSON.stringify({ ...fitted, [key]: renamed[key] })) > designBytes) break
    fitted[key] = renamed[key]
  }
  return fitted
}

function renamedKept(raw: unknown, renames: Renames): unknown {
  const named = (key: unknown): key is string => typeof key === "string" && Object.hasOwn(renames, key)
  if (!Array.isArray(raw) || !raw.some(named)) return raw
  return raw.map((key) => (named(key) ? renames[key] : key))
}

export type Stage = {
  readonly keys: Renames
  readonly patch: (raw: unknown) => unknown
  readonly kind: (raw: unknown) => unknown
  readonly opening: (opening: unknown, kind: unknown) => unknown
}

const fillsStage: Stage = { keys: fillsKeys, patch: fillsPatch, kind: (kind) => kind, opening: (opening) => opening }

function pictureOpening(opening: unknown, kind: unknown): unknown {
  const held = record(opening)
  const fills = record(held?.fills)
  if (kind !== "picture" || fills === null || Object.hasOwn(fills, "p0")) return opening
  return { ...held, fills: { p0: { set: { image: true } }, ...fills } }
}

const imageStage: Stage = {
  keys: imageKeys,
  patch: imagePatch,
  kind: (kind) => (kind === "picture" ? "shape" : kind),
  opening: pictureOpening,
}

export function stagedElement(raw: unknown, stage: Stage): unknown {
  const element = record(raw)
  if (element === null) return raw
  const kind = stage.kind(element.kind)
  const design = renamedDesign(element.design, stage.keys)
  const kept = renamedKept(element.kept, stage.keys)
  const patched = stage.patch(element.opening)
  if (patched === null) return null
  const opening = stage.opening(patched, element.kind)
  if (kind === element.kind && design === element.design && kept === element.kept && opening === element.opening)
    return raw
  return {
    ...element,
    kind,
    ...(design === undefined ? {} : { design }),
    ...(kept === undefined ? {} : { kept }),
    ...(opening === undefined ? {} : { opening }),
  }
}

export function fillsElement(raw: unknown): unknown {
  const filled = stagedElement(raw, fillsStage)
  return filled === null ? null : stagedElement(filled, imageStage)
}

function stagedList(raw: unknown, each: (item: unknown) => unknown): unknown {
  if (!Array.isArray(raw)) return raw
  const items = raw.map(each)
  if (items.includes(null)) return null
  return items.every((item, at) => item === raw[at]) ? raw : items
}

function stagedSlide(raw: unknown, stage: Stage): unknown {
  const slide = record(raw)
  if (slide === null || slide.layout === undefined) return raw
  const layout = stagedList(slide.layout, (element) => stagedElement(element, stage))
  if (layout === null) return null
  return layout === slide.layout ? raw : { ...slide, layout }
}

export function stagedIndex(raw: Loose, stage: Stage): Loose | null {
  const elements = stagedList(raw.elements, (element) => stagedElement(element, stage))
  const slides = stagedList(raw.slides, (slide) => stagedSlide(slide, stage))
  const held = record(raw.next)
  const next = held === null ? raw.next : stagedIndex(held, stage)
  if (elements === null || slides === null || next === null) return null
  if (elements === raw.elements && slides === raw.slides && next === raw.next) return raw
  return { ...raw, elements, slides, ...(raw.next === undefined ? {} : { next }) }
}

export function fillsIndex(raw: Loose): Loose | null {
  return stagedIndex(raw, fillsStage)
}

export function imageIndex(raw: Loose): Loose | null {
  return stagedIndex(raw, imageStage)
}

export function fillsRegister(raw: Loose): unknown {
  const index = record(raw.index)
  if (index === null) return raw
  const filled = fillsIndex(index)
  const converted = filled === null ? null : imageIndex(filled)
  return converted === null ? null : { ...raw, index: converted }
}

export function holdsFills(raw: unknown): boolean {
  const element = record(raw)
  const named = (key: unknown) => key === "fills" || (typeof key === "string" && key.startsWith("fills."))
  return (
    Object.keys(record(element?.design) ?? {}).some(named) ||
    (Array.isArray(element?.kept) && element.kept.some(named)) ||
    record(element?.opening)?.fills !== undefined ||
    (element?.kind === "shape" && element.value === null)
  )
}

type Holds = (raw: unknown) => boolean

function slideHolds(raw: unknown, holds: Holds): boolean {
  const slide = record(raw)
  return Array.isArray(slide?.layout) && slide.layout.some(holds)
}

export function indexHolds(raw: unknown, holds: Holds): boolean {
  const index = record(raw)
  if (index === null) return false
  return (
    (Array.isArray(index.elements) && index.elements.some(holds)) ||
    (Array.isArray(index.slides) && index.slides.some((slide) => slideHolds(slide, holds))) ||
    indexHolds(index.next, holds)
  )
}

function floorHolds(raw: unknown, holds: Holds): boolean {
  return Array.isArray(raw) && raw.some(holds)
}

export function commandHolds(raw: unknown, holds: Holds): boolean {
  const command = record(raw)
  return (
    holds(command?.element) ||
    floorHolds(command?.floor, holds) ||
    (Array.isArray(command?.copies) && command.copies.some((copy) => floorHolds(record(copy)?.floor, holds)))
  )
}
