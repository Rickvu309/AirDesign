import type { SlideTransition } from "@airdesign/pptx"

export type TransitionFrames = {
  readonly incoming: readonly Keyframe[]
  readonly outgoing: readonly Keyframe[] | null
  readonly duration: number
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

export function transitionFrames(transition: SlideTransition): TransitionFrames {
  const { duration } = transition
  if (transition.kind === "push") {
    const { axis, sign } = pushFrom[transition.direction ?? "l"] ?? pushFrom.l!
    return {
      incoming: [{ transform: `translate${axis}(${sign * 100}%)` }, { transform: `translate${axis}(0)` }],
      outgoing: [{ transform: `translate${axis}(0)` }, { transform: `translate${axis}(${-sign * 100}%)` }],
      duration,
    }
  }
  if (transition.kind === "wipe")
    return {
      incoming: [{ clipPath: wipeFrom[transition.direction ?? "l"] ?? wipeFrom.l! }, { clipPath: "inset(0 0 0 0)" }],
      outgoing: null,
      duration,
    }
  return { incoming: [{ opacity: 0 }, { opacity: 1 }], outgoing: null, duration }
}
