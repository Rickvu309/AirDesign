import type * as doom from "@airdesign/doom"

import type { DeckHost, Measured } from "./deck-host.js"

export async function deckMeasure(
  host: Pick<DeckHost, "measure">,
  folds: readonly doom.Doom[],
  layers?: readonly doom.NodeId[],
  extraTexts?: readonly string[],
): Promise<Measured | undefined> {
  if (host.measure === undefined) return undefined
  try {
    const read = await host.measure(folds, layers, extraTexts)
    return typeof read === "string" ? undefined : read
  } catch {
    return undefined
  }
}
