import type { FieldValue } from "@airdesign/document"
import { child, inside, type Held } from "./markup-held.js"
import { linkedPart } from "./notes-part.js"
import { paintAttribute } from "./paint-color.js"
import { drawnShape } from "./paint-sheet.js"
import { ownersOf, propertiesOf, sheetOf } from "./trait-read.js"
import { geometryOf } from "./preset-geometry-read.js"

export type Geometry = FieldValue<"geometry", "shape">

export type ShownGeometry = { readonly value: Geometry | null; readonly own: boolean; readonly open?: true }

export type GeometryAt = { readonly part: string; readonly shape: string }

function geometryIn(properties: Held | undefined): Held | undefined {
  return child(properties, "a:prstGeom") ?? child(properties, "a:custGeom")
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
  const item = drawnShape(parts, at.part, at.shape)
  if (item === null) return null
  const layout = item.placeholder === null ? null : sheetOf(parts, linkedPart(parts, at.part, "slideLayout"))
  const master = layout === null ? null : sheetOf(parts, linkedPart(parts, layout.part, "slideMaster"))
  const owners = ownersOf(item, { sheet: item, layout, master })
  const found = owners.findIndex((owner) => geometryIn(propertiesOf(owner)) !== undefined)
  const owner = owners[found]
  const held = owner === undefined ? undefined : geometryIn(propertiesOf(owner))
  if (held === undefined) return { value: null, own: false }
  const shown = { value: geometryOf(held), own: found === 0 }
  return geometryOpen(held) ? { ...shown, open: true } : shown
}
