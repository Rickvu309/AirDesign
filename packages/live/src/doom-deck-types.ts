import type { DeckId, DoomPictured, DoomRefusal, SlidePictures } from "@airdesign/catalog"
import type * as doom from "@airdesign/doom"
import type { DeckStatus } from "./doom-status.js"
import type { DoomStorage } from "./doom-storage.js"

export type Notice = {
  readonly once: string
  readonly refused: doom.Refusal["refused"]
  readonly node?: doom.NodeId
  readonly prop?: doom.WriteKey
  readonly because?: string
  readonly turn?: "undo" | "redo"
}

export type Sent = { readonly ok: true; readonly once: string; readonly saved: Promise<void> }
export type Refused = { readonly ok: false; readonly refused: doom.Refusal }

export type Pushed = Sent | { readonly ok: true; readonly unchanged: true } | Refused

export type Turned =
  | { readonly ok: true; readonly once: string; readonly saved: Promise<void> }
  | { readonly ok: false; readonly reason: "nothing" }
  | { readonly ok: false; readonly reason: "refused"; readonly refused: doom.Refusal }

export type TurnedRun =
  | {
      readonly ok: true
      readonly once: string
      readonly saved: Promise<void>
      readonly kept: readonly doom.NodeId[]
      readonly left: readonly doom.NodeId[]
      readonly waiting: readonly doom.NodeId[]
    }
  | {
      readonly ok: false
      readonly reason: "left"
      readonly kept: readonly doom.NodeId[]
      readonly left: readonly doom.NodeId[]
      readonly waiting: readonly doom.NodeId[]
    }
  | Exclude<Turned, { readonly ok: true }>
  | { readonly ok: false; readonly reason: "offline" | "size" }

export type Synced =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "offline" }
  | { readonly ok: false; readonly reason: "blocked"; readonly refusal: DoomRefusal["refusal"] }

export type DoomDeck = {
  readonly deck: DeckId
  view(): doom.Doom
  server(): doom.Doom
  pending(): readonly doom.Edit[]
  notices(): readonly Notice[]
  clearNotices(): void
  status(): DeckStatus
  mint(): doom.NodeId
  push(
    writes: readonly doom.Write[],
    options?: {
      readonly author?: doom.Author
      readonly step?: string
      readonly read?: doom.Doom
      readonly seen?: doom.Doom
    },
  ): Pushed
  regenerate(
    frame: doom.NodeId,
    patch: doom.ComponentPatch,
  ): (Exclude<Pushed, Refused> & { readonly findings: readonly doom.ComponentUpdateFinding[] }) | Refused
  undo(): Turned
  redo(): Turned
  undoRun(run: string): Promise<TurnedRun>
  sync(): Promise<Synced>
  catchUp(): Promise<{ readonly ok: boolean }>
  follow(signal: AbortSignal): Promise<Followed>
  reportPictures(rev: number, pictures: SlidePictures): Promise<DoomPictured>
  picturesWanted(): boolean
  subscribe(listener: () => void): () => void
}

export type Followed = "stopped" | "gone"

export type DoomOptions = {
  readonly once?: () => string
  readonly client?: string
  readonly storage?: DoomStorage
  readonly pause?: (ms: number) => Promise<void>
  readonly measure?: () => doom.Measure | null
}

export type Opened = { readonly ok: true; readonly deck: DoomDeck } | Exclude<DoomRefusal, { readonly refusal: "edit" }>
