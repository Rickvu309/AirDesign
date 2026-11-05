import { readFile, writeFile } from "node:fs/promises"
import { parseDeck } from "../packages/deck/src/parse.ts"
import { snapshot } from "../packages/render/src/server.ts"
const [file, output, origin = "http://127.0.0.1:41732"] = process.argv.slice(2)
if (!file || !output) throw new Error("Usage: snapshot-render deck.json output.png [local-origin]")
const deck = parseDeck(JSON.parse(await readFile(file, "utf8")))
const slide = deck.slides[0]
if (!slide) throw new Error("Deck is empty")
await writeFile(output, await snapshot({ deck, slideId: slide.id, origin }))
process.stdout.write(`${JSON.stringify({ output, deckId: deck.id, slideId: slide.id, version: slide.version })}\n`)
