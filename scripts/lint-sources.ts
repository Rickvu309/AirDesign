import { deckInvariantHits } from "./lint/deck-invariants.ts"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { nodeRuntimeSyntaxHits } from "./lint/node-runtime-syntax.ts"
import { commentHits } from "./lint/comment-rule.ts"
import { importBoundaryHits } from "./lint/import-boundary.ts"
import { accessSafetyHits } from "./lint/access-safety.ts"
import { gateRecordingHits } from "./lint/gate-recording.ts"
import { responseHeaderHits } from "./lint/response-headers.ts"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".css"])
const skipped = new Set(["node_modules", "dist", "coverage", "docs", "fixtures"])

const files = await collect(repoRoot)
const failures: string[] = []
for (const file of files) {
  const source = await readFile(file, "utf8")
  for (const hit of deckInvariantHits(file, source)) failures.push(`${path.relative(repoRoot, file)}:${hit.line} ${hit.reason}`)
  for (const hit of commentHits(file, source)) {
    failures.push(`${path.relative(repoRoot, file)}:${hit.line} comment`)
  }
  if (file.endsWith(".css")) {
    continue
  }
  for (const hit of importBoundaryHits(file, source, repoRoot)) {
    failures.push(`${path.relative(repoRoot, file)}:${hit.line} ${hit.reason} ${hit.specifier}`)
  }
  for (const hit of nodeRuntimeSyntaxHits(file, source)) {
    failures.push(`${path.relative(repoRoot, file)}:${hit.line} ${hit.reason}`)
  }
  for (const hit of responseHeaderHits(source)) {
    failures.push(`${path.relative(repoRoot, file)}:${hit.line} ${hit.reason}`)
  }
  for (const hit of accessSafetyHits(file, source)) {
    failures.push(`${path.relative(repoRoot, file)}:${hit.line} ${hit.reason}`)
  }
  for (const hit of gateRecordingHits(file, source)) {
    failures.push(`${path.relative(repoRoot, file)}:${hit.line} ${hit.reason}`)
  }
}
if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`)
  process.exit(1)
}

async function collect(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (skipped.has(entry.name) || entry.name.startsWith(".")) {
      continue
    }
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collect(full))
      continue
    }
    if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(full)
    }
  }
  return files
}
