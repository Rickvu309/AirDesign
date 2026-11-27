import { doomRoutes, viewTools } from "@airdesign/catalog"
import type { DoomRemote } from "@airdesign/live"
import type { ChatHost } from "./chat-host"

const viewOnly = { ok: false, refusal: "session" } as const

function released<Answer>(answer: Promise<Answer>, signal: AbortSignal | undefined): Promise<Answer> {
  if (signal === undefined) return answer
  return new Promise((resolve, reject) => {
    const stop = () => reject(new DOMException("The view stopped waiting", "AbortError"))
    if (signal.aborted) stop()
    signal.addEventListener("abort", stop, { once: true })
    answer.then(resolve, reject).finally(() => signal.removeEventListener("abort", stop))
  })
}

export function chatDoomRemote(chat: Pick<ChatHost, "callTool">): DoomRemote {
  return {
    create: async () => viewOnly,
    edit: async () => viewOnly,
    open: async (body) => doomRoutes.open.result(await chat.callTool(viewTools.open, body)),
    since: async (body, signal) =>
      doomRoutes.since.result(await released(chat.callTool(viewTools.since, body), signal)),
    screenshots: async (body) => doomRoutes.screenshots.result(await chat.callTool(viewTools.screenshots, body)),
  }
}
