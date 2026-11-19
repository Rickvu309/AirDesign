import type { SlideTransition } from "@airdesign/pptx"

export type TransitionFrames = {
  readonly incoming: readonly Keyframe[] | null
  readonly outgoing: readonly Keyframe[] | null
  readonly duration: number
  readonly easing: string
  readonly outgoingOnTop?: boolean
  readonly morph?: true
}

export type LayerBox = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly turn: string
}

const pushFrom: Readonly<Record<string, { readonly axis: "X" | "Y"; readonly sign: 1 | -1 }>> = {
  l: { axis: "X", sign: 1 },
  r: { axis: "X", sign: -1 },
  u: { axis: "Y", sign: 1 },
  d: { axis: "Y", sign: -1 },
}

const wipeFrom: Readonly<Record<string, string>> = {
  l: "inset(0 0 0 100%)",
  r: "inset(0 100% 0 0)",
  u: "inset(100% 0 0 0)",
  d: "inset(0 0 100% 0)",
}

const settle = "cubic-bezier(0.23, 1, 0.32, 1)"
const travel = "cubic-bezier(0.77, 0, 0.175, 1)"
const coverFrom: Readonly<Record<string, string>> = { l: "r", r: "l", u: "d", d: "u" }

function motion(direction: string | null, way: "in" | "out"): readonly Keyframe[] {
  const { axis, sign } = pushFrom[direction ?? "l"] ?? pushFrom.l!
  const from = sign * 100
  return way === "in"
    ? [{ transform: `translate${axis}(${from}%)` }, { transform: `translate${axis}(0)` }]
    : [{ transform: `translate${axis}(0)` }, { transform: `translate${axis}(${-from}%)` }]
}

function ratio(from: number, to: number): number {
  return to <= 0 ? 1 : from / to
}

export function layerFrames(before: LayerBox, after: LayerBox): readonly Keyframe[] {
  const dx = before.x + before.width / 2 - (after.x + after.width / 2)
  const dy = before.y + before.height / 2 - (after.y + after.height / 2)
  const scale = `scale(${String(ratio(before.width, after.width))}, ${String(ratio(before.height, after.height))})`
  const turned = (turn: string) => (turn === "" ? "" : `${turn} `)
  return [
    { transform: `translate(${String(dx)}px, ${String(dy)}px) ${turned(before.turn)}${scale}` },
    { transform: `translate(0px, 0px) ${turned(after.turn)}scale(1, 1)` },
  ]
}

export function transitionFrames(transition: SlideTransition): TransitionFrames {
  const { duration } = transition
  if (transition.kind === "morph")
    return { incoming: [{ opacity: 0 }, { opacity: 1 }], outgoing: null, duration, easing: travel, morph: true }
  if (transition.kind === "push")
    return {
      incoming: motion(transition.direction, "in"),
      outgoing: motion(transition.direction, "out"),
      duration,
      easing: travel,
    }
  if (transition.kind === "cover")
    return {
      incoming: motion(coverFrom[transition.direction ?? "l"] ?? "r", "in"),
      outgoing: null,
      duration,
      easing: travel,
    }
  if (transition.kind === "pull")
    return {
      incoming: null,
      outgoing: motion(transition.direction, "out"),
      duration,
      easing: travel,
      outgoingOnTop: true,
    }
  if (transition.kind === "wipe")
    return {
      incoming: [{ clipPath: wipeFrom[transition.direction ?? "l"] ?? wipeFrom.l! }, { clipPath: "inset(0 0 0 0)" }],
      outgoing: null,
      duration,
      easing: settle,
    }
  return { incoming: [{ opacity: 0 }, { opacity: 1 }], outgoing: null, duration, easing: settle }
}

export function playedFrames(transition: SlideTransition, reduced: boolean): TransitionFrames | null {
  return reduced ? null : transitionFrames(transition)
}
