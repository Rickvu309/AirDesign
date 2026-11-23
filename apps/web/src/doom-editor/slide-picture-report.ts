import { pictureType, type SlidePictures } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"

const assetPattern = /^[0-9a-f]{64}$/

export async function slideKey(view: doom.Doom, slide: doom.NodeId): Promise<string> {
  const bytes = new TextEncoder().encode(doom.slideKeyText(view, slide))
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function unresolvedAssets(
  view: doom.Doom,
  slide: doom.NodeId,
  assetUrl: (asset: string) => string | undefined,
): readonly string[] {
  const found = new Set<string>()
  const walk = (id: doom.NodeId) => {
    const fills = (view.nodes.get(id) as { readonly fills?: readonly doom.Paint[] } | undefined)?.fills ?? []
    for (const paint of fills)
      if (paint.kind === "image" && assetPattern.test(paint.asset) && assetUrl(paint.asset) === undefined)
        found.add(paint.asset)
    for (const child of view.children.get(id) ?? []) walk(child)
  }
  walk(slide)
  return [...found]
}

type Pictures = SlidePictures

export async function reportSlidePictures(args: {
  readonly view: doom.Doom
  readonly send: (pictures: Pictures) => Promise<readonly doom.NodeId[] | null>
  readonly capture: (slide: doom.NodeId) => Promise<string | null>
  readonly ready: (slide: doom.NodeId) => boolean
  readonly current: () => boolean
}): Promise<boolean> {
  const { view, send, capture, ready, current } = args
  const slides = doom.slidesOf(view).map((slide) => slide.id)
  const keys = await Promise.all(slides.map(async (slide) => ({ slide, key: await slideKey(view, slide) })))
  const asked = new Set<doom.NodeId>()
  let missing = await send({ keys, images: [] })
  while (missing !== null && current()) {
    const slide = missing.find((each) => !asked.has(each) && ready(each))
    if (slide === undefined) return true
    asked.add(slide)
    const data = await capture(slide)
    if (data === null || !current()) continue
    const key = keys.find((each) => each.slide === slide)?.key
    if (key === undefined) continue
    missing = await send({ keys, images: [{ slide, key, type: pictureType, data }] })
  }
  return missing !== null
}
