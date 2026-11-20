import type { MarkupElement } from "./element-span.js"
import { inside, whole } from "./markup-held.js"
import { paintAttribute, paintColor, type PaintColor } from "./paint-color.js"
import type { PaintTextHolder, PaintTextScope } from "./paint-text.js"

type BulletLook = { font: string | null; color: PaintColor | null; size: number | null }

export type PaintBullet =
  | ({ char: string } & BulletLook)
  | ({ autoNumber: string; start: number; number: number } & BulletLook)

type Counted = { readonly scheme: string; readonly start: number; readonly number: number }

export type BulletCount = (level: number, scheme: string | null, start: number) => number

const levels = 9
const bulletKinds = new Set(["a:buNone", "a:buChar", "a:buAutoNum", "a:buBlip"])
const bulletFontKinds = new Set(["a:buFont", "a:buFontTx"])
const bulletColorKinds = new Set(["a:buClr", "a:buClrTx"])
const bulletSizeKinds = new Set(["a:buSzPct", "a:buSzPts", "a:buSzTx"])
const fontReference = /^\+m[jn]-(lt|ea|cs)$/

const typeface = (element: MarkupElement, scope: PaintTextScope): string | undefined => {
  const value = paintAttribute(element, "typeface")
  if (value === null || value === "") return undefined
  return fontReference.test(value) ? scope.fonts.get(value) : value
}

const bulletPart = <T>(
  layers: readonly PaintTextHolder[],
  kinds: ReadonlySet<string>,
  read: (part: PaintTextHolder) => T | undefined,
): T | undefined => {
  for (const layer of layers) {
    const element = inside(layer).find((item) => kinds.has(item.kind))
    const value = element === undefined ? undefined : read({ element, children: layer.children })
    if (value !== undefined) return value
  }
  return undefined
}

const bulletFont = (part: PaintTextHolder, scope: PaintTextScope): string | null =>
  part.element.kind === "a:buFont" ? (typeface(part.element, scope) ?? null) : null

const bulletColor = (part: PaintTextHolder, scope: PaintTextScope): PaintColor | null => {
  const color = part.element.kind === "a:buClr" ? inside(part)[0] : undefined
  return color === undefined ? null : paintColor(color, part.children, scope.palette)
}

const bulletSize = (part: PaintTextHolder): number | null => {
  if (part.element.kind !== "a:buSzPct") return null
  const value = paintAttribute(part.element, "val")
  if (value !== null && /^[+-]?\d+(\.\d+)?%$/.test(value)) return Number(value.slice(0, -1)) / 100
  const number = whole(part.element, "val")
  return number === undefined ? null : number / 100000
}

export const bulletCounter = (): BulletCount => {
  const counts = new Map<number, Counted>()
  return (level, scheme, start) => {
    for (const known of counts.keys()) if (known > level) counts.delete(known)
    if (scheme === null) {
      counts.delete(level)
      return 0
    }
    const previous = counts.get(level)
    const number = previous?.scheme === scheme && previous.start === start ? previous.number + 1 : start
    counts.set(level, { scheme, start, number })
    return number
  }
}

export const ownsBullet = (properties: PaintTextHolder | undefined): boolean =>
  properties !== undefined && inside(properties).some((item) => bulletKinds.has(item.kind))

export const bulletOf = (
  layers: readonly PaintTextHolder[],
  level: number,
  count: BulletCount,
  scope: PaintTextScope,
): PaintBullet | null => {
  const part = bulletPart(layers, bulletKinds, (found) => {
    if (found.element.kind === "a:buChar" && paintAttribute(found.element, "char") === null) return undefined
    if (found.element.kind === "a:buAutoNum" && paintAttribute(found.element, "type") === null) return undefined
    return found
  })
  const scheme = part?.element.kind === "a:buAutoNum" ? paintAttribute(part.element, "type") : null
  const start = part === undefined ? 1 : (whole(part.element, "startAt") ?? 1)
  const number = count(level, scheme, start)
  if (part === undefined || (scheme === null && part.element.kind !== "a:buChar")) return null
  const look = {
    font: bulletPart(layers, bulletFontKinds, (found) => bulletFont(found, scope)) ?? null,
    color: bulletPart(layers, bulletColorKinds, (found) => bulletColor(found, scope)) ?? null,
    size: bulletPart(layers, bulletSizeKinds, bulletSize) ?? null,
  }
  return scheme === null
    ? { char: paintAttribute(part.element, "char") ?? "", ...look }
    : { autoNumber: scheme, start, number, ...look }
}

export const templateBullets = (
  placeholder: string | null,
  layersAt: (level: number) => readonly PaintTextHolder[],
  scope: PaintTextScope,
): { readonly templateBullets?: readonly (PaintBullet | null)[] } => {
  if (placeholder === null) return {}
  const bullets = Array.from({ length: levels }, (_, level) => bulletOf(layersAt(level), level, bulletCounter(), scope))
  return bullets.some((bullet) => bullet !== null) ? { templateBullets: bullets } : {}
}
