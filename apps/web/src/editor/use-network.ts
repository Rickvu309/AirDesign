import { connect, flushOriginal } from "@airdesign/live"
import { useEffect } from "react"
import { flushPending, type CommitOutcome } from "@/commit-edit"

export function useNetwork(id: string, settle: (outcome: CommitOutcome) => void, left: () => void) {
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
