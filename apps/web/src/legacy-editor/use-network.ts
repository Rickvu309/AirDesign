import { connect, flushOriginal } from "@airdesign/live"
import { useEffect } from "react"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import { resendPending } from "@/deck-resend"

export type NetworkDeck = {
  readonly id: string
  readonly settle: (outcome: CommitOutcome) => void
  readonly leftNetwork: () => void
  readonly online: boolean
  readonly offline: boolean
  readonly pending: boolean
}

export function useNetwork(deck: NetworkDeck) {
  const { id, settle, leftNetwork: left } = deck
  const unsent = deck.online && deck.offline && deck.pending
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
  useEffect(() => {
    if (!unsent) return
    const leaving = new AbortController()
    async function resend() {
      const answered = await resendPending(() => flushPending(connect, id), settle, leaving.signal)
      if (answered !== undefined) await flushOriginal(id)
    }
    void resend()
    return () => leaving.abort()
  }, [id, settle, unsent])
}
