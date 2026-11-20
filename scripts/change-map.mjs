import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { journeyFolder, journeyNameOf } from "../tests/journeys/journey-shards.mjs"
import { browserJobs, browserReach, browserSpec, designScans, inBrowser } from "./browser-change-map.mjs"
import { browserExportTag } from "./pptx-cases.mjs"
import { readersOf, scriptTestReads } from "./script-test-reads.mjs"
import { readSpecSeconds } from "./spec-seconds.mjs"

export const ciParts = ["source", "scripts", "design", "browser", "journeys", "pptx", "corpus", "model-check"]

const runsEverything = [
  /(^|\/)package\.json$/,
  /^pnpm-(lock|workspace)\.yaml$/,
  /^\.node-version$/,
  /^\.npmrc$/,
  /^tsconfig(\.base)?\.json$/,
  /^\.github\//,
  /^scripts\/(check|check-steps|change-map|browser-change-map|spec-seconds)\.mjs$/,
]

const sharedTestSetup = ["vitest.config.mts"]

const inert = [/^\.claude\//]

const readByChecks = [/\.md$/, /^metrics\.json$/]

const sourceOnly = [/^\.gitignore$/, /^\.oxfmtrc\.json$/, /^\.railway\//]

const servedBy = {
  web: ["browser", "design", "journeys"],
  "@airdesign/api": ["browser", "design", "journeys"],
  "@airdesign/site": ["browser", "scripts"],
}

const code = /\.(mjs|js|cjs|ts|tsx|mts)$/
const testFile = /\.test\.(ts|tsx|mjs|mts)$/
const testOrSpec = /\.(test|spec)\.(ts|tsx|mjs|mts)$/
const unitNode = (dir) => `unit:${dir}/`
const goneNode = (file) => `gone:${file.replace(/\.(mjs|js|cjs|ts|tsx|mts)$/, "").replace(/\/index$/, "")}`

const partsOfFile = (file) => {
  if (file.startsWith("unit:")) return [file]
  if (file.startsWith("gone:")) return []
  if (file === "playwright.config.ts") return ["browser", "design"]
  if (file === "playwright.journeys.config.mts") return ["journeys"]
  if (file.startsWith("tests/journeys/") || file.startsWith(journeyFolder)) return ["journeys"]
  if (designScans.includes(file)) return ["design"]
  if (browserSpec(file)) return ["browser"]
  if (inBrowser(file)) return ["browser", "design"]
  if (file.startsWith("tests/")) return [unitNode("tests")]
  if (file === "scripts/check-specs.mjs") return ["scripts", "model-check"]
  if (file.startsWith("scripts/") || file.startsWith("tooling/")) return ["scripts"]
  if (file.startsWith(".agents/skills/")) return [unitNode(".agents/skills")]
  return []
}

const partsOfPackage = (pkg) =>
  pkg.dir.startsWith("tooling/") ? ["scripts"] : [unitNode(pkg.dir), ...(servedBy[pkg.name] ?? [])]

const ownerOf = (file, packages) =>
  packages.filter((pkg) => file.startsWith(`${pkg.dir}/`)).sort((a, b) => b.dir.length - a.dir.length)[0]

const nodeOf = (file, packages) => {
  const owner = ownerOf(file, packages)
  if (!owner) return file
  return testFile.test(file) ? unitNode(owner.dir) : owner.name
}

const listed = (file, paths) => paths.some((entry) => file === entry || file.startsWith(`${entry}/`))

const walk = (start, next) => {
  const reached = new Set([start])
  const queue = [start]
  while (queue.length > 0)
    for (const node of next(queue.pop()))
      if (!reached.has(node)) {
        reached.add(node)
        queue.push(node)
      }
  return reached
}

const importersOf = (graph) => {
  const importers = new Map()
  const add = (target, from) => importers.set(target, [...(importers.get(target) ?? []), from])
  for (const [from, targets] of Object.entries(graph.imports)) for (const target of targets) add(target, from)
  for (const pkg of graph.packages) for (const dep of pkg.deps) add(dep, pkg.name)
  return importers
}

const setupFiles = (graph) =>
  new Set(
    sharedTestSetup.flatMap((entry) => [
      ...walk(entry, (node) => (graph.imports[node] ?? []).filter((target) => target.includes("/"))),
    ]),
  )

const runEverything = (because) => ({
  everything: true,
  because,
  parts: Object.fromEntries(ciParts.map((part) => [part, true])),
  unitTests: "all",
  packages: "all",
  browserSpecs: "all",
  journeyNames: "all",
})

export const changeMap = (changed, graph, { full = false } = {}) => {
  if (full) return runEverything("--full runs every part")
  if (changed === null) return runEverything("the diff could not be read")
  const importers = importersOf(graph)
  const byName = new Map(graph.packages.map((pkg) => [pkg.name, pkg]))
  const setup = setupFiles(graph)
  const browser = browserReach(graph, walk)
  const selected = new Set()
  const knownJourneys = new Set(graph.journeyNames)
  const selectedJourneys = new Set()
  let canNarrowJourneys = true
  let canNarrowBrowser = true
  const parts = new Map()
  const packages = new Set()
  const turnOn = (part, file) => parts.has(part) || parts.set(part, file)
  for (const file of changed) {
    if (inert.some((pattern) => pattern.test(file))) continue
    if (runsEverything.some((pattern) => pattern.test(file)))
      return runEverything(`${file} changes how every part runs`)
    if (setup.has(file)) return runEverything(`${file} is shared test setup`)
    turnOn("source", file)
    if (readersOf(graph.reads ?? {}, file).length > 0) turnOn("scripts", file)
    const gone = goneNode(file)
    if (
      listed(file, graph.pptxPaths) ||
      [browser.setup, browser.exports].some((files) => files.has(file) || files.has(gone))
    ) {
      turnOn("pptx", file)
      turnOn("corpus", file)
    }
    if (readByChecks.some((pattern) => pattern.test(file))) {
      turnOn("scripts", file)
      continue
    }
    if (sourceOnly.some((pattern) => pattern.test(file))) continue
    if (file.startsWith("specs/")) {
      turnOn("model-check", file)
      turnOn(unitNode("tests"), file)
      continue
    }
    const shared = browser.setup.has(file) || browser.setup.has(gone)
    const specs = [...browser.specs].filter(([, needs]) => needs.has(file) || needs.has(gone)).map(([spec]) => spec)
    const narrowed = inBrowser(file) && !shared && specs.length > 0
    canNarrowBrowser &&= narrowed
    if (shared) {
      turnOn("browser", file)
      turnOn("design", file)
    }
    for (const spec of specs) {
      if (designScans.includes(spec)) turnOn("design", file)
      else {
        turnOn("browser", file)
        selected.add(spec)
      }
    }
    const start = nodeOf(file, graph.packages)
    if (start === file && partsOfFile(file).length === 0 && !(file in graph.imports))
      return runEverything(`no part owns ${file}`)
    const directJourney =
      file.startsWith(journeyFolder) && knownJourneys.has(journeyNameOf(file.slice(journeyFolder.length)))
    if (file.startsWith("apps/")) canNarrowJourneys = false
    const reached = new Set([start, gone].flatMap((from) => [...walk(from, (at) => importers.get(at) ?? [])]))
    for (const node of reached) {
      if (narrowed && inBrowser(node) && !browserSpec(node)) continue
      const pkg = byName.get(node)
      if (pkg) packages.add(pkg.name)
      const owned = pkg ? partsOfPackage(pkg) : partsOfFile(node)
      if (owned.includes("journeys")) {
        const name = node.startsWith(journeyFolder) && journeyNameOf(node.slice(journeyFolder.length))
        if (directJourney && knownJourneys.has(name)) selectedJourneys.add(name)
        else canNarrowJourneys = false
      }
      for (const part of owned) turnOn(part, file)
    }
  }
  return {
    everything: false,
    because: Object.fromEntries([...parts].filter(([part]) => !part.startsWith("unit:"))),
    parts: Object.fromEntries(ciParts.map((part) => [part, parts.has(part)])),
    unitTests: [...parts.keys()]
      .filter((part) => part.startsWith("unit:"))
      .map((part) => part.slice("unit:".length))
      .sort(),
    packages: [...packages].sort(),
    browserSpecs: canNarrowBrowser ? [...selected].sort() : "all",
    browserSeconds: graph.browserSeconds,
    journeyNames: canNarrowJourneys ? [...selectedJourneys].sort() : "all",
  }
}

const workspaceDirs = (root) => {
  const patterns = []
  let inPackages = false
  for (const line of fs.readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8").split("\n")) {
    if (/^\S/.test(line)) inPackages = line.startsWith("packages:")
    const entry = inPackages && line.match(/^\s+-\s+["']?([^"'\s]+)/)
    if (entry) patterns.push(entry[1])
  }
  return patterns.flatMap((pattern) =>
    pattern.endsWith("/*")
      ? fs.readdirSync(path.join(root, pattern.slice(0, -2))).map((name) => `${pattern.slice(0, -2)}/${name}`)
      : [pattern],
  )
}

const readPackages = (root) =>
  workspaceDirs(root)
    .filter((dir) => fs.existsSync(path.join(root, dir, "package.json")))
    .map((dir) => {
      const manifest = JSON.parse(fs.readFileSync(path.join(root, dir, "package.json"), "utf8"))
      const deps = { ...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies }
      return {
        name: manifest.name,
        dir,
        deps: Object.keys(deps).filter((dep) => String(deps[dep]).startsWith("workspace:")),
      }
    })

const rootConfig = /^[^/]+\.(ts|mts|mjs)$/
const quotedPath = /["'`]((?:\.{1,2}\/)*[\w@.-]+(?:\/[\w@.-]+)*\/?)["'`]/g
const loadedModule = /(?:join|resolve|pathToFileURL|new URL)\([^()"'`]*?["'`]([^"'`]+\.(?:mjs|js|ts|tsx|mts))["'`]/g
const importSyntax = /(?:from|import)\s*\(?\s*["'`]([^"'`]+)["'`]/g
const relative = /^\.{1,2}\//
const listsJourneyNames = (file, quoted) => file === "tests/journeys/journey-shards.mjs" && quoted === journeyFolder

const specifiers = (file, source) => [
  ...[...source.matchAll(importSyntax)].map((match) => match[1]),
  ...[...source.matchAll(loadedModule)].map((match) => match[1]),
  ...[...source.matchAll(quotedPath)]
    .map((match) => match[1])
    .filter(
      (quoted) =>
        quoted.includes("/") &&
        quoted !== "./" &&
        !listsJourneyNames(file, quoted) &&
        (rootConfig.test(file) || inBrowser(file) || !/\.[a-z]+$/.test(quoted)),
    ),
]

const resolver = (files, packages) => {
  const children = new Map()
  for (const file of files) {
    const folder = path.posix.dirname(file)
    children.set(folder, [...(children.get(folder) ?? []), file])
  }
  const names = new Set(packages.map((pkg) => pkg.name))
  const web = packages.find((pkg) => pkg.dir === "apps/web")
  const asFile = (candidate) => {
    const stem = candidate.replace(/\.(js|mjs|ts|tsx|mts)$/, "")
    return [
      candidate,
      ...[".ts", ".tsx", ".mjs", ".js", ".mts", "/index.ts", "/index.mjs"].map((end) => stem + end),
    ].find((name) => files.has(name))
  }
  const asFolder = (from, specifier) => {
    const folder = path.posix
      .normalize(relative.test(specifier) ? path.posix.join(path.posix.dirname(from), specifier) : specifier)
      .replace(/\/$/, "")
    return children.has(folder) && (relative.test(specifier) || folder.split("/").length >= 3) ? folder : undefined
  }
  const node = (file) => ownerOf(file, packages)?.name ?? file
  return (from, all) => {
    const folders = all.map((specifier) => asFolder(from, specifier)).filter(Boolean)
    return all.flatMap((specifier) => {
      const bare = specifier.match(/^(@airdesign\/[\w-]+|web)(\/|$)/)
      if (bare && names.has(bare[1])) return [bare[1]]
      if (specifier.startsWith("@/")) return web ? [web.name] : []
      const local = relative.test(specifier)
        ? path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier))
        : specifier
      const file = asFile(local) ?? folders.map((folder) => asFile(path.posix.join(folder, specifier))).find(Boolean)
      if (file) return [node(file)]
      const folder = asFolder(from, specifier)
      if (folder === undefined) {
        if (!relative.test(specifier)) return []
        const owner = ownerOf(local, packages)
        return [owner ? owner.name : goneNode(local)]
      }
      const owner = ownerOf(`${folder}/`, packages)
      return owner
        ? [owner.name]
        : children
            .get(folder)
            .filter((name) => code.test(name))
            .map(node)
    })
  }
}

const readImports = (root, files, packages) => {
  const resolve = resolver(new Set(files), packages)
  const names = new Set(packages.map((pkg) => pkg.name))
  const imports = {}
  for (const file of files.filter((name) => code.test(name))) {
    const from = nodeOf(file, packages)
    const targets = resolve(file, specifiers(file, fs.readFileSync(path.join(root, file), "utf8")))
      .filter(
        (target) =>
          target !== file && target !== from && (!testOrSpec.test(target) || (inBrowser(file) && browserSpec(target))),
      )
      .filter((target) => from === file || !names.has(target))
    if (targets.length > 0) imports[from] = [...new Set([...(imports[from] ?? []), ...targets])].sort()
  }
  return imports
}

export const pptxPathsFile = ".github/actions/ci-changes/pptx-paths.txt"

export const readChangeGraph = (root) => {
  const files = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((file) => file && fs.existsSync(path.join(root, file)))
  const packages = readPackages(root)
  const browserSpecs = files.filter(browserSpec)
  const exportSpecs = new Set(
    browserSpecs.filter((file) => fs.readFileSync(path.join(root, file), "utf8").includes(browserExportTag)),
  )
  for (const file of files.filter((file) => file.startsWith("scripts/pptx-cases/") && file.endsWith(".mjs"))) {
    for (const [, target] of fs.readFileSync(path.join(root, file), "utf8").matchAll(quotedPath))
      if (browserSpec(target)) exportSpecs.add(target)
  }
  return {
    browserSpecs,
    journeyNames: files
      .filter((file) => file.startsWith(journeyFolder))
      .map((file) => journeyNameOf(file.slice(journeyFolder.length)))
      .filter(Boolean),
    browserSeconds: readSpecSeconds(root).seconds,
    exportSpecs: [...exportSpecs],
    packages,
    imports: readImports(root, files, packages),
    reads: scriptTestReads(root, files),
    pptxPaths: fs.readFileSync(path.join(root, pptxPathsFile), "utf8").split("\n").filter(Boolean),
  }
}

const wholeSourceJob = (job) =>
  Object.fromEntries(Object.entries(job).filter(([key]) => key !== "shard" && key !== "unitTests"))

const oneSourceJob = (active, result) => {
  if (result.unitTests === "all") return active
  const firstSource = active.findIndex((job) => job.part === "source")
  return active.flatMap((job, index) =>
    job.part === "source" ? (index === firstSource ? [wholeSourceJob(job)] : []) : [job],
  )
}

export const checkJobsFor = (result, jobs) => {
  const active = oneSourceJob(
    jobs.filter((job) => result.parts[job.part] === true),
    result,
  )
  if (result.browserSpecs === "all" || result.browserSpecs.length === 0) return active
  const firstBrowser = active.findIndex((job) => job.part === "browser")
  if (firstBrowser === -1) return active
  const limit = active.filter((job) => job.part === "browser").length
  const narrowed = browserJobs(result.browserSpecs, result.browserSeconds, limit)
  return active.flatMap((job, index) => (job.part === "browser" ? (index === firstBrowser ? narrowed : []) : [job]))
}

export const githubOutput = (result, jobs) => [
  ...ciParts.map((part) => `${part}=${String(result.parts[part])}`),
  `journey-names=${result.journeyNames === "all" || result.journeyNames.length === 0 ? "" : JSON.stringify(result.journeyNames)}`,
  `unit-tests=${result.unitTests === "all" ? "all" : JSON.stringify(result.unitTests)}`,
  `check=${JSON.stringify(checkJobsFor(result, jobs))}`,
]

export const decisionLines = (result) =>
  result.everything
    ? [`every part runs: ${result.because}`]
    : [
        ...ciParts.map((part) =>
          result.parts[part] ? `${part} runs, for ${result.because[part]}` : `${part} skips: nothing it judges changed`,
        ),
        ...(result.browserSpecs.length > 0 && result.browserSpecs !== "all"
          ? [`browser specs: ${result.browserSpecs.join(" ")}`]
          : []),
        ...(result.journeyNames !== "all" && result.journeyNames.length > 0
          ? [`journeys: ${result.journeyNames.join(" ")}`]
          : []),
        `unit tests: ${result.unitTests.length === 0 ? "none" : result.unitTests.join(" ")}`,
      ]

const flagValue = (argv, flag) => {
  const at = argv.indexOf(flag)
  return at === -1 ? undefined : argv[at + 1]
}

export const decide = (argv, root) => {
  const jobs = JSON.parse(flagValue(argv, "--jobs") ?? "[]")
  const listed = flagValue(argv, "--paths")
  let result
  try {
    const changed = listed === undefined ? null : fs.readFileSync(listed, "utf8").split("\n").filter(Boolean)
    result = changeMap(changed, argv.includes("--full") ? { packages: [], imports: {} } : readChangeGraph(root), {
      full: argv.includes("--full"),
    })
  } catch (error) {
    result = runEverything(`the map failed: ${error.message}`)
  }
  return { lines: githubOutput(result, jobs), said: decisionLines(result) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { lines, said } = decide(process.argv.slice(2), process.cwd())
  for (const line of said) console.error(line)
  for (const line of lines) console.log(line)
}
