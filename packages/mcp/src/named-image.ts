import { webImage } from "@airdesign/catalog"
import type { scene } from "@airdesign/document"

import type { ToolResult } from "./answer.js"

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

export type NamedImage =
  | { readonly ok: true; readonly asset: string }
  | { readonly ok: false; readonly refusal: ImageRefusal }

export type NamedImages = ReadonlyMap<string, NamedImage>

export const imagesPerCall = 10

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

function imageOf(change: scene.AgentChange): string | undefined {
  if (!("op" in change) || (change.op !== "add" && change.op !== "set")) return undefined
  const fill = change.fill
  return typeof fill === "object" && webImage(fill.image) ? fill.image : undefined
}

export function imageAddresses(changes: readonly scene.AgentChange[]): readonly string[] {
  return [...new Set(changes.flatMap((change) => imageOf(change) ?? []))]
}

export function withAssets(changes: readonly scene.AgentChange[], images: NamedImages): readonly scene.AgentChange[] {
  return changes.map((change) => {
    const address = imageOf(change)
    const found = address === undefined ? undefined : images.get(address)
    return found?.ok === true && "fill" in change ? { ...change, fill: { image: found.asset } } : change
  })
}

export function imageProblem(changes: readonly scene.AgentChange[], images: NamedImages): ToolResult | undefined {
  const lines = changes.flatMap((change, at) => {
    const address = imageOf(change)
    if (address === undefined) return []
    const found = images.get(address)
    if (found?.ok === true) return []
    const reason = found === undefined ? "it was not fetched." : imageReasons[found.refusal]
    return [`Change ${String(at + 1)}: ${JSON.stringify(address)} was not used because ${reason}`]
  })
  if (lines.length === 0) return undefined
  const answer = { ok: false, refusal: "field", field: "fill", because: lines }
  return {
    ok: false,
    content: [
      { type: "text", text: lines.join("\n") },
      { type: "text", text: JSON.stringify(answer) },
    ],
    answer,
  }
}
