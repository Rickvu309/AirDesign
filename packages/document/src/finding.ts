import type { ResolvedElement } from "./resolved-slide.js"

export const findingLimits = {
  overflow: 1,
  offSlide: 1,
  overlap: 3,
  smallText: 10,
  slideHeight: 540,
  contrast: 4.5,
  largeContrast: 3,
  largeText: 18,
  largeBold: 14,
} as const

export type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

type About = { readonly slide: string; readonly node: string }

export type Finding = About &
  (
    | {
        readonly code: "overflow"
        readonly level: "fault"
        readonly needed: number
        readonly room: number
        readonly fix: { readonly size: number | null; readonly height: number }
      }
    | {
        readonly code: "off-slide"
        readonly level: "fault" | "note"
        readonly past: number
        readonly fix: { readonly x: number; readonly y: number } | null
      }
    | {
        readonly code: "overlap"
        readonly level: "fault"
        readonly other: string
        readonly by: "text" | "cover"
        readonly area: Rect
        readonly fix: { readonly node: string; readonly dx: number; readonly dy: number }
      }
    | {
        readonly code: "small-text"
        readonly level: "fault"
        readonly size: number
        readonly fix: { readonly size: number }
      }
    | {
        readonly code: "low-contrast"
        readonly level: "fault"
        readonly ratio: number
        readonly needs: number
        readonly text: string
        readonly behind: string
        readonly fix: { readonly color: string }
      }
    | {
        readonly code: "misaligned"
        readonly level: "fault"
        readonly other: string
        readonly edge: "left" | "right" | "top" | "bottom"
        readonly by: number
        readonly fix: { readonly x: number } | { readonly y: number }
      }
    | {
        readonly code: "empty-placeholder"
        readonly level: "note"
        readonly placeholder: string
        readonly fix: "delete"
      }
  )

export type Placed = {
  readonly element: ResolvedElement
  readonly box: Rect | null
  readonly glyphs: readonly Rect[]
}

export function points(value: number): number {
  return Math.round(value * 100) / 100
}

export function union(rects: readonly Rect[]): Rect {
  const left = Math.min(...rects.map((rect) => rect.x))
  const top = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map((rect) => rect.x + rect.w))
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.h))
  return { x: left, y: top, w: right - left, h: bottom - top }
}
