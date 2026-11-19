import { writtenFill, hostOf } from "./fill-host.js"
import { writtenStack } from "./fill-stack.js"
import { decodeUtf8 } from "./package-bytes.js"
import { partBytes } from "./part-markup.js"
import { blipMarkup, declaresRelationships, installedPicture, linkedSource } from "./picture-write.js"
import type { ElementAt, Parts } from "./xml-codec.js"

export function bakedFill(parts: Parts, at: ElementAt, png: Uint8Array, sha256: string): Parts {
  const host = hostOf(parts, at)
  if (host === "pic") return writtenStack(writtenFill(installedPicture(parts, at, png), at, null), at, null)
  const next = new Map(parts)
  const linked = linkedSource(next, at.part, { media: { sha256, type: "image/png" }, bytes: png })
  const declared = declaresRelationships(decodeUtf8(partBytes(next, at.part)))
  const xml = `<a:blipFill rotWithShape="1">${blipMarkup(linked, declared)}<a:stretch><a:fillRect/></a:stretch></a:blipFill>`
  const painted = writtenFill(next, at, { tag: "a:blipFill", xml })
  return host === "bg" ? painted : writtenStack(painted, at, null)
}
