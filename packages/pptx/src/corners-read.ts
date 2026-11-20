import type { DesignKey, Read } from "@airdesign/document"
import { child, whole, type Held } from "./markup-held.js"
import { geometryOf } from "./preset-geometry-read.js"
import { propertiesOf } from "./shape-properties.js"
import { isShapeTag, shapeTags } from "./shape-tree.js"

const defaultRounding = 16_667

export function cornersReads(owners: readonly Held[], reads: Partial<Record<DesignKey, Read<unknown>>>) {
  if (reads.geometry?.value !== "roundRect") return
  const properties = owners.flatMap((owner) => {
    const found = propertiesOf(owner)
    return found === undefined ? [] : [found]
  })
  const held = properties.map((each) => child(each, "a:prstGeom")).find((each) => each !== undefined)
  const extent = owners
    .flatMap((owner) => {
      if (!isShapeTag(owner.element.kind)) return []
      const found = child(propertiesOf(owner) ?? owner, shapeTags[owner.element.kind].transform)
      return found === undefined ? [] : [child(found, "a:ext")?.element]
    })
    .find((each) => each !== undefined)
  const geometry = held === undefined ? null : geometryOf(held)
  const [cx, cy] = extent === undefined ? [] : [whole(extent, "cx"), whole(extent, "cy")]
  if (geometry === null || cx === undefined || cy === undefined) return
  const radius = Math.round(((geometry.adjust.adj ?? defaultRounding) * Math.min(cx, cy)) / 100_000)
  const source = reads.geometry.source
  reads["geometry.corners"] = source === undefined ? { value: radius } : { value: radius, source }
}
