import { readSlideId, slideNode, type ElementId, type SlideId, type TransitionValue } from "@airdesign/document"
import { readSlides } from "@airdesign/pptx"

export type ArrivalStyle = "none" | "dissolve" | "push" | "moveIn" | "moveOut"
export type ArrivalSide = "left" | "right" | "top" | "bottom"
export type ArrivalAdvance = { readonly click: true } | { readonly delay: number }

const clicked: ArrivalAdvance = { click: true }

export function secondsOf(ms: number): number {
  return Math.round(ms / 10) / 100
}

export function millisecondsOf(seconds: number, min: number, max: number): number {
  if (!Number.isFinite(seconds)) return min
  return Math.min(max, Math.max(min, Math.round(seconds * 1000)))
}

export function styleOf(value: TransitionValue): ArrivalStyle {
  if ("none" in value) return "none"
  if ("dissolve" in value) return "dissolve"
  if ("push" in value) return "push"
  if ("moveIn" in value) return "moveIn"
  return "moveOut"
}

export function durationOf(value: TransitionValue): number {
  if ("dissolve" in value) return value.dissolve.duration
  if ("push" in value) return value.push.duration
  if ("moveIn" in value) return value.moveIn.duration
  if ("moveOut" in value) return value.moveOut.duration
  return 500
}

export function directionOf(value: TransitionValue): ArrivalSide {
  if ("push" in value) return value.push.direction
  if ("moveIn" in value) return value.moveIn.direction
  if ("moveOut" in value) return value.moveOut.direction
  return "right"
}

export function advanceOf(value: TransitionValue): ArrivalAdvance {
  if ("none" in value) return value.none.advance
  if ("dissolve" in value) return value.dissolve.advance
  if ("push" in value) return value.push.advance
  if ("moveIn" in value) return value.moveIn.advance
  return value.moveOut.advance
}

export function arrivalOf(style: ArrivalStyle, current: TransitionValue | null): TransitionValue {
  const duration = current === null ? 500 : durationOf(current)
  const direction = current === null ? "right" : directionOf(current)
  const advance = current === null ? clicked : advanceOf(current)
  if (style === "none") return { none: { advance } }
  if (style === "dissolve") return { dissolve: { duration, advance } }
  if (style === "push") return { push: { direction, duration, advance } }
  if (style === "moveIn") return { moveIn: { direction, duration, advance } }
  return { moveOut: { direction, duration, advance } }
}

export function withDuration(value: TransitionValue, duration: number): TransitionValue {
  const advance = advanceOf(value)
  if ("dissolve" in value) return { dissolve: { duration, advance } }
  if ("push" in value) return { push: { direction: value.push.direction, duration, advance } }
  if ("moveIn" in value) return { moveIn: { direction: value.moveIn.direction, duration, advance } }
  if ("moveOut" in value) return { moveOut: { direction: value.moveOut.direction, duration, advance } }
  return value
}

export function withDirection(value: TransitionValue, direction: ArrivalSide): TransitionValue {
  const advance = advanceOf(value)
  if ("push" in value) return { push: { direction, duration: value.push.duration, advance } }
  if ("moveIn" in value) return { moveIn: { direction, duration: value.moveIn.duration, advance } }
  if ("moveOut" in value) return { moveOut: { direction, duration: value.moveOut.duration, advance } }
  return value
}

export function withTiming(value: TransitionValue, timing: "click" | "delay"): TransitionValue {
  const current = advanceOf(value)
  const advance: ArrivalAdvance = timing === "click" ? clicked : { delay: "delay" in current ? current.delay : 1000 }
  if ("none" in value) return { none: { advance } }
  if ("dissolve" in value) return { dissolve: { duration: value.dissolve.duration, advance } }
  if ("push" in value) return { push: { direction: value.push.direction, duration: value.push.duration, advance } }
  if ("moveIn" in value)
    return { moveIn: { direction: value.moveIn.direction, duration: value.moveIn.duration, advance } }
  return { moveOut: { direction: value.moveOut.direction, duration: value.moveOut.duration, advance } }
}

export function slideTargets(parts: ReadonlyMap<string, Uint8Array>): readonly ElementId[] {
  return readSlides(parts).flatMap(({ slide }) => {
    const id = readSlideId(slide)
    return id === undefined ? [] : [slideNode(id, "slide")]
  })
}

export function currentSlide(parts: ReadonlyMap<string, Uint8Array>, index: number): SlideId | null {
  const found = readSlides(parts)[index]
  return found === undefined ? null : (readSlideId(found.slide) ?? null)
}

export function withDelay(value: TransitionValue, delay: number): TransitionValue {
  const advance: ArrivalAdvance = { delay }
  if ("none" in value) return { none: { advance } }
  if ("dissolve" in value) return { dissolve: { duration: value.dissolve.duration, advance } }
  if ("push" in value) return { push: { direction: value.push.direction, duration: value.push.duration, advance } }
  if ("moveIn" in value)
    return { moveIn: { direction: value.moveIn.direction, duration: value.moveIn.duration, advance } }
  return { moveOut: { direction: value.moveOut.direction, duration: value.moveOut.duration, advance } }
}
