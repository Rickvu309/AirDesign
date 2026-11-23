import type { DeckStatus } from "@airdesign/live"
import { useEffect, useSyncExternalStore } from "react"
import type { SaveStatus } from "@/editor/save-status"
import type { ThinNotice } from "./thin-notice"
import type { EditorClient } from "./use-doom-deck"

export type Saving = { readonly status: DeckStatus; readonly online: boolean }
export type SaveShown = { readonly notice: ThinNotice | null; readonly save: SaveStatus }

export const setAsideMilliseconds = 10_000

export function saveShown({ status, online }: Saving): SaveShown {
  if (status.kind === "saved" || status.kind === "saving") return { notice: null, save: status.kind }
  if (status.kind === "offline" && !online) return { notice: "offline", save: "offline" }
  if (status.kind === "offline" || status.kind === "blocked") return { notice: "unreached", save: "unreached" }
  const notice = status.tooLarge ? "set-aside-too-large" : status.edits === 1 ? "set-aside-one" : "set-aside"
  return { notice, save: "unsaved" }
}

function watchNetwork(change: () => void): () => void {
  window.addEventListener("online", change)
  window.addEventListener("offline", change)
  return () => {
    window.removeEventListener("online", change)
    window.removeEventListener("offline", change)
  }
}

const browserOnline = () => navigator.onLine !== false

export function useSaveShown(
  client: Pick<EditorClient, "status" | "subscribe" | "clearNotices">,
  sample?: Saving,
): SaveShown {
  const status = useSyncExternalStore(client.subscribe, client.status)
  const online = useSyncExternalStore(watchNetwork, browserOnline)
  const aside = sample === undefined && status.kind === "set-aside" ? status : null
  useEffect(() => {
    if (aside === null) return
    const clear = window.setTimeout(() => client.clearNotices(), setAsideMilliseconds)
    return () => window.clearTimeout(clear)
  }, [aside, client])
  return saveShown(sample ?? { status, online })
}
