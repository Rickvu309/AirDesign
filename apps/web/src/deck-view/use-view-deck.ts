import { httpDoomRemote, memoryStorage, openDoomDeck, type DoomDeck } from "@airdesign/live"
import { useEffect, useState } from "react"

export type ViewOpening =
  | { readonly status: "loading" }
  | { readonly status: "missing" }
  | { readonly status: "ready"; readonly deck: DoomDeck }

const remote = httpDoomRemote()

export function useViewDeck(id: string): ViewOpening {
  const [opening, setOpening] = useState<ViewOpening>({ status: "loading" })
  useEffect(() => {
    let current = true
    const stop = new AbortController()
    void openDoomDeck(remote, id, { storage: memoryStorage() }).then((opened) => {
      if (!current) return
      if (!opened.ok) {
        setOpening({ status: "missing" })
        return
      }
      void opened.deck.follow(stop.signal).then((followed) => {
        if (current && followed === "gone") setOpening({ status: "missing" })
      })
      setOpening({ status: "ready", deck: opened.deck })
    })
    return () => {
      current = false
      stop.abort()
    }
  }, [id])
  return opening
}
