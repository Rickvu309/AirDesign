import { presetBasic } from "./preset-basic.js"
import { presetArrows } from "./preset-arrows.js"
import { presetRounded } from "./preset-rounded.js"
import { presetCallouts } from "./preset-callouts.js"
import { presetSpecial } from "./preset-special.js"
import { presetConnectors } from "./preset-connectors.js"
import { presetGuides } from "./preset-guides.js"
import { presetPath, type PresetRule, type Shade } from "./preset-rule.js"
import type { Point } from "./resolved.js"
import type { Geometry } from "./geometry.js"

export type Shaped = { readonly kind: string; readonly name?: string; readonly adjust?: readonly number[] }
export type Area = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export type Site = "t" | "r" | "b" | "l" | "c"
export type OutlinePath = {
  readonly d: string
  readonly fill: boolean
  readonly stroke: boolean
  readonly shade?: Shade
  readonly rings: readonly (readonly Point[])[]
}

const boxRule: PresetRule = {
  area: "l t r b",
  sites: ["hc t", "l vc", "hc b", "r vc"],
  adjusts: [],
  guides: [],
  paths: [],
}

const ellipseRule: PresetRule = {
  area: "il it ir ib",
  sites: ["hc t", "il it", "l vc", "il ib", "hc b", "ir ib", "r vc", "ir it"],
  adjusts: [],
  guides: [
    "idx cos wd2 2700000",
    "idy sin hd2 2700000",
    "il +- hc 0 idx",
    "ir +- hc idx 0",
    "it +- vc 0 idy",
    "ib +- vc idy 0",
  ],
  paths: [],
}

const presets: Readonly<Record<string, PresetRule>> = {
  ...presetBasic,
  ...presetArrows,
  ...presetRounded,
  ...presetCallouts,
  ...presetSpecial,
  ...presetConnectors,
}

const connectorNames = new Set(Object.keys(presetConnectors))

export const shapeNames: readonly string[] = [
  "rect",
  "ellipse",
  ...Object.keys(presets).filter((name) => !connectorNames.has(name)),
]

export function shapeGeometry(name: string): Geometry {
  if (name === "rect" || name === "ellipse") return { kind: name }
  return { kind: "preset", name }
}

function ruleOf(shaped: Shaped | null | undefined): PresetRule | undefined {
  if (shaped === null || shaped === undefined || shaped.kind === "rect") return boxRule
  if (shaped.kind === "ellipse") return ellipseRule
  if (shaped.kind !== "preset" || shaped.name === undefined) return undefined
  return Object.hasOwn(presets, shaped.name) ? presets[shaped.name] : undefined
}

function guidesOf(
  rule: PresetRule,
  w: number,
  h: number,
  adjust: readonly number[],
): ((name: string) => number) | null {
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null
  const named = Object.fromEntries(
    adjust.flatMap((value, at) => {
      const name = rule.adjusts[at]?.trim().split(/\s+/)[0]
      return name === undefined ? [] : [[name, value] as const]
    }),
  )
  try {
    return presetGuides(rule, w, h, named)
  } catch {
    return null
  }
}

export function presetOutline(
  name: string,
  w: number,
  h: number,
  adjust: readonly number[] = [],
): readonly OutlinePath[] | null {
  const rule = ruleOf({ kind: "preset", name })
  const value = rule === undefined ? null : guidesOf(rule, w, h, adjust)
  if (rule === undefined || value === null) return null
  try {
    return rule.paths.map((path) => ({
      ...presetPath(
        path.data,
        value,
        path.width === undefined ? 1 : w / path.width,
        path.height === undefined ? 1 : h / path.height,
      ),
      fill: path.fill,
      stroke: path.stroke,
      ...(path.shade === undefined ? {} : { shade: path.shade }),
    }))
  } catch {
    return null
  }
}

export function adjustDefaults(name: string): Readonly<Record<string, number>> {
  const rule = ruleOf({ kind: "preset", name })
  return Object.fromEntries(
    (rule?.adjusts ?? []).map((definition) => {
      const [adjust = "", , value = "0"] = definition.trim().split(/\s+/)
      return [adjust, Number(value)]
    }),
  )
}

export function textArea(shaped: Shaped | null | undefined, w: number, h: number): Area {
  const whole = { x: 0, y: 0, w, h }
  const rule = ruleOf(shaped)
  const value = rule?.area === undefined ? null : guidesOf(rule, w, h, shaped?.adjust ?? [])
  if (rule?.area === undefined || value === null) return whole
  try {
    const [left, top, right, bottom] = rule.area.split(" ").map(value) as [number, number, number, number]
    return { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) }
  } catch {
    return whole
  }
}

const facing: Readonly<Record<Exclude<Site, "c">, Point>> = {
  t: { x: 0, y: -1 },
  r: { x: 1, y: 0 },
  b: { x: 0, y: 1 },
  l: { x: -1, y: 0 },
}

const boxSpots: Readonly<Record<Site, Point>> = {
  t: { x: 0.5, y: 0 },
  r: { x: 1, y: 0.5 },
  b: { x: 0.5, y: 1 },
  l: { x: 0, y: 0.5 },
  c: { x: 0.5, y: 0.5 },
}

export function presetSites(shaped: Shaped | null | undefined, w: number, h: number): readonly Point[] {
  const rule = ruleOf(shaped)
  const value = rule?.sites === undefined ? null : guidesOf(rule, w, h, shaped?.adjust ?? [])
  if (rule?.sites === undefined || value === null) return []
  try {
    return rule.sites.map((each) => {
      const [x, y] = each.split(" ").map(value) as [number, number]
      return { x, y }
    })
  } catch {
    return []
  }
}

export function siteSpot(shaped: Shaped | null | undefined, w: number, h: number, site: Site, along?: number): Point {
  if (along !== undefined && (shaped == null || shaped.kind === "rect")) {
    if (site === "t" || site === "b") return { x: w * along, y: h * boxSpots[site].y }
    if (site === "l" || site === "r") return { x: w * boxSpots[site].x, y: h * along }
  }
  const plain = { x: w * boxSpots[site].x, y: h * boxSpots[site].y }
  if (site === "c") return plain
  const toward = facing[site]
  let best: { readonly spot: Point; readonly score: number } | null = null
  for (const spot of presetSites(shaped, w, h)) {
    const across = w === 0 ? 0 : (spot.x - w / 2) / w
    const down = h === 0 ? 0 : (spot.y - h / 2) / h
    const length = Math.hypot(across, down)
    if (length === 0) continue
    const score = (across * toward.x + down * toward.y) / length
    if (best === null || score > best.score + 1e-9) best = { spot, score }
  }
  return best === null || best.score <= 0 ? plain : best.spot
}

function inside(rings: readonly (readonly Point[])[], at: Point): boolean {
  let crossed = false
  for (const ring of rings)
    for (let index = 0; index < ring.length; index += 1) {
      const a = ring[index]!
      const b = ring[(index + 1) % ring.length]!
      if (a.y > at.y !== b.y > at.y && at.x < a.x + ((at.y - a.y) * (b.x - a.x)) / (b.y - a.y)) crossed = !crossed
    }
  return crossed
}

export function distanceToSegment(at: Point, from: Point, to: Point): number {
  const along = { x: to.x - from.x, y: to.y - from.y }
  const square = along.x * along.x + along.y * along.y
  const share =
    square === 0 ? 0 : Math.max(0, Math.min(1, ((at.x - from.x) * along.x + (at.y - from.y) * along.y) / square))
  return Math.hypot(at.x - (from.x + share * along.x), at.y - (from.y + share * along.y))
}

function near(rings: readonly (readonly Point[])[], at: Point, reach: number): boolean {
  return rings.some((ring) =>
    ring.some((point, index) => index > 0 && distanceToSegment(at, ring[index - 1]!, point) <= reach),
  )
}

export function presetHolds(
  name: string,
  w: number,
  h: number,
  adjust: readonly number[],
  at: Point,
  reach: number,
): boolean {
  const paths = presetOutline(name, w, h, adjust)
  if (paths === null) return at.x >= 0 && at.y >= 0 && at.x <= w && at.y <= h
  return paths.some((path) => (path.fill && inside(path.rings, at)) || (path.stroke && near(path.rings, at, reach)))
}

export type Rings = readonly (readonly Point[])[]

const roundSteps = 32

export function outlineRings(shaped: Shaped | null | undefined, w: number, h: number): Rings {
  const box: Rings = [
    [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ],
  ]
  if (shaped?.kind === "ellipse")
    return [
      Array.from({ length: roundSteps }, (_, step) => {
        const angle = (step / roundSteps) * Math.PI * 2
        return { x: (w / 2) * (1 + Math.cos(angle)), y: (h / 2) * (1 + Math.sin(angle)) }
      }),
    ]
  if (shaped?.kind !== "preset" || shaped.name === undefined) return box
  const filled = (presetOutline(shaped.name, w, h, shaped.adjust ?? []) ?? [])
    .filter((path) => path.fill)
    .flatMap((path) => path.rings)
    .filter((ring) => ring.length > 2)
  return filled.length === 0 ? box : filled
}
