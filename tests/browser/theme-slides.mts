import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"
import * as document from "../../packages/document/dist/index.js"
import * as pptx from "../../packages/pptx/dist/index.js"
import { resolvedSlide } from "./resolved-paint.mts"

const root = join(import.meta.dirname, "../..")
const [deck = "", slot = "", hex = ""] = process.argv.slice(2)
const prepare = (pptx as { prepareMarkup?: (wasm: Uint8Array) => Promise<void> }).prepareMarkup
if (prepare !== undefined) {
  const wasm = createRequire(join(root, "packages/pptx/package.json")).resolve("sax-wasm/lib/sax-wasm.wasm")
  await prepare(new Uint8Array(readFileSync(wasm)))
}
const parts = await pptx.readParts(new Uint8Array(readFileSync(join(root, "scripts/pptx-fixtures", deck))))
let register = document.openRegister("", "theme")
for (const command of [
  { command: "add", node: document.themeNode, floor: "", route: "theme" },
  { command: "person", node: document.themeNode, v: document.format, patch: { theme: { [slot]: { set: hex } } } },
] as const) {
  const decision = document.decide(register, command)
  if (decision.decision === "refuse") throw new Error(decision.code)
  register = decision.register
}
const slides = (shown: ReadonlyMap<string, Uint8Array>) => {
  const reader = pptx.paintReader(shown)
  return pptx.readSlides(shown).map(({ part }) => resolvedSlide(part, reader.slide(part)))
}
process.stdout.write(JSON.stringify({ before: slides(parts), after: slides(pptx.exportParts(parts, register)) }))
