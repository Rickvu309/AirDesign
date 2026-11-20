import { onlyKeys, record } from "./plain-object.js"

export const mediaTypes = ["image/png", "image/jpeg", "image/gif"] as const

export type MediaType = (typeof mediaTypes)[number]

export type Media = { readonly sha256: string; readonly type: MediaType }

const sha = /^[0-9a-f]{64}$/

export function assetMedia(ref: string): Media | null {
  const [mime, hash, ...extra] = ref.split(":")
  const type = mediaTypes.find((each) => each === mime)
  return type !== undefined && hash !== undefined && extra.length === 0 && sha.test(hash)
    ? { type, sha256: hash }
    : null
}

export const iconNamePattern = "^[a-z0-9]+(?:-[a-z0-9]+)*$"

const iconName = new RegExp(iconNamePattern)
const iconLength = 64

export function readAsset(raw: unknown): string | null {
  return typeof raw === "string" ? assetIcon(raw) : null
}

export function assetIcon(ref: string): string | null {
  return ref.length <= iconLength && iconName.test(ref) ? ref : null
}

export function readMedia(raw: unknown): Media | undefined {
  const row = record(raw)
  if (row === null || !onlyKeys(row, ["sha256", "type"])) return undefined
  if (typeof row.sha256 !== "string" || !sha.test(row.sha256)) return undefined
  const type = mediaTypes.find((each) => each === row.type)
  return type === undefined ? undefined : { sha256: row.sha256, type }
}
