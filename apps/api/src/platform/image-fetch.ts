import { limits, mediaSize, mediaTypeOf, overPixelLimit, type MediaType } from "@airdesign/doom"
import { collected, pinnedAddress, pinnedNet, type PinnedNet } from "./pinned-net.js"

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

export const imageWait = 10_000

export const nodeNet = pinnedNet("image/png, image/jpeg, image/gif", "AirDesign-image-fetch/1")

const longestAddress = 2048
const redirects = 3
const moved: ReadonlySet<number> = new Set([301, 302, 303, 307, 308])

export function imageAddress(raw: string): URL | null {
  if (raw.length > longestAddress || !URL.canParse(raw)) return null
  const url = new URL(raw)
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.port !== "") return null
  return url.hostname === "" ? null : url
}

const refused = (refusal: FetchRefusal): FetchedImage => ({ ok: false, refusal })

async function fetched(start: URL, net: PinnedNet, cap: number, signal: AbortSignal): Promise<FetchedImage> {
  let url = start
  for (let hop = 0; hop <= redirects; hop += 1) {
    const at = await pinnedAddress(url, net)
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
  net: PinnedNet = nodeNet,
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
