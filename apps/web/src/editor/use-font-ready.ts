import { waitForFonts } from "@airdesign/render"
import { useLayoutEffect, useState } from "react"

export function useFontReady(deck: string | undefined): string | undefined {
  const [ready, setReady] = useState<string | undefined>(undefined)
  useLayoutEffect(() => {
    if (deck === undefined) return
    let current = true
    void waitForFonts(document).then(() => {
      if (current) setReady(deck)
    })
    return () => {
      current = false
    }
  }, [deck])
  return ready === deck ? ready : undefined
}
