import {
  createDoomDeck,
  httpDoomRemote,
  openDoomDeck,
  type DoomDeck,
  type DoomRemote,
  type DoomStorage,
} from "@airdesign/live"
import type * as doom from "@airdesign/doom"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { discardOpening } from "@/decks/discard-opening"
import { clearOpeningDeck, noteOpeningDeck } from "@/lib/first-request"

export type EditorClient = Pick<
  DoomDeck,
  | "deck"
  | "view"
  | "server"
  | "pending"
  | "mint"
  | "push"
  | "undo"
  | "redo"
  | "undoRun"
  | "reportScreenshots"
  | "reportSelection"
  | "screenshotsWanted"
  | "subscribe"
  | "status"
  | "caught"
  | "notices"
  | "clearNotices"
>

export type Opening =
  | { readonly status: "loading" }
  | { readonly status: "missing" }
  | { readonly status: "ready"; readonly deck: DoomDeck; readonly id: string }

export type OpenOptions = {
  readonly remote?: DoomRemote
  readonly storage?: DoomStorage
  readonly mint?: () => string
  readonly arrived?: (id: string) => void
  readonly measure?: () => doom.Measure | null
}

const sharedRemote = httpDoomRemote()

export function useDoomDeck(id: string | null, options: OpenOptions = {}): Opening {
  const [opening, setOpening] = useState<Opening>({ status: "loading" })
  const remote = options.remote ?? sharedRemote
  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })
  useEffect(() => {
    let current = true
    const stop = new AbortController()
    const fresh = id === null
    const mint = latest.current.mint ?? crypto.randomUUID.bind(crypto)
    const storage = latest.current.storage
    const deck = id ?? mint()
    if (fresh) noteOpeningDeck(deck)
    const kept = {
      ...(storage === undefined ? {} : { storage }),
      measure: () => latest.current.measure?.() ?? null,
    }
    void (fresh ? createDoomDeck(remote, deck, kept) : openDoomDeck(remote, deck, kept)).then((opened) => {
      if (!current) {
        if (fresh) void discardOpening(deck)
        return
      }
      if (!opened.ok) {
        setOpening({ status: "missing" })
        return
      }
      if (fresh) {
        latest.current.arrived?.(deck)
        clearOpeningDeck()
      }
      void opened.deck.sync()
      void opened.deck.follow(stop.signal).then((followed) => {
        if (current && followed === "gone") setOpening({ status: "missing" })
      })
      setOpening({ status: "ready", deck: opened.deck, id: deck })
    })
    return () => {
      current = false
      stop.abort()
    }
  }, [id, remote])
  return opening
}

export function useDoomView(client: Pick<DoomDeck, "view" | "subscribe">) {
  return useSyncExternalStore(client.subscribe, client.view)
}
