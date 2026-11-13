import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { corpusInputs } from "./pptx-corpus.mjs"

const markupPart = (name) => name.endsWith(".xml") || name.endsWith(".rels")

export const parsePercent = ({ parsed, markup }) => (markup === 0 ? 0 : Math.round((100 * parsed) / markup))

const loadPptx = async (root) => {
  const entry = path.join(root, "packages/pptx/dist/index.js")
  if (!fs.existsSync(entry)) throw new Error("packages/pptx is not built. Run pnpm build, then run this again.")
  const pptx = await import(pathToFileURL(entry).href)
  const require = createRequire(path.join(root, "packages/pptx/package.json"))
  const wasm = fs.realpathSync(require.resolve("sax-wasm/lib/sax-wasm.wasm"))
  const { SAXParser } = await import(pathToFileURL(path.join(path.dirname(wasm), "esm/index.js")).href)
  await pptx.prepareMarkup(new Uint8Array(fs.readFileSync(wasm)))
  return { pptx, parser: SAXParser.prototype }
}

export const importParse = async (root) => {
  const { pptx, parser } = await loadPptx(root)
  const fixtures = path.join(root, "scripts/pptx-fixtures")
  const decks = corpusInputs(root).fixed
  if (decks.length === 0) throw new Error("scripts/pptx-fixtures holds no real deck to import.")
  const write = parser.write
  let parsed = 0
  let markup = 0
  parser.write = function counted(chunk) {
    parsed += chunk.length
    return write.call(this, chunk)
  }
  try {
    for (const name of decks) {
      const read = await pptx.readPackage(new Uint8Array(fs.readFileSync(path.join(fixtures, name))))
      if (!read.ok) throw new Error(`${name} did not import: ${read.reason}`)
      pptx.indexPackage(read.parts)
      for (const [part, data] of read.parts) if (markupPart(part)) markup += data.length
    }
  } finally {
    parser.write = write
  }
  if (parsed === 0) throw new Error("the import parsed no markup, so the count is not reaching the parser.")
  return parsePercent({ parsed, markup })
}
