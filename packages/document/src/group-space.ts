import type { Box } from "./box.js"
import type { Register } from "./decide.js"
import type { ElementId } from "./element-id.js"
import { frameBackdrop, groupFrame, groupParent } from "./element-group.js"
import { placeOf } from "./group-place.js"

export type GroupSpace = { readonly sx: number; readonly sy: number; readonly dx: number; readonly dy: number }

const slideSpace: GroupSpace = { sx: 1, sy: 1, dx: 0, dy: 0 }

export function groupSpace(register: Register, node: ElementId | null): GroupSpace | null {
  if (node === null) return slideSpace
  const above = groupParent(register, node)
  const outer = above === undefined ? null : groupSpace(register, above)
  if (outer === null || frameBackdrop(register, node) !== null) return outer
  if (above !== null) return null
  const place = placeOf(register, node)
  const frame = groupFrame(register, node)
  if (place === null || frame === null || place.rot !== 0 || place.flipH || place.flipV) return null
  if (frame.cx === 0 || frame.cy === 0) return null
  const sx = place.box.cx / frame.cx
  const sy = place.box.cy / frame.cy
  return {
    sx: outer.sx * sx,
    sy: outer.sy * sy,
    dx: outer.sx * (place.box.x - frame.x * sx) + outer.dx,
    dy: outer.sy * (place.box.y - frame.y * sy) + outer.dy,
  }
}

export function intoSpace(box: Box, space: GroupSpace): Box {
  return {
    x: Math.round((box.x - space.dx) / space.sx),
    y: Math.round((box.y - space.dy) / space.sy),
    cx: Math.round(box.cx / space.sx),
    cy: Math.round(box.cy / space.sy),
  }
}

export function outOfSpace(box: Box, space: GroupSpace): Box {
  return {
    x: Math.round(box.x * space.sx + space.dx),
    y: Math.round(box.y * space.sy + space.dy),
    cx: Math.round(box.cx * space.sx),
    cy: Math.round(box.cy * space.sy),
  }
}

export function fittedBox(place: Box, frame: Box, fitted: Box): Box {
  const sx = frame.cx === 0 ? 1 : place.cx / frame.cx
  const sy = frame.cy === 0 ? 1 : place.cy / frame.cy
  return {
    x: Math.round(place.x + (fitted.x - frame.x) * sx),
    y: Math.round(place.y + (fitted.y - frame.y) * sy),
    cx: Math.round(fitted.cx * sx),
    cy: Math.round(fitted.cy * sy),
  }
}
