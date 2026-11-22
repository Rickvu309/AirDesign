import { scene } from "@airdesign/document"

function mixed(text: string): number {
  let high = 0xdeadbeef
  let low = 0x41c6ce57
  for (let at = 0; at < text.length; at += 1) {
    const code = text.charCodeAt(at)
    high = Math.imul(high ^ code, 2654435761)
    low = Math.imul(low ^ code, 1597334677)
  }
  high = Math.imul(high ^ (high >>> 16), 2246822507) ^ Math.imul(low ^ (low >>> 13), 3266489909)
  low = Math.imul(low ^ (low >>> 16), 2246822507) ^ Math.imul(high ^ (high >>> 13), 3266489909)
  return 4294967296 * (2097151 & low) + (high >>> 0)
}

export const shortHash = (text: string): string => mixed(text).toString(36).padStart(11, "0")

export type OnceIds = {
  readonly client: string
  readonly run: string
  readonly mint: () => scene.NodeId
}

export function onceIds(once: string): OnceIds {
  const hash = shortHash(once)
  const client = `m${hash}`
  let counter = 0
  return { client, run: `r${hash}`, mint: () => scene.nodeId(`${client}:${(counter += 1)}`) }
}
