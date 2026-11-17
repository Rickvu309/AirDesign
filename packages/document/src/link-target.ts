import { readSlideId, type SlideId } from "./element-id.js"
import { record } from "./plain-object.js"

export type LinkTarget =
  | { readonly kind: "url"; readonly url: string }
  | { readonly kind: "slide"; readonly slide: SlideId }
export type LinkEdit = LinkTarget | { readonly kind: "none" }

export function readLinkTarget(raw: unknown): LinkEdit | null {
  const value = record(raw)
  if (value === null) return null
  const keys = Object.keys(value)
  if (value.kind === "none" && keys.length === 1) return { kind: "none" }
  if (keys.length !== 2) return null
  if (value.kind === "slide") {
    const slide = readSlideId(value.slide)
    return slide === undefined ? null : { kind: "slide", slide }
  }
  if (value.kind !== "url" || typeof value.url !== "string" || value.url.length > 2048) return null
  if (/[\u0000-\u0020\u007f]/.test(value.url)) return null
  if (!/^(https?:\/\/[^/?#]+|mailto:[^?]+)([/?#].*)?$/i.test(value.url)) return null
  return { kind: "url", url: value.url }
}

export type ElementLink = LinkEdit | { readonly kind: "unsupported" }

export function readElementLink(raw: unknown): ElementLink | null {
  const value = record(raw)
  return value?.kind === "unsupported" && Object.keys(value).length === 1
    ? { kind: "unsupported" }
    : readLinkTarget(raw)
}
