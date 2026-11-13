import { readFileSync, readdirSync } from "node:fs"
import { createRequire } from "node:module"
import { basename, join } from "node:path"
import * as pptx from "../../packages/pptx/dist/index.js"
import { resolvedSlide } from "./resolved-paint.mts"

const root = join(import.meta.dirname, "../..")
const fixtures = join(root, "scripts/pptx-fixtures")
const paths = [
  ...readdirSync(fixtures).map((name) => join(fixtures, name)),
  ...readdirSync(join(fixtures, "corpus")).map((name) => join(fixtures, "corpus", name)),
].filter((path) => path.endsWith(".pptx"))
const prepare = (pptx as { prepareMarkup?: (wasm: Uint8Array) => Promise<void> }).prepareMarkup
if (prepare !== undefined) {
  const wasm = createRequire(join(root, "packages/pptx/package.json")).resolve("sax-wasm/lib/sax-wasm.wasm")
  await prepare(new Uint8Array(readFileSync(wasm)))
}
const decks = []
for (const path of paths) {
  const parts = await pptx.readParts(new Uint8Array(readFileSync(path)))
  const reader = pptx.paintReader(parts)
  decks.push({
    name: basename(path),
    path,
    slides: pptx.readSlides(parts).map(({ part }) => resolvedSlide(part, reader.slide(part))),
  })
}
process.stdout.write(JSON.stringify(decks))
