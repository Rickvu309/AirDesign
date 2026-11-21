import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const unreplayed = {
  "painted-edits":
    "the forced-gap traces run in design-change.test.ts and editable-slide.test.tsx, without a graph walk",
}

const testFolders = ["tests", "apps", "packages"]

const testFiles = (folder) => {
  if (!fs.existsSync(folder)) return []
  const found = []
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue
    const full = path.join(folder, entry.name)
    if (entry.isDirectory()) found.push(...testFiles(full))
    else if (/\.test\.(ts|tsx|mjs)$/.test(entry.name)) found.push(full)
  }
  return found
}

export const replays = (root, reasons = unreplayed) => {
  const specs = path.join(root, "specs")
  const names = fs
    .readdirSync(specs, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  const files = testFolders.flatMap((folder) => testFiles(path.join(root, folder)))
  const texts = files.map((file) => ({ file: path.relative(root, file), text: fs.readFileSync(file, "utf8") }))
  return names.map((name) => {
    const by = texts
      .filter(({ text }) => text.includes(`specGraph("${name}"`) || text.includes(`topic.name === "${name}"`))
      .map(({ file }) => file)
    return { name, by, reason: reasons[name] ?? null }
  })
}

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const root = path.resolve(path.dirname(self), "..")
  let missing = false
  for (const { name, by, reason } of replays(root)) {
    if (by.length > 0) console.log(`${name} replayed by ${by.join(", ")}`)
    else if (reason !== null) console.log(`${name} has no replay: ${reason}`)
    else {
      console.log(
        `${name} has no replay against the code. Drive its edges through the real functions in a test, or list it in unreplayed in scripts/spec-replays.mjs with the reason.`,
      )
      missing = true
    }
  }
  if (missing) process.exit(1)
}
