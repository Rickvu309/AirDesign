import * as doom from "@airdesign/doom"

import type { DeckHost } from "./deck-host.js"

export async function deckMeasure(host: DeckHost, folds: readonly doom.Doom[]): Promise<doom.Measure | undefined> {
  if (host.measure === undefined) return undefined
  try {
    const read = await host.measure(folds)
    return typeof read === "string" ? undefined : read.measure
  } catch {
    return undefined
  }
}
