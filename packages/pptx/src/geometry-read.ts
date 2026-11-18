import { adjustLimit, presetAdjusts, presets, type FieldValue } from "@airdesign/document"
import { child, inside, type Held } from "./markup-held.js"
import { linkedPart } from "./notes-part.js"
import { paintAttribute } from "./paint-color.js"
import { ownersOf, propertiesOf, sheetOf } from "./trait-read.js"

export type Geometry = FieldValue<"geometry", "shape">

export type ShownGeometry = { readonly value: Geometry | null; readonly own: boolean; readonly open?: true }

export type GeometryAt = { readonly part: string; readonly shape: string }

const guide = /^val [+-]?\d+$/

function geometryIn(properties: Held | undefined): Held | undefined {
  return child(properties, "a:prstGeom") ?? child(properties, "a:custGeom")
}

export function geometryOf(held: Held): Geometry | null {
  if (held.element.kind !== "a:prstGeom") return null
  const preset = presets.find((each) => each === paintAttribute(held.element, "prst"))
  if (preset === undefined) return null
  const named: readonly string[] = presetAdjusts[preset]
  const list = child(held, "a:avLst")
  const adjust: Record<string, number> = {}
  for (const element of list === undefined ? [] : inside(list)) {
    const name = paintAttribute(element, "name")
    const formula = paintAttribute(element, "fmla")
    if (element.kind !== "a:gd" || name === null || formula === null || !guide.test(formula)) return null
    const value = Number(formula.slice(4))
    if (!named.includes(name) || !Number.isSafeInteger(value) || Object.hasOwn(adjust, name)) return null
    adjust[name] = value
  }
  return Object.keys(adjust).length > adjustLimit ? null : { preset, adjust }
}

function subpathOpen(commands: readonly { readonly kind: string }[]): boolean {
  let drawing = false
  let open = false
  for (const command of commands) {
    if (command.kind === "a:close") {
      open = false
      continue
    }
    if (command.kind === "a:moveTo" && drawing && open) return true
    drawing = true
    open = true
  }
  return drawing && open
}

function geometryOpen(held: Held): boolean {
  if (held.element.kind !== "a:custGeom") return false
  const list = child(held, "a:pathLst")
  if (list === undefined) return false
  return inside(list).some((element) => {
    if (element.kind !== "a:path") return false
    const stroke = paintAttribute(element, "stroke")
    if (stroke === "0" || stroke === "false") return false
    return subpathOpen(inside({ ...held, element }))
  })
}

export function shownGeometry(parts: ReadonlyMap<string, Uint8Array>, at: GeometryAt): ShownGeometry | null {
  const sheet = sheetOf(parts, at.part)
  const item = sheet?.drawn.find((each) => each.shape === at.shape)
  if (sheet === null || item === undefined) return null
  const layout = sheetOf(parts, linkedPart(parts, at.part, "slideLayout"))
  const master = layout === null ? null : sheetOf(parts, linkedPart(parts, layout.part, "slideMaster"))
  const owners = ownersOf(item, { sheet, layout, master, theme: null })
  const found = owners.findIndex((owner) => geometryIn(propertiesOf(owner)) !== undefined)
  const owner = owners[found]
  const held = owner === undefined ? undefined : geometryIn(propertiesOf(owner))
  if (held === undefined) return { value: null, own: false }
  const shown = { value: geometryOf(held), own: found === 0 }
  return geometryOpen(held) ? { ...shown, open: true } : shown
}
