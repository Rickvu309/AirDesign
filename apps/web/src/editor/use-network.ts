import { connect, flushOriginal } from "@airdesign/live"
import { useEffect } from "react"
import { flushPending, type CommitOutcome } from "@/commit-edit"

export type NetworkDeck = {
  readonly id: string
  readonly settle: (outcome: CommitOutcome) => void
  readonly leftNetwork: () => void
}

export function useNetwork(deck: NetworkDeck) {
  const { id, settle, leftNetwork: left } = deck
  useEffect(() => {
    async function returnedToNetwork() {
      settle(await flushPending(connect, id))
      await flushOriginal(id)
    }
    window.addEventListener("offline", left)
    window.addEventListener("online", returnedToNetwork)
    return () => {
      window.removeEventListener("offline", left)
      window.removeEventListener("online", returnedToNetwork)
    }
  }, [id, settle, left])
}
