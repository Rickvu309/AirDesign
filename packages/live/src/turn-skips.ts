import * as doom from "@airdesign/doom"
import type { Notice } from "./doom-deck-types.js"
import type { Step } from "./doom-steps.js"

export function turnSkips(step: Step, now: doom.Doom, once: string, turn: "undo" | "redo") {
  const skipped = doom.skippedTemplates(step.before, now, step.writes)
  const added = skipped.map((node): Notice => ({ once, refused: "missing", node, prop: "spec", turn }))
  return {
    named: skipped.length === 0 ? {} : { skipped },
    noticed: (notices: readonly Notice[]) => [
      ...notices.filter((notice) => notice.once !== once || notice.turn === undefined),
      ...added,
    ],
  }
}
