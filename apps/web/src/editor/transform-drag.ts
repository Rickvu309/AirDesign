import * as doom from "@airdesign/doom"
import {
  guidesAt,
  lineAt,
  nearestLine,
  reachOf,
  type Bounds,
  type Guide,
  type Line,
  type SnapTargets,
} from "./snapping"
import {
  normalizeDegrees,
  resizeBox,
  resizeSelection,
  rotatedAngle,
  type ResizeGrip,
  type RotateGrip,
  type TransformGrip,
} from "./transform-math"
import { croppedPaint } from "./crop-drag"
import { isGroup, scaledChildren } from "./group-scale"
import { memberOf, type Member } from "./selection-frame"
import { apply, invert, type Placed, type Point, type SlideGeometry } from "./slide-geometry"

type Tilted = { readonly center: Point; readonly w: number; readonly h: number; readonly rotation: number }

export type TransformInput = {
  readonly view: doom.Doom
  readonly geometry: SlideGeometry
  readonly ids: readonly doom.NodeId[]
  readonly grip: TransformGrip
  readonly origin: Point
  readonly at: Point
  readonly keepRatio: boolean
  readonly breakAspect?: boolean
  readonly fromCenter: boolean
  readonly snapAngle: boolean
  readonly snap: boolean
  readonly scale: number
  readonly size: { readonly w: number; readonly h: number }
}

export type Transformed = {
  readonly writes: readonly doom.Write[]
  readonly guides: readonly Guide[]
  readonly label: string | null
}

const nothing: Transformed = { writes: [], guides: [], label: null }

export const isRotateGrip = (grip: TransformGrip): grip is RotateGrip => grip.startsWith("rotate-")

export function transformable(view: doom.Doom, id: doom.NodeId): boolean {
  const node = view.nodes.get(id)
  if (node === undefined || (node.type !== "frame" && node.type !== "shape")) return false
  return !doom.lockedIn(view, id) && doom.propOf(node, "geometry")?.kind !== "line"
}

function visual(frame: Tilted): Bounds {
  const radians = (frame.rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))
  const across = frame.w * cos + frame.h * sin
  const down = frame.w * sin + frame.h * cos
  return {
    left: frame.center.x - across / 2,
    top: frame.center.y - down / 2,
    right: frame.center.x + across / 2,
    bottom: frame.center.y + down / 2,
  }
}

function boundsAround(frames: readonly Tilted[]): Bounds {
  const each = frames.map(visual)
  return {
    left: Math.min(...each.map((bounds) => bounds.left)),
    top: Math.min(...each.map((bounds) => bounds.top)),
    right: Math.max(...each.map((bounds) => bounds.right)),
    bottom: Math.max(...each.map((bounds) => bounds.bottom)),
  }
}

const startBox = (member: Member) => ({
  x: member.center.x - member.w / 2,
  y: member.center.y - member.h / 2,
  w: member.w,
  h: member.h,
})

type Resized = { readonly frames: ReadonlyMap<doom.NodeId, Tilted>; readonly bounds: Bounds }

function resized(
  members: readonly Member[],
  grip: ResizeGrip,
  dx: number,
  dy: number,
  modifiers: { readonly keepRatio: boolean; readonly fromCenter: boolean },
): Resized {
  const frames = new Map<doom.NodeId, Tilted>()
  const [only] = members
  if (members.length === 1 && only !== undefined) {
    const box = resizeBox(startBox(only), grip, dx, dy, modifiers, only.rotation)
    frames.set(only.id, {
      center: { x: box.x + box.w / 2, y: box.y + box.h / 2 },
      w: box.w,
      h: box.h,
      rotation: only.rotation,
    })
  } else {
    const starts = new Map(members.map((member) => [member.id, { box: startBox(member), rotation: member.rotation }]))
    for (const [id, box] of resizeSelection(starts, grip, dx, dy, modifiers).boxes) {
      const member = members.find((each) => each.id === id)!
      frames.set(id, {
        center: { x: box.x + box.w / 2, y: box.y + box.h / 2 },
        w: box.w,
        h: box.h,
        rotation: member.rotation,
      })
    }
  }
  return { frames, bounds: boundsAround([...frames.values()]) }
}

function targetsFor(input: TransformInput, members: readonly Member[]): SnapTargets {
  const first = input.geometry.byId.get(members[0]!.id)
  const holder = first?.parent == null ? undefined : input.geometry.byId.get(first.parent)
  const siblings = holder === undefined ? input.geometry.roots : holder.children
  const moving = new Set(members.map((member) => member.id))
  return {
    layers: siblings.filter((each) => !moving.has(each.id)).map((each) => each.bounds),
    slide: holder === undefined ? { left: 0, top: 0, right: input.size.w, bottom: input.size.h } : holder.bounds,
  }
}

function gripSigns(grip: ResizeGrip): { readonly sx: number; readonly sy: number } {
  return {
    sx: grip.includes("left") ? -1 : grip.includes("right") ? 1 : 0,
    sy: grip.includes("top") ? -1 : grip.includes("bottom") ? 1 : 0,
  }
}

function keepsRatio(input: TransformInput, members: readonly Member[]): boolean {
  const [only] = members
  const cropped = members.length === 1 && only !== undefined && croppedPaint(input.view, only.id)?.crop !== undefined
  return cropped ? input.breakAspect !== true : input.keepRatio
}

function snappedResize(input: TransformInput, members: readonly Member[], grip: ResizeGrip, by: Point) {
  const modifiers = { keepRatio: keepsRatio(input, members), fromCenter: input.fromCenter }
  const base = resized(members, grip, by.x, by.y, modifiers)
  const upright = members.every((member) => normalizeDegrees(member.rotation) === 0)
  if (!input.snap || modifiers.keepRatio || !upright) return { ...base, guides: [] as readonly Guide[] }
  const { sx, sy } = gripSigns(grip)
  const targets = targetsFor(input, members)
  const reach = reachOf(input.size.w * input.scale, input.size.w)
  const watching = (sign: number): readonly Line[] =>
    sign === 0 ? [] : input.fromCenter ? ["start", "end"] : sign < 0 ? ["start"] : ["end"]
  let next = by
  const held: { x: Line[]; y: Line[] } = { x: [], y: [] }
  for (const axis of ["x", "y"] as const) {
    const lines = watching(axis === "x" ? sx : sy)
    const found = nearestLine(base.bounds, targets, axis, lines, reach)
    if (found === null) continue
    const probe = resized(members, grip, by.x + (axis === "x" ? 1 : 0), by.y + (axis === "y" ? 1 : 0), modifiers)
    const slope = lineAt(probe.bounds, axis, found.line) - lineAt(base.bounds, axis, found.line)
    if (slope === 0) continue
    next = { ...next, [axis]: next[axis] + found.offset / slope }
    held[axis].push(found.line)
  }
  const final = resized(members, grip, next.x, next.y, modifiers)
  return { ...final, guides: guidesAt(final.bounds, targets, { x: held.x, y: held.y, spacing: false }) }
}

function textResize(
  text: doom.Text,
  grip: TransformGrip,
  widthChanged: boolean,
  heightChanged: boolean,
): doom.Text["resize"] {
  if (text.resize === "fixed" || text.resize === "truncate") return text.resize
  const sideways = grip === "left" || grip === "right"
  if (sideways && widthChanged && !heightChanged) return "height"
  return heightChanged || widthChanged ? "fixed" : text.resize
}

function placedWrites(input: TransformInput, member: Member, next: Tilted): readonly doom.Write[] {
  const { view, geometry, grip } = input
  const placed = geometry.byId.get(member.id) as Placed
  const node = view.nodes.get(member.id)!
  const parent = placed.parent === null ? undefined : geometry.byId.get(placed.parent)
  const local = parent === undefined ? next.center : apply(invert(parent.content), next.center)
  const w = Math.max(1, Math.round(next.w))
  const h = Math.max(1, Math.round(next.h))
  const stored = doom.propOf(node, "box") ?? doom.unfittedBox(placed.node.box)
  const rotation = doom.wrapRotation(next.rotation - (parent?.rotation ?? 0))
  const fit = placed.node.box.fit
  const across = w / (member.w || 1)
  const down = h / (member.h || 1)
  const scalePoint = ({ x, y }: Point) => ({ x: x * across, y: y * down })
  const shift = doom.fitShift(
    { w, h, rotation },
    fit === undefined ? undefined : { origin: scalePoint(fit.origin), pivot: scalePoint(fit.pivot) },
  )
  const box = {
    ...stored,
    x: Math.round(local.x - w / 2 - shift.x),
    y: Math.round(local.y - h / 2 - shift.y),
    w,
    h,
    rotation,
  }
  const widthChanged = w !== Math.round(member.w)
  const heightChanged = h !== Math.round(member.h)
  const writes: doom.Write[] = [{ node: member.id, prop: "box", value: box }]
  if (isGroup(view, member.id)) {
    if (widthChanged || heightChanged) writes.push(...scaledChildren(view, geometry, member.id, across, down))
    return writes
  }
  const sizing = doom.propOf(node, "sizing") ?? { w: "fixed" as const, h: "fixed" as const }
  const fixed = {
    w: widthChanged ? "fixed" : sizing.w,
    h: heightChanged ? "fixed" : sizing.h,
  } as const
  if (fixed.w !== sizing.w || fixed.h !== sizing.h) writes.push({ node: member.id, prop: "sizing", value: fixed })
  const text = node.type === "shape" ? doom.propOf(node, "text") : undefined
  if (text !== undefined) {
    const resize = textResize(text, grip, widthChanged, heightChanged)
    if (resize !== text.resize) writes.push({ node: member.id, prop: "text", value: { ...text, resize } })
  }
  return writes
}

function rotated(
  members: readonly Member[],
  input: TransformInput,
): { readonly frames: ReadonlyMap<doom.NodeId, Tilted>; readonly shown: number } {
  const frames = new Map<doom.NodeId, Tilted>()
  const [only] = members
  if (members.length === 1 && only !== undefined) {
    const rotation = rotatedAngle(only.center, input.origin, input.at, only.rotation, input.snapAngle)
    frames.set(only.id, { center: only.center, w: only.w, h: only.h, rotation })
    return { frames, shown: rotation }
  }
  const around = boundsAround(
    members.map((member) => ({ center: member.center, w: member.w, h: member.h, rotation: member.rotation })),
  )
  const middle = { x: (around.left + around.right) / 2, y: (around.top + around.bottom) / 2 }
  const turn = rotatedAngle(middle, input.origin, input.at, 0, input.snapAngle)
  const radians = (turn * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  for (const member of members) {
    const rel = { x: member.center.x - middle.x, y: member.center.y - middle.y }
    frames.set(member.id, {
      center: { x: middle.x + rel.x * cos - rel.y * sin, y: middle.y + rel.x * sin + rel.y * cos },
      w: member.w,
      h: member.h,
      rotation: member.rotation + turn,
    })
  }
  return { frames, shown: turn }
}

export function transformedBy(input: TransformInput): Transformed {
  const members = input.ids
    .filter((id) => transformable(input.view, id) && (!isRotateGrip(input.grip) || !doom.flows(input.view, id)))
    .flatMap((id) => {
      const placed = input.geometry.byId.get(id)
      return placed === undefined ? [] : [memberOf(placed)]
    })
  if (members.length === 0) return nothing
  if (isRotateGrip(input.grip)) {
    const { frames, shown } = rotated(members, input)
    const writes = members.flatMap((member) => placedWrites(input, member, frames.get(member.id)!))
    return { writes, guides: [], label: `${String(doom.wrapRotation(shown))}°` }
  }
  const grip = input.grip as ResizeGrip
  const by = { x: input.at.x - input.origin.x, y: input.at.y - input.origin.y }
  const moved = snappedResize(input, members, grip, by)
  const writes = members.flatMap((member) => placedWrites(input, member, moved.frames.get(member.id)!))
  const w = Math.round(moved.bounds.right - moved.bounds.left)
  const h = Math.round(moved.bounds.bottom - moved.bounds.top)
  return { writes, guides: moved.guides, label: `${String(w)} × ${String(h)}` }
}
