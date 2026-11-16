import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseSync } from "oxc-parser"
import { cacheRoot, specKey, topics } from "./check-specs.mjs"

const whole = "*"

const declaredNames = (statement) => {
  const declaration =
    statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration"
      ? statement.declaration
      : statement
  if (!declaration) return []
  if (declaration.type === "VariableDeclaration") {
    return declaration.declarations.filter((each) => each.id.type === "Identifier").map((each) => each.id.name)
  }
  return declaration.id?.name ? [declaration.id.name] : []
}

export const declarations = (file, source) => {
  const found = new Map()
  for (const statement of parseSync(file, source).program.body) {
    for (const name of declaredNames(statement)) {
      found.set(name, [...(found.get(name) ?? []), source.slice(statement.start, statement.end)])
    }
  }
  return found
}

const textsOf = (file, source, names) => {
  if (names.length === 1 && names[0] === whole) return { texts: [source], missing: [] }
  const found = declarations(file, source)
  return {
    texts: names.map((name) => (found.get(name) ?? []).join("\0")),
    missing: names.filter((name) => !found.has(name)),
  }
}

const digestOf = (texts) => createHash("sha256").update(texts.join("\0")).digest("hex").slice(0, 12)

const git = (root, args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: "pipe" }).trim()

const blobText = (root, blob) => {
  try {
    return execFileSync("git", ["cat-file", "blob", blob], { cwd: root, encoding: "utf8", stdio: "pipe" })
  } catch {
    return null
  }
}

export const coverOf = (root, file, names, source = fs.readFileSync(path.join(root, file), "utf8")) => {
  const { texts, missing } = textsOf(file, source, names)
  if (missing.length > 0) throw new Error(`${missing.join(", ")} is not a top-level declaration in ${file}.`)
  const blob = execFileSync("git", ["hash-object", "--stdin"], { cwd: root, input: source, encoding: "utf8" }).trim()
  return { file, names, digest: digestOf(texts), blob }
}

const coversFile = (root, spec) => path.join(root, "specs", spec, "covers.json")

export const coveredSpecs = (root) =>
  fs
    .readdirSync(path.join(root, "specs"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(coversFile(root, entry.name)))
    .map((entry) => entry.name)
    .sort()

export const readCovers = (root, spec) => JSON.parse(fs.readFileSync(coversFile(root, spec), "utf8"))

const changedNames = (root, cover, source) => {
  if (cover.names[0] === whole) return cover.names
  const before = blobText(root, cover.blob)
  if (before === null) return cover.names
  const was = declarations(cover.file, before)
  const now = declarations(cover.file, source)
  const moved = cover.names.filter((name) => (was.get(name) ?? []).join("\0") !== (now.get(name) ?? []).join("\0"))
  return moved.length > 0 ? moved : cover.names
}

const movedCover = (root, spec, check, cover, read) => {
  const source = read(cover.file)
  const entry = { spec, check, file: cover.file, blob: cover.blob }
  if (source === null) return { ...entry, names: cover.names, reason: "missing-file" }
  const { texts, missing } = textsOf(cover.file, source, cover.names)
  if (missing.length > 0) return { ...entry, names: missing, reason: "missing-name" }
  if (digestOf(texts) === cover.digest) return null
  return { ...entry, names: changedNames(root, cover, source), reason: "changed" }
}

const workingFile = (root) => (file) => {
  const full = path.join(root, file)
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null
}

export const drifted = (root) =>
  coveredSpecs(root).flatMap((spec) => {
    const { check, covers } = readCovers(root, spec)
    return covers.map((cover) => movedCover(root, spec, check, cover, workingFile(root))).filter(Boolean)
  })

export const movedSince = (root, ref) =>
  coveredSpecs(root).filter((spec) =>
    readCovers(root, spec).covers.some((cover) => {
      const was = blobText(root, `${ref}:${cover.file}`)
      const now = workingFile(root)(cover.file)
      if (was === null || now === null) return was !== now
      const before = textsOf(cover.file, was, cover.names)
      const after = textsOf(cover.file, now, cover.names)
      return digestOf(before.texts) !== digestOf(after.texts) || before.missing.join() !== after.missing.join()
    }),
  )

const shownNames = (names) => (names[0] === whole ? "" : `${names.join(", ")} in `)

export const driftLines = (moved) => {
  const lines = []
  const specs = [...new Set(moved.map((entry) => entry.spec))]
  for (const spec of specs) {
    const own = moved.filter((entry) => entry.spec === spec)
    for (const entry of own) {
      const where = `${shownNames(entry.names)}${entry.file}`
      if (entry.reason === "changed") {
        lines.push(`spec-sync ${spec}: ${where} changed since the spec was synced.`)
        lines.push(`  What moved: git diff ${entry.blob} ${entry.file}`)
      } else {
        lines.push(`spec-sync ${spec}: ${where} no longer exists. Rename it in specs/${spec}/covers.json.`)
      }
    }
    if (own.some((entry) => entry.reason === "changed")) {
      lines.push(
        `  Read .agents/skills/verify-airdesign-formal/${own[0].check}, replay the model against the code (pnpm check:specs ${spec}, then its replay test), then run node scripts/spec-sync.mjs --sync ${spec}.`,
      )
    }
  }
  return lines
}

const printWidth = 120

export const coversText = ({ check, covers }) => {
  const lines = ["{", `  "check": ${JSON.stringify(check)},`, '  "covers": [']
  covers.forEach((cover, index) => {
    const inline = `      "names": [${cover.names.map((name) => JSON.stringify(name)).join(", ")}],`
    const names =
      inline.length <= printWidth
        ? [inline]
        : [
            '      "names": [',
            ...cover.names.map(
              (name, at) => `        ${JSON.stringify(name)}${at < cover.names.length - 1 ? "," : ""}`,
            ),
            "      ],",
          ]
    lines.push(
      "    {",
      `      "file": ${JSON.stringify(cover.file)},`,
      ...names,
      `      "digest": ${JSON.stringify(cover.digest)},`,
      `      "blob": ${JSON.stringify(cover.blob)}`,
      index < covers.length - 1 ? "    }," : "    }",
    )
  })
  lines.push("  ]", "}", "")
  return lines.join("\n")
}

export const syncSpec = (root, spec, { cache = cacheRoot() } = {}) => {
  const topic = topics(root).find((each) => each.name === spec)
  if (!topic) throw new Error(`spec-sync: no spec named ${spec}.`)
  const resultFile = path.join(cache, `${specKey(topic.topic, topic.spec, topic.config)}.json`)
  const result = fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile, "utf8")) : null
  if (result?.passed !== true) {
    throw new Error(`spec-sync ${spec}: no passing TLC result for this spec. Run pnpm check:specs ${spec} first.`)
  }
  const { check, covers } = readCovers(root, spec)
  const synced = covers.map((cover) => {
    try {
      return coverOf(root, cover.file, cover.names)
    } catch (error) {
      throw new Error(`spec-sync ${spec}: ${error.message}`)
    }
  })
  fs.writeFileSync(coversFile(root, spec), coversText({ check, covers: synced }))
  return `synced ${spec} at ${git(root, ["rev-parse", "--short", "HEAD"])}`
}

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const root = path.resolve(path.dirname(self), "..")
  const [mode, value] = process.argv.slice(2)
  try {
    if (mode === "--sync") console.log(syncSpec(root, value))
    else if (mode === "--since") console.log(movedSince(root, value).join("\n"))
    else if (mode !== undefined) throw new Error(`spec-sync takes --sync <spec> or --since <ref>, not ${mode}.`)
    else {
      const moved = drifted(root)
      for (const line of driftLines(moved)) console.log(line)
      const specs = coveredSpecs(root).length
      const movedSpecs = new Set(moved.map((entry) => entry.spec)).size
      console.log(`spec-sync: ${specs - movedSpecs} specs in step, ${movedSpecs} moved.`)
      if (moved.length > 0) process.exit(1)
    }
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
