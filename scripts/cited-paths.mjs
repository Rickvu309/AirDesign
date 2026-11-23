import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { drifted } from "./spec-sync.mjs"
import { timingRecords } from "./timings.mjs"

export const glossaryFile = "tooling/oxlint-plugin-airdesign/glossary.json"
export const pathListFiles = [".github/actions/ci-changes/pptx-paths.txt"]

const records = [/(^|\/)[\w-]*fixtures\//, /^docs\/adr\//, /^scripts\/red-main-drill\.mjs$/]
const measuredRecords = timingRecords.map(({ record }) => record)

export const citesPaths = (file) => !records.some((record) => record.test(file)) && !measuredRecords.includes(file)
const code = /\.(?:[cm]?[jt]sx?|json|ya?ml|sh)$/
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
    sorted: [...files, ...[...folders].map((folder) => `${folder}/`)].sort(),
    folderNames,
    named: Map.groupBy(files, (file) => path.posix.basename(file)),
    tops,
    built,
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
  if (/^\.\.?\//.test(cited) && fileExtension.test(cited)) return cited
  if (cited === "" || notAPath.test(cited)) return undefined
  if (!cited.includes("/")) return bareExtensions.test(cited) ? cited : undefined
  return repoPath(cited, index) ? cited : undefined
}

const exists = (index, candidate) => index.files.has(candidate) || index.folders.has(candidate)

export const citedFault = (cited, from, index) => {
  const beside = path.posix.normalize(path.posix.join(path.posix.dirname(from), cited))
  if (exists(index, cited) || exists(index, beside)) return undefined
  if (!cited.includes("/")) {
    const holders = index.named.get(cited) ?? []
    if (holders.length === 1) return undefined
    return holders.length === 0
      ? "names no file in the repo. Point it at the file that holds this now, or drop the words that name it"
      : `names ${String(holders.length)} files and none beside this one. Write it with its folder from the repo root`
  }
  return "names no file or folder from the repo root or from this file's folder. Write the path from the repo root, or point it at the file that holds this now"
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

const at = (file, line, cited, fault) => `${file}:${line}: \`${cited}\` ${fault}.`

export const markdownFaults = (file, source, index) =>
  citationsIn(source).flatMap(({ line, span, link }) => {
    const cited = link ? trimmed(span) : asCitation(span, index)
    if (cited === undefined || cited === "" || /^[a-z]+:/.test(cited)) return []
    const fault = citedFault(link && !cited.includes("/") ? `./${cited}` : cited, file, index)
    return fault === undefined ? [] : [at(file, line, cited, fault)]
  })

const pathToken = /(?<=^|[\s"'`=(,[])([\w.-]+\/[\w./-]*[\w-]\.[a-z]{1,5})(?=$|[\s"'`),;:\]])/g

const quotedPrefix = /(["'`])([\w.-]+\/[\w./-]*)\1/g

const starts = (index, prefix) => {
  let low = 0
  let high = index.sorted.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (index.sorted[middle] < prefix) low = middle + 1
    else high = middle
  }
  return index.sorted[low]?.startsWith(prefix) ?? false
}

const prefixFault = (cited, from, index) => {
  const beside = path.posix.join(path.posix.dirname(from), cited)
  if (starts(index, cited) || starts(index, beside)) return undefined
  return cited.endsWith("/")
    ? "names no folder from the repo root or from this file's folder. Point it at the folder that holds this now, or drop it"
    : "starts no file or folder path from the repo root or from this file's folder. Point it at the files that hold this now, or drop it"
}

const repoCited = (cited, index) => index.tops.has(cited.split("/")[0]) && repoPath(cited, index)

export const codeFaults = (file, source, index) =>
  source.split("\n").flatMap((text, line) => [
    ...[...text.matchAll(pathToken)]
      .map(([, cited]) => cited)
      .filter((cited) => repoCited(cited, index))
      .flatMap((cited) => {
        const fault = citedFault(cited, file, index)
        return fault === undefined ? [] : [at(file, line + 1, cited, fault)]
      }),
    ...[...text.matchAll(quotedPrefix)]
      .map(([, , cited]) => cited)
      .filter((cited) => !fileExtension.test(cited) && repoCited(cited.replace(/\/$/, ""), index))
      .flatMap((cited) => {
        const fault = prefixFault(cited, file, index)
        return fault === undefined ? [] : [at(file, line + 1, cited, fault)]
      }),
  ])

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
  const kept = files.filter(citesPaths)
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
