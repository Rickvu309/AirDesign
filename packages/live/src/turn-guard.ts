import * as doom from "@airdesign/doom"
import type { Step } from "./doom-steps.js"

export function turnGuard(
  now: doom.Doom,
  writes: readonly doom.Write[],
  step: Step,
  source: doom.Landed,
  turned: Iterable<string>,
): {
  readonly guarded: boolean
  readonly replay: { readonly readBase?: doom.Rev; readonly turnFrom?: string[]; readonly turnSource?: doom.RunEdit }
} {
  const rebuilds = doom.rebuildsLinks(now, writes)
  const guarded = rebuilds || step.guarded === true
  const linked = rebuilds || step.writes.some(({ prop }) => prop === "instance")
  const last = source.once
  return {
    guarded,
    replay: {
      ...(guarded ? { readBase: now.rev } : {}),
      ...(linked
        ? {
            turnFrom: [...new Set([...turned, ...step.onces.filter((once) => once !== last)]), last],
            turnSource: doom.undoSourceOf(step.before, source),
          }
        : {}),
    },
  }
}
