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

export type Unmeasured = "fonts" | "time"
export type Measured = {
  readonly measure: doom.Measure
  readonly missing: doom.MissingGlyphs
  readonly pending?: ReadonlySet<string>
}

export type RunLog = {
  readonly ok: true
  readonly edits: readonly unknown[]
  readonly replaced: readonly unknown[]
}

export type SlideShot = string | { readonly failure: "fonts" }

export type DeckHost = {
  readonly list: (cursor: DeckId | undefined) => Promise<Listed | DoomRefusal>
  readonly create: (name: string, once: string) => Promise<Opened | DoomRefusal>
  readonly open: (deck: DeckId) => Promise<Opened | DoomRefusal>
  readonly edit: (deck: DeckId, edit: doom.Edit) => Promise<Landed | DoomRefusal>
  readonly run: (deck: DeckId, run: string) => Promise<RunLog | DoomRefusal>
  readonly foldAt?: (deck: DeckId, rev: number) => Promise<doom.Doom | undefined>
  readonly images?: (deck: DeckId, names: readonly string[]) => Promise<NamedImages>
  readonly measure?: (folds: readonly doom.Doom[], layers?: readonly doom.NodeId[]) => Promise<Measured | Unmeasured>
  readonly pictures?: (
    deck: DeckId,
    fold: doom.Doom,
    slides: readonly doom.NodeId[],
  ) => Promise<ReadonlyMap<doom.NodeId, SlideShot>>
}
