import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const webSource = "apps/web/src"
export const knownFile = "scripts/screen-pages-known.json"

const source = /\.(?:tsx?|mts)$/
const test = /\.test\.[cm]?[jt]sx?$/
export const isScreen = (file) => /\/screens\/[^/]+\.tsx$/.test(file) || /-screens\.tsx$/.test(file)
const isSample = (file) => /(^|[/-])samples?([/.-]|$)/.test(path.posix.basename(file))
const isWording = (file) => /\/copy\//.test(file) || /-routes\.tsx?$/.test(file)

const specifiers = (text) =>
  [...text.matchAll(/\bfrom\s+"([^"]+)"|\bimport\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1] ?? m[2])

export const resolver = (files) => {
  const known = new Set(files)
  return (from, specifier) => {
    const base = specifier.startsWith("@/")
      ? path.posix.join(webSource, specifier.slice(2))
      : specifier.startsWith(".")
        ? path.posix.join(path.posix.dirname(from), specifier)
        : undefined
    if (base === undefined) return undefined
    return ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]
      .map((ending) => `${base.replace(/\.js$/, "")}${ending}`)
      .find((candidate) => known.has(candidate))
  }
}

export const screenOnlyReads = (sources) => {
  const files = [...sources.keys()]
  const resolve = resolver(files)
  const importsOf = new Map(
    files.map((file) => [
      file,
      specifiers(sources.get(file))
        .map((specifier) => resolve(file, specifier))
        .filter((target) => target !== undefined),
    ]),
  )
  const productUsers = new Map()
  for (const [file, targets] of importsOf) {
    if (isScreen(file) || isSample(file) || test.test(file)) continue
    for (const target of targets) productUsers.set(target, true)
  }
  return files
    .filter(isScreen)
    .flatMap((screen) =>
      importsOf
        .get(screen)
        .filter((target) => !isScreen(target) && !isSample(target) && !isWording(target))
        .filter((target) => !productUsers.has(target))
        .map((target) => `${screen} -> ${target}`),
    )
    .toSorted()
}

export const screenFaults = (reads, known) => {
  const listed = new Set(known)
  const now = new Set(reads)
  return [
    ...reads
      .filter((read) => !listed.has(read))
      .map(
        (read) =>
          `${read.split(" -> ")[0]} draws ${read.split(" -> ")[1]}, which no page of the app draws. A screen shows the page a person sees: render that page with sample data, as editor-screens.tsx renders DoomEditor through editor-sample.tsx.`,
      ),
    ...known
      .filter((read) => !now.has(read))
      .map((read) => `${knownFile} still lists "${read}", which is fixed or gone. Drop it from the list.`),
  ]
}

export const webSources = (root) =>
  new Map(
    execFileSync("git", ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard", "-z", webSource], {
      encoding: "utf8",
    })
      .split("\0")
      .filter((file) => source.test(file) && fs.existsSync(path.join(root, file)))
      .map((file) => [file, fs.readFileSync(path.join(root, file), "utf8")]),
  )

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".."))
  const known = JSON.parse(fs.readFileSync(path.join(root, knownFile), "utf8")).known
  const faults = screenFaults(screenOnlyReads(webSources(root)), known)
  for (const fault of faults) console.error(fault)
  if (faults.length > 0) process.exit(1)
}
