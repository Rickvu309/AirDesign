import { readAgentEdit, webImage, type AgentChange } from "@airdesign/catalog"
import type { ImageLookup, PlacedImage } from "@airdesign/engine"

export type ImageRefusal =
  | "address"
  | "private"
  | "unreachable"
  | "status"
  | "type"
  | "size"
  | "timeout"
  | "many"
  | "full"
  | "store"

export const imagesPerCall = 10

export type NamedImage = ({ readonly ok: true } & PlacedImage) | { readonly ok: false; readonly refusal: ImageRefusal }

export type NamedImages = ReadonlyMap<string, NamedImage>

const imageReasons = {
  address: "it is not an https address on the default port with no user name.",
  private: "it leads to a private or local network, which AirDesign never fetches.",
  unreachable: "its server could not be reached, or it redirected more than three times.",
  status: "its server did not answer with the file.",
  type: "the file is not a PNG, JPEG or GIF. WebP and SVG are not taken yet.",
  size: "the file is 10 MB or more, or the image is over 40 megapixels.",
  timeout: "its server did not send the file within 10 seconds.",
  many: `the call names more than ${String(imagesPerCall)} images. Send the rest in another call.`,
  full: "the deck is at its storage limit. Tell the person.",
  store: "the file could not be stored. Try again later.",
} as const satisfies Record<ImageRefusal, string>

const unfetched = "it was not fetched on this connection."

function changeAddresses(change: AgentChange): readonly string[] {
  if (!("op" in change)) return []
  if (change.op === "add") return "image" in change ? [change.image] : []
  if (change.op !== "set") return []
  const fills = change.fills
  const paint = fills?.paint
  const named = [
    fills?.source,
    typeof paint === "object" && paint !== null && "image" in paint ? paint.image : undefined,
  ]
  return named.filter((value): value is string => typeof value === "string" && webImage(value))
}

export function imageAddresses(raw: unknown): readonly string[] {
  const parsed = readAgentEdit(raw)
  return parsed.ok ? [...new Set(parsed.changes.flatMap(changeAddresses))] : []
}

export function imageProblem(changes: readonly AgentChange[], images: NamedImages | undefined): string | undefined {
  const lines = changes.flatMap((change, at) =>
    changeAddresses(change).flatMap((address) => {
      const found = images?.get(address)
      if (found?.ok === true) return []
      const reason = found === undefined ? unfetched : imageReasons[found.refusal]
      return [`Change ${String(at + 1)}: ${JSON.stringify(address)} was not used because ${reason}`]
    }),
  )
  return lines.length === 0 ? undefined : lines.join("\n")
}

export function imageLookup(images: NamedImages | undefined): ImageLookup {
  return (address) => {
    const found = images?.get(address)
    return found?.ok === true ? { media: found.media, width: found.width, height: found.height } : undefined
  }
}
