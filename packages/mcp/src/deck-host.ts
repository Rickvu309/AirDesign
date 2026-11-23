import type { DeckId, DoomRefusal } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"

import type { NamedImages } from "./named-image.js"

export type DeckSummary = { readonly deck: DeckId; readonly name: string; readonly rev: number }

export type Opened = { readonly ok: true; readonly deck: DeckId; readonly rev: number; readonly fold: doom.Doom }
export type Listed = {
  readonly ok: true
  readonly decks: readonly DeckSummary[]
  readonly next?: DeckId
}
export type Landed = { readonly ok: true; readonly deck: DeckId; readonly rev: number }

export type DeckHost = {
  readonly list: (cursor: DeckId | undefined) => Promise<Listed | DoomRefusal>
  readonly create: (name: string, once: string) => Promise<Opened | DoomRefusal>
  readonly open: (deck: DeckId) => Promise<Opened | DoomRefusal>
  readonly edit: (deck: DeckId, edit: doom.Edit) => Promise<Landed | DoomRefusal>
  readonly images?: (deck: DeckId, names: readonly string[]) => Promise<NamedImages>
  readonly measure?: (fold: doom.Doom) => Promise<doom.Measure | undefined>
  readonly pictures?: (
    deck: DeckId,
    fold: doom.Doom,
    slides: readonly doom.NodeId[],
  ) => Promise<ReadonlyMap<doom.NodeId, string>>
}
