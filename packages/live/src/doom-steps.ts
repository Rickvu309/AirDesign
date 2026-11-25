import type * as doom from "@airdesign/doom"

export type Step = {
  readonly onces: readonly string[]
  readonly before: doom.Doom
  readonly writes: readonly doom.Write[]
  readonly key?: string
  readonly guarded?: true
  readonly run?: string
}

type Laid = Pick<Step, "before" | "writes">

export function forgetSteps(steps: readonly Step[], gone: readonly string[]): Step[] {
  const dropped = new Set(gone)
  return steps.flatMap((step) => {
    const onces = step.onces.filter((once) => !dropped.has(once))
    return onces.length === 0 ? [] : [{ ...step, onces }]
  })
}

export function relaySteps(steps: readonly Step[], laid: ReadonlyMap<string, Laid>): Step[] {
  return steps.map((step) => {
    const name = step.onces.length === 1 ? step.onces[0] : undefined
    const changed = name === undefined ? undefined : laid.get(name)
    return changed === undefined ? step : { ...step, ...changed }
  })
}

export function recordStep(steps: Step[], step: Step, canJoin: boolean) {
  const open = steps.at(-1)
  if (canJoin && step.key !== undefined && open?.guarded !== true && open?.key === step.key) {
    steps[steps.length - 1] = {
      ...open,
      onces: [...open.onces, ...step.onces],
      writes: [...open.writes, ...step.writes],
    }
  } else steps.push(step)
}

export const turnOf =
  (undoSteps: readonly Step[], redoSteps: readonly Step[]) =>
  (once: string): "undo" | "redo" | undefined =>
    redoSteps.some((step) => step.onces.includes(once))
      ? "undo"
      : undoSteps.some((step) => step.onces.includes(once))
        ? "redo"
        : undefined
