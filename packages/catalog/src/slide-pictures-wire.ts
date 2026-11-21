import { limits, readSlideId, type SlideId } from "@airdesign/document"
import { knownKeys, recordOf } from "./wire.js"

export const pictureBytes = 600_000

export const pictureType = "image/jpeg"

export type SlideKey = { readonly slide: SlideId; readonly key: string }

export type SlidePicture = SlideKey & { readonly type: typeof pictureType; readonly data: string }

export type SlidePictures = { readonly keys: readonly SlideKey[]; readonly images: readonly SlidePicture[] }

const keyPattern = /^[0-9a-f]{64}$/
const base64 = /^[A-Za-z0-9+/]+={0,2}$/

function readKey(raw: unknown): SlideKey | undefined {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["slide", "key"])) return undefined
  const slide = readSlideId(body.slide)
  const key = typeof body.key === "string" && keyPattern.test(body.key) ? body.key : undefined
  return slide === undefined || key === undefined ? undefined : { slide, key }
}

function readImage(raw: unknown, keys: ReadonlyMap<SlideId, string>): SlidePicture | undefined {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["slide", "key", "type", "data"])) return undefined
  const read = readKey({ slide: body.slide, key: body.key })
  if (read === undefined || keys.get(read.slide) !== read.key || body.type !== pictureType) return undefined
  const { data } = body
  if (typeof data !== "string" || data.length > pictureBytes || !base64.test(data)) return undefined
  return { ...read, type: pictureType, data }
}

export function readSlidePictures(raw: unknown): SlidePictures | undefined {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["keys", "images"])) return undefined
  const { keys: rawKeys, images: rawImages } = body
  if (!Array.isArray(rawKeys) || !Array.isArray(rawImages) || rawKeys.length > limits.slides) return undefined
  const keyed = new Map<SlideId, string>()
  for (const row of rawKeys as unknown[]) {
    const read = readKey(row)
    if (read === undefined || keyed.has(read.slide)) return undefined
    keyed.set(read.slide, read.key)
  }
  const images: SlidePicture[] = []
  for (const row of rawImages as unknown[]) {
    const read = readImage(row, keyed)
    if (read === undefined || images.some((each) => each.slide === read.slide)) return undefined
    images.push(read)
  }
  return { keys: [...keyed].map(([slide, key]) => ({ slide, key })), images }
}
