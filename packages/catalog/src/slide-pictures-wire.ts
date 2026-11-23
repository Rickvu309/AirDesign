import { readSlideId, type SlideId } from "@airdesign/document"
import { limits } from "@airdesign/doom"
import { knownKeys, recordOf } from "./wire.js"

export const pictureBytes = 600_000

export const pictureType = "image/jpeg"

export type SlideKey<Id extends string = SlideId> = { readonly slide: Id; readonly key: string }

export type SlidePicture<Id extends string = SlideId> = SlideKey<Id> & {
  readonly type: typeof pictureType
  readonly data: string
}

export type SlidePictures<Id extends string = SlideId> = {
  readonly keys: readonly SlideKey<Id>[]
  readonly images: readonly SlidePicture<Id>[]
}

type ReadSlide<Id extends string> = (raw: unknown) => Id | undefined

const keyPattern = /^[0-9a-f]{64}$/
const base64 = /^[A-Za-z0-9+/]+={0,2}$/

function readKey<Id extends string>(raw: unknown, readSlide: ReadSlide<Id>): SlideKey<Id> | undefined {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["slide", "key"])) return undefined
  const slide = readSlide(body.slide)
  const key = typeof body.key === "string" && keyPattern.test(body.key) ? body.key : undefined
  return slide === undefined || key === undefined ? undefined : { slide, key }
}

function readImage<Id extends string>(
  raw: unknown,
  keys: ReadonlyMap<Id, string>,
  readSlide: ReadSlide<Id>,
): SlidePicture<Id> | undefined {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["slide", "key", "type", "data"])) return undefined
  const read = readKey({ slide: body.slide, key: body.key }, readSlide)
  if (read === undefined || keys.get(read.slide) !== read.key || body.type !== pictureType) return undefined
  const { data } = body
  if (typeof data !== "string" || data.length > pictureBytes || !base64.test(data)) return undefined
  return { ...read, type: pictureType, data }
}

export function readSlidePictures<Id extends string = SlideId>(
  raw: unknown,
  readSlide: ReadSlide<Id> = readSlideId as unknown as ReadSlide<Id>,
): SlidePictures<Id> | undefined {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["keys", "images"])) return undefined
  const { keys: rawKeys, images: rawImages } = body
  if (!Array.isArray(rawKeys) || !Array.isArray(rawImages) || rawKeys.length > limits.slides) return undefined
  const keyed = new Map<Id, string>()
  for (const row of rawKeys as unknown[]) {
    const read = readKey(row, readSlide)
    if (read === undefined || keyed.has(read.slide)) return undefined
    keyed.set(read.slide, read.key)
  }
  const images: SlidePicture<Id>[] = []
  for (const row of rawImages as unknown[]) {
    const read = readImage(row, keyed, readSlide)
    if (read === undefined || images.some((each) => each.slide === read.slide)) return undefined
    images.push(read)
  }
  return { keys: [...keyed].map(([slide, key]) => ({ slide, key })), images }
}
