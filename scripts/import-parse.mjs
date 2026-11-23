import fs from "node:fs"
import path from "node:path"
import { corpusInputs } from "./pptx-corpus.mjs"
import { packageBuild } from "./package-build.mjs"

const markupPart = (name) => name.endsWith(".xml") || name.endsWith(".rels")

export const parsePercent = ({ parsed, markup }) => (markup === 0 ? 0 : Math.round((100 * parsed) / markup))

const loadPptx = (root) => packageBuild(root, "@airdesign/pptx")

export const importParse = async (root) => {
  const pptx = await loadPptx(root)
  const fixtures = path.join(root, "scripts/pptx-fixtures")
  const decks = corpusInputs(root).fixed
  if (decks.length === 0) throw new Error("scripts/pptx-fixtures holds no real deck to import.")
  const before = pptx.markupBytesRead()
  let markup = 0
  for (const name of decks) {
    const read = await pptx.readPackage(new Uint8Array(fs.readFileSync(path.join(fixtures, name))))
    if (!read.ok) throw new Error(`${name} did not import: ${read.reason}`)
    pptx.indexPackage(read.parts)
    for (const [part, data] of read.parts) if (markupPart(part)) markup += data.length
  }
  const parsed = pptx.markupBytesRead() - before
  if (parsed === 0) throw new Error("the import parsed no markup, so the count is not reaching the parser.")
  return parsePercent({ parsed, markup })
}
