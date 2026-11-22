import { gridSectionStarts, indexDue, type Register } from "@airdesign/document"
import { connect, flushOriginal, memoryRemote } from "@airdesign/live"
import { useEffect } from "react"
import { flushPending, server, type CommitOutcome } from "@/commit-edit"
import { followDeck } from "@/deck-follow"
import { closesDeck, deckParts, deviceCopy } from "@/device-copy"
import type { DeckPaint } from "@/editor/use-deck-paint"
import { backfillIndex } from "@/index-deck"
import { withFileFloors } from "@/deck-paint"
import { notesShown, type ShownNotes } from "@/notes-edit"
import { structureOf } from "@/paint-structure"
import { signInAddress } from "@/thin-notice"

export type OpeningDeck = {
  readonly id: string
  readonly shown: DeckPaint
  readonly notesBar: { readonly show: (notes: readonly ShownNotes[]) => void }
  readonly settle: (outcome: CommitOutcome) => void
  readonly setTitle: (title: string) => void
  readonly setPaintedDeck: (deck: string | undefined) => void
  readonly setOpenedDeck: (deck: string | undefined) => void
  readonly setRefused: (refused: boolean) => void
  readonly setFailure: (failure: "import-failed") => void
  readonly aside: number
}

export function useDeckOpen(deck: OpeningDeck) {
  const { id, shown, notesBar, settle, setTitle, setPaintedDeck, setOpenedDeck, setRefused, setFailure, aside } = deck
  const { store, shownParts, pictures, structure, bound, repaint, setCurrent, showOpened, showRegister } = shown

  function openFrom(
    stored: { readonly parts: ReadonlyMap<string, Uint8Array>; readonly name?: string },
    register: Register | null,
  ) {
    showOpened(stored.parts, register)
    setTitle(stored.name ?? "")
    setPaintedDeck(id)
  }

  function reconcile(register: Register) {
    const before = store.current.slides().map((slide) => slide.id)
    const framed = withFileFloors(shown.paintedOf(register), shown.shownParts.current)
    if (
      (gridSectionStarts(shown.shownRegister.current ?? {}) === undefined) !==
        (gridSectionStarts(register) === undefined) ||
      structure.current !== structureOf(framed, bound.current)
    ) {
      showRegister(register)
      const after = store.current.slides().map((slide) => slide.id)
      setCurrent((index) => {
        const kept = after.findIndex((slide) => slide === before[index])
        return kept >= 0 ? kept : Math.max(0, Math.min(index, after.length - 1))
      })
    } else {
      repaint.current(register)
      notesBar.show(notesShown(shownParts.current, register))
    }
  }

  async function refusedBy(refusal: string): Promise<boolean> {
    if (refusal === "session") {
      window.location.assign(signInAddress(window.location))
      return true
    }
    if (!closesDeck(refusal)) return false
    setPaintedDeck(undefined)
    setRefused(true)
    return true
  }

  useEffect(() => {
    let live = true
    const leaving = new AbortController()
    setPaintedDeck(undefined)
    setOpenedDeck(undefined)
    setRefused(false)
    void (async () => {
      const device = await deviceCopy(id, server)
      if (!live) return
      if (device !== null) openFrom(device.stored, device.register)
      else {
        const asked = await connect(server)
          .open(id)
          .catch(() => null)
        if (!live) return
        if (asked !== null && !asked.ok && (await refusedBy(asked.refusal))) return
      }
      const stored = device?.stored ?? (await deckParts(id))
      if (!live) return
      if (stored === "signed-out") {
        window.location.assign(signInAddress(window.location))
        return
      }
      if (stored === "refused") {
        setPaintedDeck(undefined)
        setRefused(true)
        return
      }
      if (stored === null) {
        setFailure("import-failed")
        return
      }
      const answered = await connect(server)
        .open(id)
        .catch(() => null)
      if (!live) return
      if (answered !== null && !answered.ok && (await refusedBy(answered.refusal))) return
      const opened = await connect(server)
        .openDeck(id)
        .catch(() => null)
      if (!live) return
      const register = opened?.ok === true ? opened.register : null
      if (device === null) openFrom(stored, register)
      else if (register !== null) reconcile(register)
      const followed = followDeck(
        connect(server),
        id,
        async () => {
          const next = await connect(server).openDeck(id)
          if (live && next.ok) reconcile(next.register)
        },
        leaving.signal,
      )
      if (answered?.ok !== true || indexDue(answered.index)) await backfillIndex(id, stored.parts)
      settle(await flushPending(connect, id))
      if (live && gridSectionStarts(shown.shownRegister.current ?? {}) === undefined) {
        const indexed = await connect(memoryRemote()).openDeck(id)
        if (live && indexed.ok && gridSectionStarts(indexed.register) !== undefined) reconcile(indexed.register)
      }
      if (live) setOpenedDeck(id)
      void flushOriginal(id)
      const ended = await followed
      if (live && ended !== undefined) await refusedBy(ended)
    })()
    return () => {
      live = false
      leaving.abort()
    }
  }, [id, settle, setPaintedDeck, setOpenedDeck, setRefused, setFailure])

  useEffect(() => {
    if (aside === 0) return
    let live = true
    void connect(memoryRemote())
      .openDeck(id)
      .then((next) => {
        if (live && next.ok) reconcile(next.register)
      })
    return () => {
      live = false
    }
  }, [aside, id])

  useEffect(
    () => () => {
      pictures.current?.release()
      pictures.current = null
    },
    [pictures],
  )
}
