import {
  nextSlideId,
  orderKeyAfter,
  presentSlides,
  readSlideId,
  type Geometry,
  type SlideCommand,
  type SlideId,
} from "@airdesign/document"
import { deckLayouts } from "./deck-layouts.js"
import { relsOf, slideAddresses } from "./package-address.js"
import { routeName } from "./route-operations.js"
import { partTouch, routeRuns as structuralRuns, type RouteRun } from "./route-parts.js"
import { applyStructuralRoute } from "./structural-route.js"
import { orderedParts } from "./slide-order-route.js"
import { layoutPart } from "./slide-placeholders.js"
import { nextSlideFile } from "./slide-list-route.js"
import { addedSlideTouch } from "./slide-touch.js"

function addedFromLayouts(parts: ReadonlyMap<string, Uint8Array>): RouteRun | null {
  const addresses = slideAddresses(parts)
  const first = addresses[0]
  if (first === undefined) return null
  const file: SlideId[] = []
  for (const address of addresses) {
    const id = readSlideId(address.slide)
    if (id === undefined) return null
    file.push(id)
  }
  const anchor = file[0]
  if (anchor === undefined) return null
  const used = layoutPart(parts, first.part)
  const layouts = deckLayouts(parts)
  const chosen = [...layouts.filter((layout) => layout.part !== used), ...layouts].slice(0, 2)
  if (chosen.length === 0) return null
  const order: SlideCommand[] = []
  for (const layout of chosen) {
    const key = orderKeyAfter(presentSlides({ file, order }), anchor)
    if (key === null) return null
    order.push({
      slide: "add",
      id: nextSlideId([...file, ...order.flatMap((command) => ("id" in command ? [command.id] : []))]),
      after: anchor,
      key,
      layout: anchor,
      layoutPart: layout.part,
    })
  }
  try {
    const written = orderedParts(parts, { file, order })
    const number = nextSlideFile(parts)
    const touch = addedSlideTouch(parts)
    const second = `ppt/slides/slide${number + 1}.xml`
    const added = chosen.length === 2 ? [...touch.added, second, relsOf(second)] : touch.added
    return {
      operation: "sldIdLst.add",
      route: routeName["sldIdLst.add"],
      edit: null,
      touch: { ...touch, added },
      parts: written,
      error: null,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      operation: "sldIdLst.add",
      route: routeName["sldIdLst.add"],
      edit: null,
      touch: null,
      parts: null,
      error: message,
    }
  }
}

const drawnGeometries: readonly Geometry[] = [
  "rect",
  "ellipse",
  "line",
  "straightConnector1",
  "diamond",
  "triangle",
  "star5",
  "plus",
  "leftArrow",
  "rightArrow",
  "wedgeRectCallout",
]

const drawnBox = { x: 914400, y: 914400, cx: 1828800, cy: 914400 }

export function drawnRuns(parts: ReadonlyMap<string, Uint8Array>): readonly RouteRun[] {
  const slide = slideAddresses(parts)[0]?.part
  if (slide === undefined) return []
  return drawnGeometries.map((geometry) => {
    const edit = { name: "spTree.add", part: slide, text: "", geometry, ...drawnBox } as const
    const route = routeName["spTree.add"]
    try {
      return {
        operation: "spTree.add",
        route,
        edit,
        touch: partTouch(parts, edit),
        parts: applyStructuralRoute(parts, edit),
        error: null,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { operation: "spTree.add", route, edit, touch: null, parts: null, error: message }
    }
  })
}

export function routeRuns(parts: ReadonlyMap<string, Uint8Array>): readonly RouteRun[] {
  const layout = addedFromLayouts(parts)
  const runs = [...structuralRuns(parts), ...drawnRuns(parts)]
  return layout === null ? runs : [...runs, layout]
}
