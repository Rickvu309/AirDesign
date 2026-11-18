declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
  getBuiltinModule(name: "node:crypto"): {
    createHash(name: "sha256"): { update(bytes: Uint8Array): { digest(encoding: "hex"): string } }
  }
}
import { elementId, slideId, type Media } from "@airdesign/document"
import { expect, it } from "vitest"
import { orderedParts, readParts } from "./index.js"

const { readFileSync } = process.getBuiltinModule("node:fs")
const { createHash } = process.getBuiltinModule("node:crypto")
const folder = `${process.cwd()}/scripts/pptx-fixtures`
const png = new Uint8Array(readFileSync(`${folder}/picture.png`))
const jpeg = new Uint8Array(readFileSync(`${folder}/picture.jpeg`))
const centred = { x: 3810000, y: 1905000, cx: 4572000, cy: 3048000 }
const corner = { x: 914400, y: 914400, cx: 2286000, cy: 1524000 }

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex")
}

function add(shape: number, media: Media, box: typeof centred) {
  const node = elementId(`256.${String(shape)}`)
  const element = { node, kind: "shape" as const, value: null, box, grouped: false }
  return { slide: "element-add" as const, id: slideId("256"), element, media }
}

async function expectWritten(before: string, after: string, order: ReturnType<typeof add>[], bytes = true) {
  const pngMedia = sha256(png)
  const jpegMedia = sha256(jpeg)
  const original = await readParts(readFileSync(`${folder}/${before}`))
  const written = orderedParts(original, { file: [slideId("256")], order }, (hash) =>
    !bytes ? undefined : hash === pngMedia ? png : hash === jpegMedia ? jpeg : undefined,
  )
  const fixture = await readParts(readFileSync(`${folder}/${after}`))
  expect([...written.keys()].sort()).toEqual([...fixture.keys()].sort())
  for (const [name, part] of fixture) expect(written.get(name), name).toEqual(part)
}

it("writes the same parts the validator judges in the added picture cases", async () => {
  const pngMedia: Media = { sha256: sha256(png), type: "image/png" }
  const jpegMedia: Media = { sha256: sha256(jpeg), type: "image/jpeg" }
  await expectWritten("blank.pptx", "picture-png.pptx", [add(4, pngMedia, centred)])
  await expectWritten("blank.pptx", "picture-jpeg.pptx", [add(4, jpegMedia, centred)])
  await expectWritten("picture-png.pptx", "pictures-jpeg.pptx", [add(5, jpegMedia, corner)])
  await expectWritten("blank.pptx", "picture-missing.pptx", [add(4, pngMedia, centred)], false)
})
