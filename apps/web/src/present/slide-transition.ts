import type { Props } from "@airdesign/doom"

export type TransitionFrames = {
  readonly incoming: readonly Keyframe[]
  readonly outgoing: readonly Keyframe[] | null
  readonly duration: number
  readonly easing: string
  readonly morph?: true
}

export type LayerBox = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly turn: string
}

const settle = "cubic-bezier(0.23, 1, 0.32, 1)"
const travel = "cubic-bezier(0.77, 0, 0.175, 1)"

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

export function transitionFrames(transition: Props["transition"]): TransitionFrames {
  const duration = transition.ms
  if (transition.kind === "smartMove")
    return { incoming: [{ opacity: 0 }, { opacity: 1 }], outgoing: null, duration, easing: travel, morph: true }
  if (transition.kind === "push")
    return {
      incoming: [{ transform: "translateX(100%)" }, { transform: "translateX(0)" }],
      outgoing: [{ transform: "translateX(0)" }, { transform: "translateX(-100%)" }],
      duration,
      easing: travel,
    }
  return { incoming: [{ opacity: 0 }, { opacity: 1 }], outgoing: null, duration, easing: settle }
}

export function playedFrames(transition: Props["transition"], reduced: boolean): TransitionFrames | null {
  return reduced ? null : transitionFrames(transition)
}
