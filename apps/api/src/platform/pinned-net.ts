import { lookup } from "node:dns/promises"
import { request } from "node:https"
import { BlockList, isIP } from "node:net"

export type Resolved = { readonly address: string; readonly family: 4 | 6 }

export type NetAnswer = {
  readonly status: number
  readonly location: string | undefined
  readonly length: number | undefined
  readonly body: AsyncIterable<Uint8Array>
  readonly cancel: () => void
}

export type PinnedNet = {
  readonly resolve: (host: string) => Promise<readonly Resolved[]>
  readonly get: (url: URL, at: Resolved, signal: AbortSignal) => Promise<NetAnswer>
}

const unreachable = new BlockList()
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  unreachable.addSubnet(net, prefix, "ipv4")
for (const [net, prefix] of [
  ["::", 96],
  ["::ffff:0:0:0", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const)
  unreachable.addSubnet(net, prefix, "ipv6")

export function publicAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 0) return false
  return !unreachable.check(address, family === 4 ? "ipv4" : "ipv6")
}

export async function pinnedAddress(url: URL, net: PinnedNet): Promise<Resolved | "private" | "unreachable"> {
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1")
  const literal = isIP(host)
  const found = literal === 0 ? await net.resolve(host) : [{ address: host, family: literal === 6 ? 6 : 4 } as const]
  const [first] = found
  if (first === undefined) return "unreachable"
  return found.every((each) => publicAddress(each.address)) ? first : "private"
}

export async function collected(answer: NetAnswer, cap: number): Promise<Uint8Array | null> {
  const chunks: Uint8Array[] = []
  let total = 0
  for await (const chunk of answer.body) {
    total += chunk.byteLength
    if (total >= cap) {
      answer.cancel()
      return null
    }
    chunks.push(chunk)
  }
  const bytes = new Uint8Array(total)
  let at = 0
  for (const chunk of chunks) {
    bytes.set(chunk, at)
    at += chunk.byteLength
  }
  return bytes
}

function header(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0]
}

type Found = (error: Error | null, address: string | readonly Resolved[], family?: number) => void

export function pinnedNet(accept: string, agent: string): PinnedNet {
  return {
    resolve: async (host) =>
      (await lookup(host, { all: true, verbatim: true })).map((each): Resolved => ({
        address: each.address,
        family: each.family === 6 ? 6 : 4,
      })),
    get: (url, at, signal) =>
      new Promise((answered, failed) => {
        const pinnedLookup = (_host: string, options: { readonly all?: boolean }, found: Found) => {
          if (options.all === true) found(null, [at])
          else found(null, at.address, at.family)
        }
        const asked = request(
          url,
          {
            method: "GET",
            signal,
            headers: { accept, "user-agent": agent },
            lookup: pinnedLookup as never,
          },
          (response) => {
            const length = Number(header(response.headers["content-length"]))
            answered({
              status: response.statusCode ?? 0,
              location: header(response.headers.location),
              length: Number.isSafeInteger(length) ? length : undefined,
              body: response,
              cancel: () => response.destroy(),
            })
          },
        )
        asked.on("error", failed)
        asked.end()
      }),
  }
}
