import type { Color as OldColor, Overlay } from "@airdesign/document"
import type { scene } from "@airdesign/document"

export const pointEmu = 12_700
export const cornerEmu = 9_525
export const hundredths = 100
export const wholeFraction = 100_000
export const degreeAngle = 60_000

type SchemeSlot =
  | "dk1"
  | "lt1"
  | "dk2"
  | "lt2"
  | "accent1"
  | "accent2"
  | "accent3"
  | "accent4"
  | "accent5"
  | "accent6"
  | "hlink"

export const slotOfVar: Readonly<Record<scene.ColorVar, SchemeSlot>> = {
  text: "dk1",
  background: "lt1",
  text2: "dk2",
  background2: "lt2",
  accent1: "accent1",
  accent2: "accent2",
  accent3: "accent3",
  accent4: "accent4",
  accent5: "accent5",
  accent6: "accent6",
  link: "hlink",
}

const varOfSlot = Object.fromEntries(Object.entries(slotOfVar).map(([name, slot]) => [slot, name])) as Readonly<
  Record<string, scene.ColorVar>
>
const mappedSlots: Readonly<Record<string, scene.ColorVar>> = {
  tx1: "text",
  bg1: "background",
  tx2: "text2",
  bg2: "background2",
}

export type OldPaint =
  | { readonly none: true }
  | { readonly solid: OldColor }
  | { readonly gradient: OldGradient }
  | { readonly image: string | null }

export type OldGradient = {
  readonly stops: readonly { readonly pos: number; readonly color: OldColor }[]
  readonly shade:
    | { readonly linear: { readonly angle: number; readonly scaled: boolean } }
    | {
        readonly path: {
          readonly kind: "circle"
          readonly focus: { readonly l: number; readonly t: number; readonly r: number; readonly b: number }
        }
      }
  readonly rotateWithShape: boolean
}

const wholeCircle = 21_600_000
const middle = 50_000

export function emuOf(px: number): number {
  return Math.round(px * pointEmu)
}

export function pxOf(emu: number): number {
  return emu / pointEmu
}

export function oldColorOf(color: scene.Color): OldColor {
  if (typeof color === "string") return { rgb: color.slice(1).toUpperCase() }
  const scheme = slotOfVar[color.var]
  const tint = color.tint ?? 0
  if (tint === 0) return { scheme }
  if (tint > 0)
    return {
      scheme,
      transforms: [
        { op: "lumMod", val: Math.round((1 - tint) * wholeFraction) },
        { op: "lumOff", val: Math.round(tint * wholeFraction) },
      ],
    }
  return { scheme, transforms: [{ op: "lumMod", val: Math.round((1 + tint) * wholeFraction) }] }
}

function tintOf(transforms: readonly { readonly op: string; readonly val?: number }[] | undefined): number {
  const kept = (transforms ?? []).filter((step) => step.op === "lumMod" || step.op === "lumOff")
  const mod = kept.find((step) => step.op === "lumMod")?.val
  const off = kept.find((step) => step.op === "lumOff")?.val
  if (off !== undefined && off > 0) return Math.min(1, off / wholeFraction)
  if (mod !== undefined && mod < wholeFraction) return -(1 - mod / wholeFraction)
  return 0
}

export function sceneColorOf(color: OldColor): scene.Color | undefined {
  if ("rgb" in color) return `#${color.rgb.toLowerCase()}`
  if (!("scheme" in color)) return undefined
  const name = varOfSlot[color.scheme] ?? mappedSlots[color.scheme]
  if (name === undefined) return undefined
  const tint = tintOf(color.transforms)
  return tint === 0 ? { var: name } : { var: name, tint: Math.round(tint * 100) / 100 }
}

export function oldPaintOf(paint: scene.Paint): OldPaint {
  if (paint.kind === "solid") return { solid: oldColorOf(paint.color) }
  if (paint.kind === "image") return { image: paint.asset }
  const stops = paint.stops.map((stop) => ({ pos: Math.round(stop.at * wholeFraction), color: oldColorOf(stop.color) }))
  const shade =
    paint.shape === "radial"
      ? { path: { kind: "circle" as const, focus: { l: middle, t: middle, r: middle, b: middle } } }
      : {
          linear: {
            angle: ((Math.round(paint.angle * degreeAngle) % wholeCircle) + wholeCircle) % wholeCircle,
            scaled: false,
          },
        }
  return { gradient: { stops, shade, rotateWithShape: true } }
}

export function scenePaintOf(value: unknown, kept: scene.Paint | undefined): scene.Paint | null {
  if (typeof value !== "object" || value === null) return null
  const extra = {
    ...(kept?.opacity === undefined ? {} : { opacity: kept.opacity }),
  }
  if ("solid" in value) {
    const color = sceneColorOf(value.solid as OldColor)
    return color === undefined ? null : { kind: "solid", color, ...extra }
  }
  if ("gradient" in value) {
    const gradient = value.gradient as OldGradient
    const stops = gradient.stops.flatMap((stop) => {
      const color = sceneColorOf(stop.color)
      return color === undefined ? [] : [{ at: Math.min(1, Math.max(0, stop.pos / wholeFraction)), color }]
    })
    if (stops.length < 2) return null
    const radial = "path" in gradient.shade
    const angle = "linear" in gradient.shade ? Math.round(gradient.shade.linear.angle / degreeAngle) : 0
    return { kind: "gradient", shape: radial ? "radial" : "linear", angle, stops, ...extra }
  }
  if ("image" in value && typeof value.image === "string")
    return kept?.kind === "image" && kept.asset === value.image
      ? kept
      : { kind: "image", asset: value.image, fit: "fill", ...extra }
  return null
}

export function overlayOf(): Overlay {
  return { none: true }
}
