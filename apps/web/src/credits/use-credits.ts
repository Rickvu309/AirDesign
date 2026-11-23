import { useEffect, useRef, useState } from "react"
import { showStatus } from "@/components/ui/page-notice"
import { creditsCopy } from "@/copy/credits-copy"
import { signInAddress } from "@/account/sign-in-address"
import { changeCredits, loadCredits, type CreditsChange, type CreditsLoad } from "@/credits/credits-load"

function failure(result: CreditsLoad): string {
  if (result.kind !== "refused") return creditsCopy.changeFailed
  if (result.refusal === "credits") return creditsCopy.insufficient
  if (result.refusal === "open") return creditsCopy.active
  if (result.refusal === "empty") return creditsCopy.empty
  return creditsCopy.changeFailed
}

export function useCredits(onReset: () => Promise<void>) {
  const [loaded, setLoaded] = useState<CreditsLoad | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [reset, setReset] = useState<string | null>(null)
  const pending = useRef(false)
  const revision = useRef(0)

  function keep(result: CreditsLoad) {
    if (result.kind === "signed-out") window.location.assign(signInAddress(window.location))
    else setLoaded(result)
  }

  async function refresh() {
    if (pending.current) return
    const current = ++revision.current
    const result = await loadCredits()
    if (revision.current === current) keep(result)
  }

  useEffect(() => {
    void refresh()
    const focused = () => void refresh()
    window.addEventListener("focus", focused)
    return () => {
      revision.current++
      window.removeEventListener("focus", focused)
    }
  }, [])

  async function change(command: CreditsChange) {
    if (pending.current) return
    pending.current = true
    revision.current++
    setBusy(true)
    setError("")
    const result = await changeCredits(command)
    if (result.kind === "credits") {
      keep(result)
      if (command.kind === "reset") {
        setReset(null)
        await onReset()
        showStatus(creditsCopy.done, "credits-reset", 5000)
      }
    } else if (result.kind === "signed-out") keep(result)
    else setError(failure(result))
    pending.current = false
    setBusy(false)
    if (result.kind === "refused") {
      await refresh()
      await onReset()
    }
  }

  return {
    loaded,
    busy,
    error,
    reset,
    refresh,
    change,
    openReset: () => {
      setError("")
      setReset(crypto.randomUUID())
    },
    closeReset: () => {
      if (!pending.current) {
        setReset(null)
        setError("")
      }
    },
  }
}
