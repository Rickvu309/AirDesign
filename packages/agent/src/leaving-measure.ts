import type * as doom from "@airdesign/doom"

import type { DeckHost } from "./deck-host.js"
import { deckMeasure } from "./deck-measure.js"

const leavesLayers = (intent: doom.Intent) =>
  intent.op === "delete" || intent.op === "unwrap" || (intent.op === "slide" && intent.delete !== undefined)

export async function leavingMeasure(
  host: Pick<DeckHost, "measure">,
  folds: readonly doom.Doom[],
  intents: readonly doom.Intent[],
): Promise<doom.Measure | undefined> {
  return intents.some(leavesLayers) ? (await deckMeasure(host, folds))?.measure : undefined
}
