import { readSlideId, type SlideId } from "@airdesign/document"
import { readSlides } from "@airdesign/pptx"

type Parts = ReadonlyMap<string, Uint8Array>

export type KeyedSlide = { readonly slide: SlideId; readonly key: string }

type HeldKey = {
  readonly slide: Uint8Array | undefined
  readonly rels: Uint8Array | undefined
  readonly media: string
  readonly key: string
}

export type SlideKeys = {
  template: readonly (Uint8Array | undefined)[]
  templateKey: string
  slides: Map<string, HeldKey>
}

export const templatePart = /^ppt\/(slideLayouts|slideMasters|theme)\/[^/]+\.xml$/

const mediaTarget = /Target="[^"]*?media\/([^"/]+)"/g

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function slideKeyCache(): SlideKeys {
  return { template: [], templateKey: "", slides: new Map() }
}

export function relsOf(part: string): string {
  const at = part.lastIndexOf("/")
  return `${part.slice(0, at)}/_rels/${part.slice(at + 1)}.rels`
}

export function templateOf(exported: Parts): readonly (Uint8Array | undefined)[] {
  return [...exported.keys()]
    .filter((name) => templatePart.test(name))
    .sort()
    .map((name) => exported.get(name))
}

export function sameParts(
  left: readonly (Uint8Array | undefined)[],
  right: readonly (Uint8Array | undefined)[],
): boolean {
  return left.length === right.length && left.every((bytes, at) => bytes === right[at])
}

function mediaOf(exported: Parts, rels: Uint8Array | undefined): string {
  if (rels === undefined) return ""
  const names = [...decoder.decode(rels).matchAll(mediaTarget)].map(([, name]) => `ppt/media/${name}`)
  return names.map((name) => `${name}:${exported.get(name)?.length ?? -1}`).join("|")
}

async function digest(chunks: readonly (Uint8Array | string | undefined)[]): Promise<string> {
  const pieces = chunks.map((chunk) =>
    typeof chunk === "string" ? encoder.encode(chunk) : (chunk ?? new Uint8Array()),
  )
  const joined = new Uint8Array(pieces.reduce((total, piece) => total + 8 + piece.length, 0))
  let at = 0
  for (const piece of pieces) {
    new DataView(joined.buffer).setFloat64(at, piece.length)
    joined.set(piece, at + 8)
    at += 8 + piece.length
  }
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", joined))
  return [...hash].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function slideKeys(exported: Parts, kept: SlideKeys): Promise<readonly KeyedSlide[]> {
  const template = templateOf(exported)
  if (!sameParts(template, kept.template) || kept.templateKey === "") {
    kept.template = template
    kept.templateKey = await digest(template)
    kept.slides = new Map()
  }
  const next = new Map<string, HeldKey>()
  const keys: KeyedSlide[] = []
  for (const source of readSlides(exported)) {
    const slide = readSlideId(source.slide)
    if (slide === undefined) continue
    const bytes = exported.get(source.part)
    const rels = exported.get(relsOf(source.part))
    const media = mediaOf(exported, rels)
    const held = kept.slides.get(source.part)
    const key =
      held !== undefined && held.slide === bytes && held.rels === rels && held.media === media
        ? held.key
        : await digest([kept.templateKey, source.slide, bytes, rels, media])
    next.set(source.part, { slide: bytes, rels, media, key })
    keys.push({ slide, key })
  }
  kept.slides = next
  return keys
}
