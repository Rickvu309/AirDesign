import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

export const browserExportTag = "@export"

const exportName = /^exported-[a-z0-9-]+\.pptx$/
const specFile = /^tests\/browser\/[a-z0-9-]+\.spec\.ts$/
const fieldKey = /^[a-z]+\.[a-zA-Z]+$/

export const casesFolder = (root) => path.join(root, "scripts/pptx-cases")

export const caseProblems = (file, entry) => {
  const problems = []
  const say = (what) => problems.push(`scripts/pptx-cases/${file} ${what}`)
  if (!Array.isArray(entry.specs) || entry.specs.length === 0 || !entry.specs.every((spec) => specFile.test(spec))) {
    say("needs specs: the tests/browser/*.spec.ts files that write its exports.")
  }
  if (
    !Array.isArray(entry.exports) ||
    entry.exports.length === 0 ||
    !entry.exports.every((name) => exportName.test(name))
  ) {
    say("needs exports: the exported-*.pptx files its specs write into tests/browser.")
  }
  if (typeof entry.lines !== "function") say("needs lines: a function from the answers to the failure lines.")
  if (
    entry.covers !== undefined &&
    (!Array.isArray(entry.covers) || !entry.covers.every((key) => fieldKey.test(key)))
  ) {
    say("has covers that is not a list of trait fields, such as box.x.")
  }
  for (const key of ["cases", "renders"]) {
    if (entry[key] !== undefined && !Array.isArray(entry[key])) say(`has ${key} that is not a list.`)
  }
  return problems
}

export const caseSpecs = (entries) => [...new Set(entries.flatMap((entry) => entry.specs))].sort()
export const caseExports = (entries) => entries.flatMap((entry) => entry.exports)
export const browserExportArgs = (entries) => [...caseSpecs(entries), "--grep", browserExportTag]

export const loadCases = async (root) => {
  const folder = casesFolder(root)
  const files = fs
    .readdirSync(folder)
    .filter((name) => name.endsWith(".mjs") && !name.endsWith(".test.mjs"))
    .sort()
  const entries = await Promise.all(
    files.map(async (file) => ({
      file,
      ...(await import(pathToFileURL(path.join(folder, file)).href)).default,
    })),
  )
  const problems = entries.flatMap((entry) => caseProblems(entry.file, entry))
  const seen = new Set()
  for (const entry of entries) {
    for (const name of entry.exports ?? []) {
      if (seen.has(name)) problems.push(`scripts/pptx-cases/${entry.file} writes ${name}, which another case writes.`)
      seen.add(name)
    }
  }
  if (problems.length > 0) throw new Error(problems.join("\n"))
  return entries
}
