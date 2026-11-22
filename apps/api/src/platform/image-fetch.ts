import { lookup } from "node:dns/promises"
import { request } from "node:https"
import { BlockList, isIP } from "node:net"
import { limits, mediaSize, mediaTypeOf, overPixelLimit, type MediaType } from "@airdesign/document"

export type FetchRefusal = "address" | "private" | "unreachable" | "status" | "type" | "size" | "timeout"

export type FetchedImage =
  | {
      readonly ok: true
      readonly bytes: Uint8Array
      readonly type: MediaType
      readonly width: number
      readonly height: number
    }
  | { readonly ok: false; readonly refusal: FetchRefusal }

export type Resolved = { readonly address: string; readonly family: 4 | 6 }

export type ImageAnswer = {
  readonly status: number
  readonly location: string | undefined
  readonly length: number | undefined
  readonly body: AsyncIterable<Uint8Array>
  readonly cancel: () => void
}

export type ImageNet = {
  readonly resolve: (host: string) => Promise<readonly Resolved[]>
  readonly get: (url: URL, at: Resolved, signal: AbortSignal) => Promise<ImageAnswer>
}

export const imageWait = 10_000

const longestAddress = 2048
const redirects = 3
const moved: ReadonlySet<number> = new Set([301, 302, 303, 307, 308])

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

export function imageAddress(raw: string): URL | null {
  if (raw.length > longestAddress || !URL.canParse(raw)) return null
  const url = new URL(raw)
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.port !== "") return null
  return url.hostname === "" ? null : url
}

const refused = (refusal: FetchRefusal): FetchedImage => ({ ok: false, refusal })

async function pinned(url: URL, net: ImageNet): Promise<Resolved | FetchRefusal> {
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1")
  const literal = isIP(host)
  const found = literal === 0 ? await net.resolve(host) : [{ address: host, family: literal === 6 ? 6 : 4 } as const]
  const [first] = found
  if (first === undefined) return "unreachable"
  return found.every((each) => publicAddress(each.address)) ? first : "private"
}

async function collected(answer: ImageAnswer, cap: number): Promise<Uint8Array | null> {
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

async function fetched(start: URL, net: ImageNet, cap: number, signal: AbortSignal): Promise<FetchedImage> {
  let url = start
  for (let hop = 0; hop <= redirects; hop += 1) {
    const at = await pinned(url, net)
    if (typeof at === "string") return refused(at)
    const answer = await net.get(url, at, signal)
    if (moved.has(answer.status) && answer.location !== undefined) {
      answer.cancel()
      const next = URL.canParse(answer.location, url.href)
        ? imageAddress(new URL(answer.location, url.href).href)
        : null
      if (next === null) return refused("address")
      url = next
      continue
    }
    if (answer.status !== 200) {
      answer.cancel()
      return refused("status")
    }
    if (answer.length !== undefined && answer.length >= cap) {
      answer.cancel()
      return refused("size")
    }
    const bytes = await collected(answer, cap)
    if (bytes === null) return refused("size")
    const type = mediaTypeOf(bytes)
    const size = mediaSize(bytes)
    if (type === null || size === null) return refused("type")
    return overPixelLimit(size) ? refused("size") : { ok: true, bytes, type, ...size }
  }
  return refused("unreachable")
}

export async function fetchImage(
  raw: string,
  net: ImageNet = nodeNet,
  bounds: { readonly wait?: number; readonly cap?: number } = {},
): Promise<FetchedImage> {
  const url = imageAddress(raw)
  if (url === null) return refused("address")
  const signal = AbortSignal.timeout(bounds.wait ?? imageWait)
  try {
    return await fetched(url, net, bounds.cap ?? limits.media, signal)
  } catch {
    return refused(signal.aborted ? "timeout" : "unreachable")
  }
}

function header(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0]
}

type Found = (error: Error | null, address: string | readonly Resolved[], family?: number) => void

export const nodeNet: ImageNet = {
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
          headers: { accept: "image/png, image/jpeg, image/gif", "user-agent": "AirDesign-image-fetch/1" },
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
