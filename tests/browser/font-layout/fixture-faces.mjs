import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { fontShelf, shelfFolder } from "../../../scripts/font-shelf.mjs"

export const manifest = JSON.parse(await readFile(new URL("./faces.json", import.meta.url)))
export const shelf = fontShelf(shelfFolder)

export function fixtureKey(source) {
  if (!source.startsWith("https://")) return undefined
  const [, , , revision, ...path] = new URL(source).pathname.split("/")
  return join("fonts", revision, decodeURIComponent(path.join("/")))
}

export function verifyFace({ source, sha256 }, bytes) {
  const actual = createHash("sha256").update(bytes).digest("hex")
  if (actual !== sha256) throw new Error(`Font fixture ${source}: expected ${sha256}, got ${actual}`)
  return bytes
}

export async function fixtureBytes(face) {
  const key = fixtureKey(face.source)
  const bytes = key ? await shelf.read(key) : await readFile(new URL("../../../" + face.source, import.meta.url))
  if (bytes === undefined)
    throw new Error(`Font fixture ${key} is missing. Run node tests/browser/font-layout/prepare-shelf.mjs`)
  return verifyFace(face, bytes)
}
