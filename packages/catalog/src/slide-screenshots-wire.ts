import { limits, readNodeId, type NodeId } from "@airdesign/doom"
import { knownKeys, recordOf } from "./wire.js"

export const screenshotBytes = 600_000

export const screenshotType = "image/jpeg"

export type SlideKey = { readonly slide: NodeId; readonly key: string }

export type SlideScreenshot = SlideKey & {
  readonly type: typeof screenshotType
  readonly data: string
}

export type SlideScreenshots = {
  readonly keys: readonly SlideKey[]
  readonly images: readonly SlideScreenshot[]
  readonly fontFailures?: readonly SlideKey[]
}

const keyPattern = /^[0-9a-f]{64}$/
const base64 = /^[A-Za-z0-9+/]+={0,2}$/

function readKey(raw: unknown): SlideKey | undefined {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["slide", "key"])) return undefined
  const slide = readNodeId(body.slide)
  const key = typeof body.key === "string" && keyPattern.test(body.key) ? body.key : undefined
  return slide === undefined || key === undefined ? undefined : { slide, key }
}

function readImage(raw: unknown, keys: ReadonlyMap<NodeId, string>): SlideScreenshot | undefined {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["slide", "key", "type", "data"])) return undefined
  const read = readKey({ slide: body.slide, key: body.key })
  if (read === undefined || keys.get(read.slide) !== read.key || body.type !== screenshotType) return undefined
  const { data } = body
  if (typeof data !== "string" || data.length > screenshotBytes || !base64.test(data)) return undefined
  return { ...read, type: screenshotType, data }
}

export function readSlideScreenshots(raw: unknown): SlideScreenshots | undefined {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["keys", "images", "fontFailures"])) return undefined
  const { keys: rawKeys, images: rawImages } = body
  if (!Array.isArray(rawKeys) || !Array.isArray(rawImages) || rawKeys.length > limits.slides) return undefined
  const keyed = new Map<NodeId, string>()
  for (const row of rawKeys as unknown[]) {
    const read = readKey(row)
    if (read === undefined || keyed.has(read.slide)) return undefined
    keyed.set(read.slide, read.key)
  }
  const images: SlideScreenshot[] = []
  for (const row of rawImages as unknown[]) {
    const read = readImage(row, keyed)
    if (read === undefined || images.some((each) => each.slide === read.slide)) return undefined
    images.push(read)
  }
  const fontFailures: SlideKey[] = []
  if (body.fontFailures !== undefined) {
    if (!Array.isArray(body.fontFailures) || body.fontFailures.length > keyed.size) return undefined
    const reported = new Set(images.map(({ slide }) => slide))
    for (const row of body.fontFailures) {
      const read = readKey(row)
      if (read === undefined || keyed.get(read.slide) !== read.key || reported.has(read.slide)) return undefined
      reported.add(read.slide)
      fontFailures.push(read)
    }
  }
  return {
    keys: [...keyed].map(([slide, key]) => ({ slide, key })),
    images,
    ...(fontFailures.length === 0 ? {} : { fontFailures }),
  }
}
