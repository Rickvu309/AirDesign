import type { DeckId, SceneRefusal } from "@airdesign/catalog"
import type { scene } from "@airdesign/document"

export type DeckSummary = { readonly deck: DeckId; readonly name: string; readonly rev: number }

export type Opened = { readonly ok: true; readonly deck: DeckId; readonly rev: number; readonly fold: scene.Scene }
export type Listed = {
  readonly ok: true
  readonly decks: readonly DeckSummary[]
  readonly next?: DeckId
}
export type Landed = { readonly ok: true; readonly deck: DeckId; readonly rev: number }

export type DeckHost = {
  readonly list: (cursor: DeckId | undefined) => Promise<Listed | SceneRefusal>
  readonly create: (name: string, once: string) => Promise<Opened | SceneRefusal>
  readonly open: (deck: DeckId) => Promise<Opened | SceneRefusal>
  readonly edit: (deck: DeckId, edit: scene.Edit) => Promise<Landed | SceneRefusal>
}
