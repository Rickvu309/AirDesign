import { webImage } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"

import { told, type Answer } from "./answer.js"
import { imagesPerCall } from "./budget.js"

export type ImageRefusal =
  | "address"
  | "private"
  | "unreachable"
  | "status"
  | "type"
  | "size"
  | "timeout"
  | "unknown"
  | "absent"
  | "many"
  | "full"
  | "store"

export type NamedImage =
  | { readonly ok: true; readonly asset: string; readonly width?: number; readonly height?: number }
  | { readonly ok: false; readonly refusal: ImageRefusal }

export type NamedImages = ReadonlyMap<string, NamedImage>

const imageReasons = {
  address: "it is not an https address on the default port with no user name.",
  private: "it leads to a private or local network, which AirDesign never fetches.",
  unreachable: "its server could not be reached, or it redirected more than three times.",
  status: "its server did not answer with the file.",
  type: "the file is not a PNG, JPEG or GIF. WebP and SVG are not taken yet.",
  size: "the file is 10 MB or more, or the image is over 40 megapixels.",
  timeout: "its server did not send the file within 10 seconds.",
  unknown: "it is neither an https address nor an asset read from this deck.",
  absent: "this deck holds no picture with that hash.",
  many: `the call names more than ${String(imagesPerCall)} images. Send the rest in another call.`,
  full: "the deck is at its storage limit. Tell the person.",
  store: "the file could not be stored. Try again later.",
} as const satisfies Record<ImageRefusal, string>

const storedAsset = /^[0-9a-f]{64}$/

const usable = (name: string) => webImage(name) || storedAsset.test(name)

function imageOf(intent: doom.Intent): string | undefined {
  if (!("op" in intent) || (intent.op !== "add" && intent.op !== "set")) return undefined
  const fill = intent.fill
  return typeof fill === "object" && "image" in fill ? fill.image : undefined
}

export function imageNames(intents: readonly doom.Intent[]): readonly string[] {
  return [...new Set(intents.flatMap((intent) => imageOf(intent) ?? []).filter(usable))]
}

export function pictureSizes(
  images: NamedImages,
): ReadonlyMap<string, { readonly width: number; readonly height: number }> {
  return new Map(
    [...images.values()].flatMap((image) =>
      image.ok && image.width !== undefined && image.height !== undefined
        ? [[image.asset, { width: image.width, height: image.height }] as const]
        : [],
    ),
  )
}

export function withAssets(intents: readonly doom.Intent[], images: NamedImages): readonly doom.Intent[] {
  return intents.map((intent) => {
    const address = imageOf(intent)
    const found = address === undefined ? undefined : images.get(address)
    return found?.ok === true && "fill" in intent ? { ...intent, fill: { image: found.asset } } : intent
  })
}

export function imageProblem(intents: readonly doom.Intent[], images: NamedImages | undefined): Answer | undefined {
  const lines = intents.flatMap((intent, at) => {
    const address = imageOf(intent)
    if (address === undefined) return []
    if (!usable(address))
      return [`Change ${String(at + 1)}: ${JSON.stringify(address)} was not used because ${imageReasons.unknown}`]
    if (images === undefined) return []
    const found = images.get(address)
    if (found?.ok === true) return []
    const reason = found === undefined ? "it was not fetched." : imageReasons[found.refusal]
    return [`Change ${String(at + 1)}: ${JSON.stringify(address)} was not used because ${reason}`]
  })
  if (lines.length === 0) return undefined
  return told(false, { ok: false, refusal: "field", field: "fill", note: lines.join("\n") })
}
