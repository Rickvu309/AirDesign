import { readFileSync } from "node:fs"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"
import path from "node:path"
import os from "node:os"
const directory = await mkdtemp(path.join(os.homedir(), "tmp", "deck-consumer-"))
try {
  const packed = spawnSync("npm", ["pack", "--workspace", "@airdesign/deck", "--pack-destination", directory, "--json"], { encoding: "utf8" })
  if (packed.status !== 0) throw new Error(packed.stderr)
  const [{ filename }] = JSON.parse(packed.stdout)
  const extracted = spawnSync("tar", ["-xzf", path.join(directory, filename), "-C", directory])
  if (extracted.status !== 0) throw new Error("Cannot unpack deck")
  const { apply, parseDeck, parseChangeSet, validate } = await import(pathToFileURL(path.join(directory, "package/dist/index.js")))
  const input = JSON.parse(process.argv[2] ? await readFile(process.argv[2], "utf8") : readFileSync(0, "utf8"))
  const deck = parseDeck(input.deck)
  validate(deck)
  const results = []
  let current = deck
  for (const value of input.changeSets ?? []) {
    const result = apply(current, parseChangeSet(value))
    results.push(result)
    if (result.ok) current = result.deck
  }
  process.stdout.write(`${JSON.stringify({ deck: current, results })}\n`)
} catch (error) {
  process.stdout.write(`${JSON.stringify({ ok: false, error: { code: "invalid-data", message: String(error), retryable: false, next: "Provide valid deck and ChangeSets JSON." } })}\n`)
  process.exitCode = 1
} finally { await rm(directory, { recursive: true, force: true }) }
