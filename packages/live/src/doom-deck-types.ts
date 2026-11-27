import type { DeckId, DoomScreenshotsKept, DoomRefusal, SlideScreenshots } from "@airdesign/catalog"
import type * as doom from "@airdesign/doom"
import type { DeckStatus } from "./doom-status.js"
import type { DoomStorage } from "./doom-storage.js"

export type Notice = {
  readonly once: string
  readonly refused: doom.Refusal["refused"]
  readonly node?: doom.NodeId
  readonly prop?: doom.WriteKey
  readonly because?: string
}

export type Sent = { readonly ok: true; readonly once: string; readonly saved: Promise<void> }
export type Refused = { readonly ok: false; readonly refused: doom.Refusal }

export type Pushed = Sent | { readonly ok: true; readonly unchanged: true } | Refused

export type Turned =
  | Sent
  | { readonly ok: false; readonly reason: "nothing" }
  | { readonly ok: false; readonly reason: "refused"; readonly refused: doom.Refusal }

type RunStays = {
  readonly kept: readonly doom.NodeId[]
  readonly later?: readonly doom.NodeId[]
  readonly left: readonly doom.NodeId[]
  readonly waiting: readonly doom.NodeId[]
}

export type TurnedRun =
  | ({ readonly ok: true; readonly once: string; readonly saved: Promise<void> } & RunStays)
  | ({ readonly ok: false; readonly reason: "left" } & RunStays)
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
  caught(): doom.Rev
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
  undo(): Turned
  redo(): Turned
  undoRun(run: string): Promise<TurnedRun>
  sync(): Promise<Synced>
  catchUp(): Promise<{ readonly ok: boolean }>
  reportSelection(selection: { readonly slide: doom.NodeId; readonly ids: readonly doom.NodeId[] } | undefined): void
  follow(signal: AbortSignal): Promise<Followed>
  reportScreenshots(rev: number, screenshots: SlideScreenshots): Promise<DoomScreenshotsKept>
  screenshotsWanted(): boolean
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
