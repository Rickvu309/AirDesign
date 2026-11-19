import { outlineOf, readElementId, routed, siteTie, type ElementId, type Place, type Tie } from "@airdesign/document"
import { useCallback, useSyncExternalStore } from "react"
import { boxOf, followed, paintedAt, sameBox } from "./box-gesture.js"
import { paintPlace } from "./connector-drag.js"
import type { CanvasTie } from "./element-paint.js"
import type { PaintBox } from "./paint-box.js"
import type { CanvasElement } from "./record.js"
import { shownBox, type BoxRead } from "./element-view.js"
import type { PaintStore } from "./store.js"

export type Targets = { readonly start: CanvasElement | null; readonly end: CanvasElement | null }

const turn = 60_000

export function placedBox(place: Place): PaintBox {
  const { box } = place
  return {
    x: box.x,
    y: box.y,
    width: box.cx,
    height: box.cy,
    rotation: place.rot / turn,
    flipH: place.flipH,
    flipV: place.flipV,
  }
}

export function liveBox(store: PaintStore, element: CanvasElement, read: BoxRead = shownBox): PaintBox | null {
  if (element.id === null) return element.box
  const own = paintedAt(element.box, read(store, element.id))
  const group = element.group
  return group === undefined ? own : followed(own, group.box, read(store, group.id), group.frame === undefined)
}

function still(file: PaintBox | null, live: PaintBox | null): boolean {
  return file === null || live === null ? file === live : sameBox(boxOf(file), boxOf(live))
}

function tieOf(target: CanvasElement | null, box: PaintBox | null, tie: CanvasTie | null): Tie | null {
  if (target === null || box === null || tie === null) return null
  const outline = outlineOf(target.geometry?.preset ?? null, target.geometry?.adjusts ?? {})
  return outline === null ? null : siteTie(paintPlace(box), outline, tie.site)
}

export function followedConnector(
  connector: CanvasElement,
  targets: Targets,
  live: (element: CanvasElement) => PaintBox | null,
): CanvasElement {
  const { connection, geometry, box } = connector
  if (connection === undefined || geometry === undefined || box === null) return connector
  const start = targets.start === null ? null : live(targets.start)
  const end = targets.end === null ? null : live(targets.end)
  const startStill = targets.start === null || still(targets.start.box, start)
  if (startStill && (targets.end === null || still(targets.end.box, end))) return connector
  const route = routed(
    paintPlace(box),
    geometry.preset,
    geometry.adjusts,
    tieOf(targets.start, start, connection.start),
    tieOf(targets.end, end, connection.end),
  )
  return route === null
    ? connector
    : { ...connector, box: placedBox(route.place), geometry: { ...geometry, adjusts: route.adjust } }
}

function tiedIds(connector: CanvasElement, targets: Targets | undefined): readonly ElementId[] {
  if (connector.connection === undefined || targets === undefined) return []
  return [targets.start, targets.end].flatMap((target) =>
    target?.id === null || target === null ? [] : [target.id, ...(target.group === undefined ? [] : [target.group.id])],
  )
}

export function useFollowed(
  store: PaintStore,
  connector: CanvasElement,
  targets: Targets | undefined,
  read: BoxRead = shownBox,
): CanvasElement {
  const ids = tiedIds(connector, targets)
  const key = ids.join(" ")
  const subscribe = useCallback(
    (listener: () => void) => {
      const stops = key
        .split(" ")
        .flatMap((raw) => readElementId(raw) ?? [])
        .map((id) => store.boxSubscribe(id)(listener))
      return () => {
        for (const stop of stops) stop()
      }
    },
    [store, key],
  )
  const boxes = () => ids.map((id) => JSON.stringify(read(store, id))).join(" ")
  useSyncExternalStore(subscribe, boxes, boxes)
  return targets === undefined ? connector : followedConnector(connector, targets, (each) => liveBox(store, each, read))
}

export function targetsOf(elements: readonly CanvasElement[], connector: CanvasElement): Targets | undefined {
  const connection = connector.connection
  if (connection === undefined) return undefined
  const find = (tie: CanvasTie | null) =>
    tie === null ? null : (elements.find((each) => each.id === tie.node) ?? null)
  return { start: find(connection.start), end: find(connection.end) }
}
