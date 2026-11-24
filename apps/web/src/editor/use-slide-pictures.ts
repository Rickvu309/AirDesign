import { useEffect, useRef } from "react"
import { captureSlide } from "./slide-capture"
import { reportSlidePictures, unresolvedAssets } from "./slide-picture-report"
import type { EditorClient } from "./use-deck"

export const quietFor = 1_000
export const retryAfter = 5_000
const idleWithin = 2_000

function idle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === "function") requestIdleCallback(() => resolve(), { timeout: idleWithin })
    else setTimeout(resolve, 0)
  })
}

export function useSlidePictures(
  client: Pick<EditorClient, "server" | "pending" | "reportPictures" | "subscribe" | "picturesWanted">,
  assetUrl: (asset: string) => string | undefined,
): void {
  const urls = useRef(assetUrl)
  const wake = useRef<() => void>(() => undefined)
  useEffect(() => {
    urls.current = assetUrl
    wake.current()
  }, [assetUrl])

  useEffect(() => {
    let live = true
    let running = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const run = async () => {
      if (running || client.pending().length > 0 || !client.picturesWanted()) return
      running = true
      const fold = client.server()
      let reached = false
      try {
        reached = await reportSlidePictures({
          view: fold,
          send: async (pictures) => {
            const answer = await client.reportPictures(fold.rev, pictures)
            return answer.ok ? answer.missing : null
          },
          capture: async (slide) => {
            await idle()
            return captureSlide(fold, slide, urls.current)
          },
          ready: (slide) => unresolvedAssets(fold, slide, urls.current).length === 0,
          current: () => live && client.server() === fold,
        })
      } catch {
        reached = false
      } finally {
        running = false
      }
      if (!live) return
      clearTimeout(timer)
      if (!client.picturesWanted()) return
      if (client.server() !== fold) timer = setTimeout(() => void run(), quietFor)
      else if (!reached) timer = setTimeout(() => void run(), retryAfter)
    }
    let asked = false
    const later = () => {
      if (!client.picturesWanted()) {
        asked = false
        clearTimeout(timer)
        return
      }
      clearTimeout(timer)
      timer = setTimeout(() => void run(), asked ? quietFor : 0)
      asked = true
    }
    wake.current = later
    later()
    const stop = client.subscribe(later)
    return () => {
      live = false
      wake.current = () => undefined
      clearTimeout(timer)
      stop()
    }
  }, [client])
}
