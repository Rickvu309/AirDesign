import { createSceneDeck, httpSceneRemote, openSceneDeck, type SceneDeck, type SceneRemote } from "@airdesign/live"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"

export type EditorClient = Pick<
  SceneDeck,
  | "deck"
  | "view"
  | "server"
  | "pending"
  | "mint"
  | "push"
  | "undo"
  | "redo"
  | "undoRun"
  | "reportPictures"
  | "subscribe"
>

export type Opening =
  | { readonly status: "loading" }
  | { readonly status: "missing" }
  | { readonly status: "ready"; readonly deck: SceneDeck; readonly id: string }

export type OpenOptions = {
  readonly remote?: SceneRemote
  readonly mint?: () => string
  readonly arrived?: (id: string) => void
}

const sharedRemote = httpSceneRemote()

export function useSceneDeck(id: string | null, options: OpenOptions = {}): Opening {
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
    const deck = id ?? mint()
    void (fresh ? createSceneDeck(remote, deck) : openSceneDeck(remote, deck)).then((opened) => {
      if (!current) return
      if (!opened.ok) {
        setOpening({ status: "missing" })
        return
      }
      if (fresh) latest.current.arrived?.(deck)
      void opened.deck.sync()
      void opened.deck.follow(stop.signal)
      setOpening({ status: "ready", deck: opened.deck, id: deck })
    })
    return () => {
      current = false
      stop.abort()
    }
  }, [id, remote])
  return opening
}

export function useSceneView(client: Pick<SceneDeck, "view" | "subscribe">) {
  return useSyncExternalStore(client.subscribe, client.view)
}
