import { child, type Held } from "./markup-held.js"
import { isShapeTag, shapeTags } from "./shape-tree.js"

export function propertiesOf(held: Held): Held | undefined {
  if (!isShapeTag(held.element.kind)) return undefined
  const properties = shapeTags[held.element.kind].properties
  return properties === null ? undefined : child(held, properties)
}
