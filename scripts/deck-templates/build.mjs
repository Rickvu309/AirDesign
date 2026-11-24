import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { storedZip } from "../stored-zip.mjs"
import { deckParts } from "./deck-parts.mjs"
import editorial from "./editorial.mjs"
import midnight from "./midnight.mjs"
import neutral from "./neutral.mjs"

export const templateSpecs = [neutral, midnight, editorial]

export const templateDeck = (spec, options) => storedZip(deckParts(spec, options))

const templateFolder = new URL("./files/", import.meta.url)

export const templateUrl = (id, start = false) => new URL(`${id}${start ? "-start" : ""}.pptx`, templateFolder)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(templateFolder, { recursive: true })
  for (const spec of templateSpecs) {
    fs.writeFileSync(templateUrl(spec.id), templateDeck(spec))
    fs.writeFileSync(templateUrl(spec.id, true), templateDeck(spec, { start: true }))
  }
}
