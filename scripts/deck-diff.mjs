import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const self = fileURLToPath(import.meta.url)
const root = path.resolve(path.dirname(self), "..")
const usage = "node scripts/deck-diff.mjs original.pptx export.pptx [--allow <part>]... [--json] [--limit 200]"

export const deckDiffArgs = (argv) => {
  const files = []
  const allow = []
  let json = false
  let limit = 200
  for (let index = 0; index < argv.length; index += 1) {
    const word = argv[index]
    if (word === "--json") json = true
    else if (word === "--allow" || word === "--limit") {
      const value = argv[index + 1]
      if (value === undefined) throw new Error(`${word} needs a value. Usage: ${usage}`)
      index += 1
      if (word === "--allow") allow.push(value)
      else {
        limit = Number(value)
        if (!Number.isInteger(limit) || limit < 0)
          throw new Error(`--limit must be a whole number, and it is ${value}.`)
      }
    } else if (word.startsWith("--")) throw new Error(`Unknown flag ${word}. Usage: ${usage}`)
    else files.push(word)
  }
  if (files.length !== 2) throw new Error(`Give two files. Usage: ${usage}`)
  return { before: files[0], after: files[1], allow: argv.includes("--allow") ? allow : null, json, limit }
}

const built = (name) => {
  const entry = path.join(root, "packages", name, "dist/index.js")
  if (!fs.existsSync(entry)) throw new Error(`packages/${name} is not built. Run pnpm build, then run this again.`)
  return import(pathToFileURL(entry).href)
}

const bytes = (count) => `${count.toLocaleString("en-US")} bytes`

export const deckDiffReport = (pptx, before, after, { allow, limit, names }) => {
  const found = pptx.deckDiff(before, after)
  const parts = found.changed.map((part) => pptx.partDiff(part, before.get(part), after.get(part), limit))
  const allowed = new Set(allow ?? [])
  const outside = [
    ...[...found.changed, ...found.added, ...found.removed].filter((part) => !allowed.has(part)),
    ...(found.orderMoved ? ["part order"] : []),
  ]
  const lines = [
    `deck-diff ${names.before} -> ${names.after}: ${found.changed.length} changed, ${found.added.length} added, ` +
      `${found.removed.length} removed, ${found.same} byte-identical, part order ${found.orderMoved ? "moved" : "kept"}`,
  ]
  for (const part of parts) {
    lines.push(`changed ${part.part} (${part.before.toLocaleString("en-US")} -> ${bytes(part.after)})`)
    let at = ""
    for (const line of part.lines) {
      if (line.at !== at) lines.push(`  ${line.at}`)
      at = line.at
      lines.push(`  ${line.op} ${line.text}`)
    }
    if (part.more > 0) lines.push(`  and ${part.more} more`)
  }
  for (const part of found.added) lines.push(`added ${part} (${bytes(after.get(part).length)})`)
  for (const part of found.removed) lines.push(`removed ${part} (${bytes(before.get(part).length)})`)
  if (allow !== null) lines.push(`outside --allow: ${outside.length === 0 ? "none" : outside.join(", ")}`)
  const failed = allow !== null && outside.length > 0
  return { found, parts, outside: allow === null ? [] : outside, lines, failed }
}

const main = async () => {
  const args = deckDiffArgs(process.argv.slice(2))
  const pptx = await built("pptx")
  const read = (file) => pptx.readParts(new Uint8Array(fs.readFileSync(file)))
  const report = deckDiffReport(pptx, await read(args.before), await read(args.after), {
    allow: args.allow,
    limit: args.limit,
    names: { before: path.basename(args.before), after: path.basename(args.after) },
  })
  const { found, parts, outside, failed } = report
  process.stdout.write(
    args.json ? `${JSON.stringify({ ...found, parts, outside }, null, 2)}\n` : `${report.lines.join("\n")}\n`,
  )
  process.exitCode = failed ? 1 : 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 2
  })
}
