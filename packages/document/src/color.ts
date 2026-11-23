import { onlyKeys, record } from "./plain-object.js"

export const templateColors = [
  "dk1",
  "lt1",
  "dk2",
  "lt2",
  "accent1",
  "accent2",
  "accent3",
  "accent4",
  "accent5",
  "accent6",
  "hlink",
  "folHlink",
] as const
export const mappedSlots = ["bg1", "tx1", "bg2", "tx2"] as const

const systemNames = [
  "scrollBar",
  "background",
  "activeCaption",
  "inactiveCaption",
  "menu",
  "window",
  "windowFrame",
  "menuText",
  "windowText",
  "captionText",
  "activeBorder",
  "inactiveBorder",
  "appWorkspace",
  "highlight",
  "highlightText",
  "btnFace",
  "btnShadow",
  "grayText",
  "btnText",
  "inactiveCaptionText",
  "btnHighlight",
  "3dDkShadow",
  "3dLight",
  "infoText",
  "infoBk",
  "hotLight",
  "gradientActiveCaption",
  "gradientInactiveCaption",
  "menuHighlight",
  "menuBar",
] as const

const unbounded = [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER] as const
const fraction = [0, 100_000] as const
const positive = [0, Number.MAX_SAFE_INTEGER] as const
const transformRanges = {
  alpha: fraction,
  alphaMod: positive,
  alphaOff: [-100_000, 100_000],
  tint: fraction,
  shade: fraction,
  lum: unbounded,
  lumMod: unbounded,
  lumOff: unbounded,
  sat: unbounded,
  satMod: unbounded,
  satOff: unbounded,
  hue: [0, 21_599_999],
  hueMod: positive,
  hueOff: unbounded,
  red: unbounded,
  redMod: unbounded,
  redOff: unbounded,
  green: unbounded,
  greenMod: unbounded,
  greenOff: unbounded,
  blue: unbounded,
  blueMod: unbounded,
  blueOff: unbounded,
} as const satisfies Record<string, readonly [number, number]>
const bareTransforms = ["comp", "inv", "gray", "gamma", "invGamma"] as const

export type TemplateColor = (typeof templateColors)[number]
export type MappedSlot = (typeof mappedSlots)[number]
export type ColorBase =
  | { readonly scheme: TemplateColor | MappedSlot }
  | { readonly rgb: string }
  | { readonly system: string; readonly last: string }
  | { readonly preset: string }
export type ColorTransform =
  | { readonly op: keyof typeof transformRanges; readonly val: number }
  | { readonly op: (typeof bareTransforms)[number] }
export type Color = ColorBase & { readonly transforms?: readonly ColorTransform[] }

const hex = /^[0-9A-F]{6}$/
const presetName = /^[a-z][A-Za-z]*$/

function named<T extends string>(names: readonly T[], value: unknown): T | null {
  for (const name of names) if (name === value) return name
  return null
}

function readBase(color: Record<string, unknown>): ColorBase | null {
  if (onlyKeys(color, ["scheme"])) {
    const scheme = named([...templateColors, ...mappedSlots], color.scheme)
    return scheme === null ? null : { scheme }
  }
  if (onlyKeys(color, ["rgb"])) return typeof color.rgb === "string" && hex.test(color.rgb) ? { rgb: color.rgb } : null
  if (onlyKeys(color, ["system", "last"])) {
    const system = named(systemNames, color.system)
    return system !== null && typeof color.last === "string" && hex.test(color.last)
      ? { system, last: color.last }
      : null
  }
  if (onlyKeys(color, ["preset"])) {
    return typeof color.preset === "string" && presetName.test(color.preset) ? { preset: color.preset } : null
  }
  return null
}

function readTransform(value: unknown): ColorTransform | null {
  const transform = record(value)
  if (transform === null) return null
  const bare = named(bareTransforms, transform.op)
  if (bare !== null) return onlyKeys(transform, ["op"]) ? { op: bare } : null
  const op = named(Object.keys(transformRanges) as (keyof typeof transformRanges)[], transform.op)
  if (op === null || !onlyKeys(transform, ["op", "val"])) return null
  const [low, high] = transformRanges[op]
  const val = transform.val
  if (typeof val !== "number" || !Number.isSafeInteger(val) || val < low || val > high) return null
  return { op, val: Object.is(val, -0) ? 0 : val }
}

export function readColor(value: unknown): Color | null | undefined {
  if (value === undefined) return undefined
  const color = record(value)
  if (color === null) return null
  const { transforms, ...rest } = color
  const base = readBase(rest)
  if (base === null) return null
  if (!Object.hasOwn(color, "transforms")) return base
  if (!Array.isArray(transforms) || transforms.length === 0) return null
  const read: ColorTransform[] = []
  for (const item of transforms) {
    const transform = readTransform(item)
    if (transform === null) return null
    read.push(transform)
  }
  return { ...base, transforms: read }
}

function writtenBase(color: Color): ColorBase {
  if ("scheme" in color) return { scheme: color.scheme }
  if ("rgb" in color) return { rgb: color.rgb }
  if ("system" in color) return { system: color.system, last: color.last }
  return { preset: color.preset }
}

function writtenTransform(transform: ColorTransform): ColorTransform {
  return "val" in transform ? { op: transform.op, val: transform.val } : { op: transform.op }
}

export function writtenColor(color: Color): Color {
  const base = writtenBase(color)
  const transforms = color.transforms ?? []
  return transforms.length === 0 ? base : { ...base, transforms: transforms.map(writtenTransform) }
}

export function sameColor(left: Color | null | undefined, right: Color | null | undefined): boolean {
  if (left == null || right == null) return left == null && right == null
  return JSON.stringify(writtenColor(left)) === JSON.stringify(writtenColor(right))
}

export const opaque = 100_000

const alphaOps: readonly string[] = ["alpha", "alphaMod", "alphaOff"]

export function alphaOf(color: Color): number {
  let alpha = opaque
  for (const transform of color.transforms ?? []) {
    if (!("val" in transform)) continue
    if (transform.op === "alpha") alpha = transform.val
    else if (transform.op === "alphaMod") alpha = (alpha * transform.val) / opaque
    else if (transform.op === "alphaOff") alpha += transform.val
  }
  return Math.min(opaque, Math.max(0, Math.round(alpha)))
}

export function namesAlpha(colors: readonly Color[]): boolean {
  return colors.some((color) => (color.transforms ?? []).some((transform) => alphaOps.includes(transform.op)))
}

export function fadedColor(color: Color, alpha: number): Color {
  const kept = (color.transforms ?? []).filter((transform) => !alphaOps.includes(transform.op))
  const transforms = alpha >= opaque ? kept : [...kept, { op: "alpha" as const, val: alpha }]
  const base = writtenBase(color)
  return transforms.length === 0 ? base : { ...base, transforms }
}
