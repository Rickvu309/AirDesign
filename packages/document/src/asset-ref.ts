import { mediaTypes, type MediaType } from "@airdesign/doom"

export type Media = { readonly sha256: string; readonly type: MediaType }

const sha = /^[0-9a-f]{64}$/

export function assetMedia(ref: string): Media | null {
  const [mime, hash, ...extra] = ref.split(":")
  const type = mediaTypes.find((each) => each === mime)
  return type !== undefined && hash !== undefined && extra.length === 0 && sha.test(hash)
    ? { type, sha256: hash }
    : null
}

const iconNamePattern = "^[a-z0-9]+(?:-[a-z0-9]+)*$"

const iconName = new RegExp(iconNamePattern)
const iconLength = 64

export function readAsset(raw: unknown): string | null {
  return typeof raw === "string" ? assetIcon(raw) : null
}

export function assetIcon(ref: string): string | null {
  return ref.length <= iconLength && iconName.test(ref) ? ref : null
}
