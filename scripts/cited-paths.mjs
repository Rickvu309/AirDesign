import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { drifted } from "./spec-sync.mjs"

export const glossaryFile = "tooling/oxlint-plugin-airdesign/glossary.json"
export const pathListFiles = [".github/actions/ci-changes/pptx-paths.txt"]

const records = [/(^|\/)[\w-]*fixtures\//, /^docs\/adr\//, /^scripts\/red-main-drill\.mjs$/]
const code = /\.(?:[cm]?[jt]sx?|json)$/
const testCode = /\.(?:test|spec)\.[cm]?[jt]sx?$/
const bareExtensions = /^[\w.-]*[\w-]\.(?:ts|tsx|mts|mjs|js|cjs|tla|cfg|sql)$/
const fileExtension = /[\w-]\.[a-z]{1,5}$/
const notAPath = /[\s*<>{}$()[\]|=,;'"\\]|^(?:[a-z]+:|@|\/|~|-|\.\.?$)/

export const builtFolders = (gitignore) =>
  new Set(
    gitignore
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^[\w.-]+\/$/.test(line))
      .map((line) => line.slice(0, -1)),
  )

export const repoIndex = (files, built = new Set()) => {
  const folders = new Set()
  for (const file of files) {
    for (let folder = path.posix.dirname(file); folder !== "."; folder = path.posix.dirname(folder)) folders.add(folder)
  }
  const tops = new Set([...files, ...folders].map((each) => each.split("/")[0]))
  const folderNames = new Set([...folders].map((folder) => path.posix.basename(folder)))
  return {
    files: new Set(files),
    folders,
    folderNames,
    names: new Set(files.map((file) => path.posix.basename(file))),
    tops,
    built,
    all: [...files, ...folders],
  }
}

const trimmed = (cited) =>
  cited
    .replace(/[?#].*$/, "")
    .replace(/:\d+(?::\d+)?$/, "")
    .replace(/[.,:;]+$/, "")
    .replace(/\/$/, "")

const repoPath = (cited, index) => {
  const segments = cited.split("/")
  if (segments.some((segment) => index.built.has(segment))) return false
  return index.tops.has(segments[0]) || (fileExtension.test(cited) && index.folderNames.has(segments[0]))
}

export const asCitation = (span, index) => {
  const cited = trimmed(span)
  if (cited === "" || notAPath.test(cited)) return undefined
  if (!cited.includes("/")) return bareExtensions.test(cited) ? cited : undefined
  return repoPath(cited, index) ? cited : undefined
}

const exists = (index, candidate) => index.files.has(candidate) || index.folders.has(candidate)

export const resolves = (cited, from, index) => {
  if (!cited.includes("/")) return index.names.has(cited)
  const beside = path.posix.normalize(path.posix.join(path.posix.dirname(from), cited))
  return exists(index, cited) || exists(index, beside) || index.all.some((each) => each.endsWith(`/${cited}`))
}

export const citationsIn = (source) => {
  const found = []
  let fenced = false
  source.split("\n").forEach((text, at) => {
    if (/^\s*(```|~~~)/.test(text)) fenced = !fenced
    if (fenced) return
    for (const [, span] of text.matchAll(/`([^`]+)`/g)) found.push({ line: at + 1, span, link: false })
    for (const [, target] of text.replace(/`[^`]*`/g, "").matchAll(/\]\(([^)\s]+)\)/g)) {
      found.push({ line: at + 1, span: target, link: true })
    }
  })
  return found
}

const fix = "Point it at the file that holds this now, or drop the words that name it"

export const markdownFaults = (file, source, index) =>
  citationsIn(source).flatMap(({ line, span, link }) => {
    const cited = link ? trimmed(span) : asCitation(span, index)
    if (cited === undefined || cited === "" || /^[a-z]+:/.test(cited)) return []
    if (
      link
        ? exists(index, path.posix.normalize(path.posix.join(path.posix.dirname(file), cited)))
        : resolves(cited, file, index)
    )
      return []
    return [`${file}:${line}: \`${cited}\` names no file or folder in the repo. ${fix}.`]
  })

export const codeFaults = (file, source, index) =>
  source.split("\n").flatMap((text, at) =>
    [...text.matchAll(/["'`]([\w.-]+\/[\w./-]+[\w-]\.[a-z]{1,5})["'`]/g)]
      .map(([, cited]) => cited)
      .filter((cited) => index.tops.has(cited.split("/")[0]) && repoPath(cited, index) && !resolves(cited, file, index))
      .map((cited) => `${file}:${at + 1}: \`${cited}\` names no file in the repo. ${fix}.`),
  )

export const glossaryFaults = (glossary, read) =>
  glossary.allowed.flatMap((one) => {
    const source = read(one.file)
    if (source === null)
      return [`${glossaryFile}: the allowed line in ${one.file} names a file that is gone. Drop the entry.`]
    return source.split("\n").some((line) => line.trim() === one.text)
      ? []
      : [
          `${glossaryFile}: ${one.file} no longer has the allowed line "${one.text}". Drop the entry or copy the line as it is now.`,
        ]
  })

export const pathListFaults = (file, source, index) =>
  source.split("\n").flatMap((line, at) => {
    const cited = line.trim()
    return cited === "" || exists(index, cited)
      ? []
      : [`${file}:${at + 1}: ${cited} names no file or folder in the repo. ${fix}.`]
  })

export const coverFaults = (moved) =>
  moved
    .filter((entry) => entry.reason !== "changed")
    .map((entry) =>
      entry.reason === "missing-file"
        ? `specs/${entry.spec}/covers.json: ${entry.file} is gone. Point the cover at the file that holds ${entry.names.join(", ")} now, or drop it.`
        : `specs/${entry.spec}/covers.json: ${entry.names.join(", ")} is not declared in ${entry.file}. Point the cover at the declaration that holds it now, or drop the name.`,
    )

const git = (root, args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" })

export const citedPathFaults = (root) => {
  const read = (file) => (fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), "utf8") : null)
  const files = git(root, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"])
    .split("\0")
    .filter((file) => file !== "" && fs.existsSync(path.join(root, file)))
  const index = repoIndex(files, builtFolders(read(".gitignore") ?? ""))
  const kept = files.filter((file) => !records.some((record) => record.test(file)))
  return [
    ...kept.filter((file) => file.endsWith(".md")).flatMap((file) => markdownFaults(file, read(file), index)),
    ...kept
      .filter((file) => code.test(file) && !testCode.test(file) && file !== "pnpm-lock.yaml")
      .flatMap((file) => codeFaults(file, read(file), index)),

    ...glossaryFaults(JSON.parse(read(glossaryFile)), read),
    ...pathListFiles.flatMap((file) => pathListFaults(file, read(file), index)),
    ...coverFaults(drifted(root)),
  ]
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".."))
  const faults = citedPathFaults(root)
  for (const fault of faults) console.error(fault)
  if (faults.length > 0) process.exit(1)
}
