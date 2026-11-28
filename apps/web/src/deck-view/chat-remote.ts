import { doomRoutes, viewMedia, viewTools } from "@airdesign/catalog"
import type { DoomRemote } from "@airdesign/live"
import type { AssetSource } from "@/editing/use-asset-urls"
import type { ChatHost } from "./chat-host"

const viewOnly = { ok: false, refusal: "session" } as const

export function chatDoomRemote(chat: Pick<ChatHost, "callTool">): DoomRemote {
  return {
    create: async () => viewOnly,
    edit: async () => viewOnly,
    open: async (body) => doomRoutes.open.result(await chat.callTool(viewTools.open, body)),
    since: async (body, signal) => doomRoutes.since.result(await chat.callTool(viewTools.since, body, signal)),
    screenshots: async (body) => doomRoutes.screenshots.result(await chat.callTool(viewTools.screenshots, body)),
  }
}

const bytesOf = (data: string) => Uint8Array.from(atob(data), (char) => char.charCodeAt(0))

async function chatImage(chat: Pick<ChatHost, "callTool">, deck: string, sha256: string) {
  try {
    const read = viewMedia.result(await chat.callTool(viewTools.media, { deck, sha256 }))
    return read.ok && read.sha256 === sha256 ? [[sha256, bytesOf(read.data)] as const] : []
  } catch {
    return []
  }
}

function dataUrl(bytes: Uint8Array, type: string): string {
  let binary = ""
  for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000))
  return `data:${type};base64,${btoa(binary)}`
}

export function chatAssets(chat: Pick<ChatHost, "callTool">): AssetSource {
  return {
    read: async (deck, hashes) =>
      new Map((await Promise.all(hashes.map((sha256) => chatImage(chat, deck, sha256)))).flat()),
    url: dataUrl,
  }
}
