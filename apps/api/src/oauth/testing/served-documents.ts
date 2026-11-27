import type { PinnedNet, Resolved } from "../../platform/pinned-net.js"

export type Page = {
  readonly status: number
  readonly location?: string
  readonly length?: number
  readonly body?: Uint8Array
  readonly hang?: true
}

export type Asked = { readonly url: string; readonly at: string }

export function documentBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value))
}

function never(signal: AbortSignal): Promise<never> {
  return new Promise((_, failed) => {
    signal.addEventListener("abort", () => failed(new Error("aborted")), { once: true })
  })
}

export function servedDocuments(hosts: Readonly<Record<string, readonly string[] | "hang">>) {
  const pages = new Map<string, Page>()
  const asked: Asked[] = []
  const net: PinnedNet = {
    resolve: async (host) => {
      const found = hosts[host]
      if (found === "hang") return new Promise<never>(() => {})
      if (found === undefined) throw new Error("no such host")
      return found.map((address): Resolved => ({ address, family: address.includes(":") ? 6 : 4 }))
    },
    get: async (url, at, signal) => {
      asked.push({ url: url.href, at: at.address })
      const page = pages.get(url.href) ?? { status: 404 }
      if (page.hang === true) return never(signal)
      const body = page.body ?? new Uint8Array()
      return {
        status: page.status,
        location: page.location,
        length: page.length,
        body: (async function* () {
          yield body
        })(),
        cancel: () => {},
      }
    },
  }
  return { net, pages, asked }
}
