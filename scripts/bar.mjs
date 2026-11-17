import { execFileSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { areasOf } from "./areas.mjs"
import { beforeAfterLabel, beforeAfterLine, beforeAfterNeed, seen } from "./before-after.mjs"
import { workingTree } from "./checked.mjs"
import { ghApi, readWithRetry } from "./github-read.mjs"
import { bodyFaults, githubOffBranch } from "./pr-body.mjs"
import { baseFault } from "./pull-base.mjs"
import { measuredLive } from "./metrics.mjs"
import { titleVerdict } from "./title.mjs"

const guardedFolders = [".github/", "tooling/", "scripts/", "specs/"]
const openFolders = ["scripts/pptx-fixtures/"]
const guardedFiles = new Set([
  ".node-version",
  ".npmrc",
  ".oxfmtrc.json",
  "AGENTS.md",
  "CHECK-QUEUE.md",
  "CHECKS.md",
  "pnpm-workspace.yaml",
])
const guardedNames = [/^tsconfig.*\.json$/, /^\.oxlintrc\.json$/, /^vitest\./, /^playwright\.config\./]
const casesFile = "scripts/pptx-fixtures/cases.json"
const proofFile = "scripts/pptx-fixtures/judge-proof.json"
const corpusFile = "scripts/pptx-fixtures/corpus.json"

export const guarded = (file) => {
  if (openFolders.some((folder) => file.startsWith(folder))) return false
  if (guardedFiles.has(file) || guardedFolders.some((folder) => file.startsWith(folder))) return true
  const name = file.slice(file.lastIndexOf("/") + 1)
  return guardedNames.some((pattern) => pattern.test(name))
}

export const replacedFixtures = (files) =>
  files
    .filter(
      (file) =>
        file.status !== "added" && file.name !== casesFile && file.name !== proofFile && file.name !== corpusFile,
    )
    .flatMap((file) => [file.name, file.before].filter((name) => name?.startsWith(openFolders[0])))

const withoutReferences = (tsconfig) => JSON.stringify({ ...tsconfig, references: undefined })

export const sameButReferences = (left, right) =>
  left !== undefined && right !== undefined && withoutReferences(left) === withoutReferences(right)

export const onlyAddsReferences = (base, head) =>
  sameButReferences(base, head) &&
  (base.references ?? []).every((kept) => (head.references ?? []).some((each) => each.path === kept.path))

export const newPackageFile = (file, name) =>
  file.status === "added" && new RegExp(`^packages/[a-z0-9-]+/${name.replace(".", "\\.")}$`).test(file.name)

export const packageFile = (file) => file === "package.json" || file.endsWith("/package.json")

const finite = (value) => typeof value === "number" && Number.isFinite(value)
const keysOf = (metric) =>
  metric !== null && typeof metric === "object" && !Array.isArray(metric) ? Object.keys(metric).sort().join() : ""
const timed = (metric) => keysOf(metric) === "limit" && finite(metric.limit)
const counted = (metric) => keysOf(metric) === "goal,now" && finite(metric.now) && finite(metric.goal)
const measured = (metric) => keysOf(metric) === "goal" && finite(metric.goal)

const metricsFile = "metrics.json"
export const oldMetricsFile = "sticks.json"

export const oldMetricNames = {
  "known faults": "known-failures",
  "real decks in the PowerPoint check": "corpus-size",
  "planted breaks the judge catches": "fault-detection",
  "routes pptx writes": "export-coverage",
  "route writes that pass": "export-verified",
  "check seconds": "ci-duration",
  "PowerPoint check seconds": "pptx-check-duration",
}

export const metricsFrom = (read) => {
  const metrics = read(metricsFile)
  if (metrics !== undefined) return metrics
  const old = read(oldMetricsFile)
  if (old === undefined) return undefined
  return Object.fromEntries(Object.entries(old).map(([name, metric]) => [oldMetricNames[name] ?? name, metric]))
}

const countsProof = new Set(["fault-detection"])

const measuredReason = (name, before, after) => {
  if (!measured(after)) {
    return `The metric ${name} is measured on each run, so it must be only a goal, as a number.`
  }
  if (before === undefined) return undefined
  if (timed(before)) return `The metric ${name} stopped being a limit.`
  return before.goal === after.goal ? undefined : `The goal of ${name} went from ${before.goal} to ${after.goal}.`
}

const metricReason = (name, before, after) => {
  if (after === undefined) return `The metric ${name} was removed.`
  if (measuredLive.has(name)) return measuredReason(name, before, after)
  if (!timed(after) && !counted(after)) {
    return `The metric ${name} must be only a limit, or only now and goal, as numbers.`
  }
  if (before === undefined) return undefined
  if (timed(before)) {
    if (!timed(after)) return `The metric ${name} stopped being a limit.`
    return after.limit <= before.limit ? undefined : `The limit of ${name} went from ${before.limit} to ${after.limit}.`
  }
  if (!counted(after)) return `The metric ${name} stopped being a count with a goal.`
  if (countsProof.has(name)) return undefined
  const ahead = before.goal - before.now
  const harder = ahead * (after.goal - before.goal) > 0
  if (harder) {
    return (after.now - before.now) * ahead >= 0
      ? undefined
      : `${name} went from ${before.now} to ${after.now}, away from its goal of ${before.goal}.`
  }
  if (after.goal !== before.goal) return `The goal of ${name} went from ${before.goal} to ${after.goal}.`
  const closer = Math.abs(after.now - after.goal) <= Math.abs(before.now - before.goal)
  const sameSide = (after.now - after.goal) * (before.now - before.goal) >= 0
  return closer && sameSide
    ? undefined
    : `${name} went from ${before.now} to ${after.now}, away from its goal of ${before.goal}.`
}

export const lostCases = (baseCases, headCases) => {
  const kept = new Set(headCases.map((row) => JSON.stringify(row)))
  return baseCases.filter((row) => !kept.has(JSON.stringify(row))).map((row) => String(row.name))
}

export const lostDecks = (baseCorpus, headCorpus) => {
  const kept = new Map(headCorpus.map((row) => [row.name, row.sha256]))
  return baseCorpus.filter((row) => kept.get(row.name) !== row.sha256).map((row) => String(row.name))
}

export const lostKinds = (baseProof, headProof) =>
  Object.keys(baseProof).filter(
    (kind) => headProof[kind] === undefined || (baseProof[kind] === "caught" && headProof[kind] !== "caught"),
  )

export const ownerReasons = ({
  baseMetrics,
  headMetrics,
  changedFiles,
  changedScripts,
  changedCases = [],
  changedDecks = [],
  changedFixtures = [],
  changedKinds = [],
}) => {
  const reasons = []
  for (const name of new Set([...Object.keys(baseMetrics), ...Object.keys(headMetrics)])) {
    const text = metricReason(name, baseMetrics[name], headMetrics[name])
    if (text !== undefined) reasons.push({ about: `metric ${name}`, text, lowers: true })
  }
  for (const file of changedFiles.filter(guarded)) {
    reasons.push({ about: `file ${file}`, text: `${file} decides what ci checks.`, lowers: false })
  }
  for (const file of changedFixtures) {
    reasons.push({
      about: `file ${file}`,
      text: `${file} is a deck the PowerPoint check already judges.`,
      lowers: true,
    })
  }
  for (const name of changedCases) {
    reasons.push({ about: `case ${name}`, text: `The PowerPoint case ${name} was changed or removed.`, lowers: true })
  }
  for (const name of changedDecks) {
    reasons.push({
      about: `deck ${name}`,
      text: `The corpus deck ${name} was removed or its sha256 changed.`,
      lowers: true,
    })
  }
  for (const name of changedKinds) {
    reasons.push({
      about: `break ${name}`,
      text: `The judge proof no longer records ${name} as caught.`,
      lowers: true,
    })
  }
  for (const file of changedScripts) {
    reasons.push({
      about: `scripts ${file}`,
      text: `The scripts in ${file} changed, and they are what ci runs.`,
      lowers: false,
    })
  }
  return reasons
}

export const verdict = ({ reasons }) => {
  if (reasons.length === 0) return { listed: false, lowers: false, lines: ["Nothing here touches the bar."] }
  const lowering = reasons.filter((reason) => reason.lowers)
  return {
    listed: true,
    lowers: lowering.length > 0,
    lines: [
      ...lowering.map((reason) => `Lowers the bar: ${reason.text}`),
      ...reasons.filter((reason) => !reason.lowers).map((reason) => `Listed for the owner: ${reason.text}`),
    ],
  }
}

export const labelsFor = (result) => [
  ...(result.listed ? ["changes-ci"] : []),
  ...(result.lowers ? ["lowers-the-bar"] : []),
]

export const longTitleLabel = "long-title"

export const labelChanges = ({ result, shown, changedFiles, title }) => {
  const long = titleVerdict(title) !== undefined
  return {
    add: [
      ...labelsFor(result),
      ...areasOf(changedFiles),
      ...(shown.needed ? [beforeAfterLabel] : []),
      ...(long ? [longTitleLabel] : []),
    ],
    remove: [...(shown.needed ? [] : [beforeAfterLabel]), ...(long ? [] : [longTitleLabel])],
  }
}

const github = readWithRetry({ run: ghApi })

const rows = (endpoint, shape) =>
  github(["--paginate", endpoint, "--jq", `.[] | ${shape} | @json`])
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line))

const missing = (error) => String(error.stderr ?? error.message).includes("HTTP 404")

export const contents = (repository, sha, file) =>
  `repos/${repository}/contents/${file.split("/").map(encodeURIComponent).join("/")}?ref=${sha}`

const githubJson = (repository) => (sha, file) => {
  try {
    return JSON.parse(github([contents(repository, sha, file), "-H", "Accept: application/vnd.github.raw"]))
  } catch (error) {
    if (missing(error) || error instanceof SyntaxError) return undefined
    throw error
  }
}

const scriptsAt = (json, sha, file) => JSON.stringify(json(sha, file)?.scripts ?? {})

const casesAt = (json, sha) => {
  const cases = json(sha, casesFile)
  return Array.isArray(cases) ? cases : []
}

const corpusAt = (json, sha) => {
  const corpus = json(sha, corpusFile)
  return Array.isArray(corpus) ? corpus : []
}

const proofAt = (json, sha) => {
  const proof = json(sha, proofFile)
  return proof !== null && typeof proof === "object" && !Array.isArray(proof) ? proof : {}
}

const metricsAt = (json, sha) => metricsFrom((file) => json(sha, file))

export const readReasons = ({ json, fork, head, listed }) => {
  const changedFiles = listed.flatMap((file) => [file.name, file.before].filter((name) => name != null))
  const baseMetrics = metricsAt(json, fork)
  if (baseMetrics === undefined) throw new Error("metrics.json could not be read where this branch left main.")
  const modelPackage = "packages/document"
  const generated = new Set()
  for (const file of listed) {
    const model = `${modelPackage}/${file.name.slice(file.name.lastIndexOf("/") + 1)}`
    if (newPackageFile(file, "tsconfig.json") && sameButReferences(json(head, file.name), json(fork, model))) {
      generated.add(file.name)
    }
    if (newPackageFile(file, "package.json") && scriptsAt(json, head, file.name) === scriptsAt(json, fork, model)) {
      generated.add(file.name)
    }
    if (
      file.name === "tsconfig.json" &&
      file.status === "modified" &&
      onlyAddsReferences(json(fork, file.name), json(head, file.name))
    ) {
      generated.add(file.name)
    }
  }
  return ownerReasons({
    baseMetrics,
    headMetrics: metricsAt(json, head) ?? {},
    changedFiles: changedFiles.filter((file) => !generated.has(file)),
    changedFixtures: replacedFixtures(listed),
    changedCases: changedFiles.includes(casesFile) ? lostCases(casesAt(json, fork), casesAt(json, head)) : [],
    changedDecks: changedFiles.includes(corpusFile) ? lostDecks(corpusAt(json, fork), corpusAt(json, head)) : [],
    changedKinds: changedFiles.includes(proofFile) ? lostKinds(proofAt(json, fork), proofAt(json, head)) : [],
    changedScripts: changedFiles
      .filter(packageFile)
      .filter((file) => !generated.has(file))
      .filter((file) => scriptsAt(json, fork, file) !== scriptsAt(json, head, file)),
  })
}

const readPull = (repository, number) => {
  const pulls = `repos/${repository}/pulls/${number}`
  const pull = JSON.parse(
    github([
      pulls,
      "--jq",
      "{head: .head.sha, base: .base.sha, baseRef: .base.ref, files: .changed_files, body: .body, title: .title} | @json",
    ]),
  )
  const fork = github([
    `repos/${repository}/compare/${pull.base}...${pull.head}`,
    "--jq",
    ".merge_base_commit.sha",
  ]).trim()
  const listed = rows(`${pulls}/files`, "{name: .filename, before: .previous_filename, status}")
  if (listed.length !== pull.files) {
    throw new Error(`This pull request changes ${pull.files} files and only ${listed.length} can be read. Split it.`)
  }
  const reasons = readReasons({ json: githubJson(repository), fork, head: pull.head, listed })
  const changedFiles = listed.map((file) => file.name)
  return {
    reasons,
    changedFiles,
    title: pull.title,
    shown: beforeAfterNeed({ changedFiles, body: pull.body, repository }),
    body: bodyFaults(pull.body, {
      offBranch: githubOffBranch(githubCompare(repository, { head: pull.head, base: pull.baseRef })),
      changedFiles,
      repository,
    }),
    wrongBase: baseFault(number, pull.baseRef),
  }
}

const githubCompare = (repository, sides) => (sha, side) => {
  try {
    return github([`repos/${repository}/compare/${sha}...${sides[side]}?per_page=1`, "--jq", ".status"]).trim()
  } catch (error) {
    if (missing(error) || String(error.stderr ?? error.message).includes("HTTP 422")) return undefined
    throw error
  }
}

const localGit = (root, args, env = process.env) =>
  execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    env,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  })

export const localFork = (root) => {
  try {
    localGit(root, ["rev-parse", "--verify", "--quiet", "origin/main^{commit}"])
  } catch {
    return { why: "There is no origin/main here, so this branch cannot be judged locally. CI judges it." }
  }
  try {
    return { fork: localGit(root, ["merge-base", "HEAD", "origin/main"]).trim() }
  } catch {
    return { why: "This branch has no history back to origin/main, so it cannot be judged locally. CI judges it." }
  }
}

const statusNames = { A: "added", D: "removed", M: "modified", T: "changed", R: "renamed", C: "copied" }

export const listedFiles = (nameStatus) => {
  const words = nameStatus.split("\0")
  const listed = []
  for (let at = 0; at + 1 < words.length;) {
    const letter = words[at][0]
    if (letter === "R" || letter === "C") {
      listed.push({ name: words[at + 2], before: words[at + 1], status: statusNames[letter] })
      at += 3
    } else {
      listed.push({ name: words[at + 1], status: statusNames[letter] ?? "modified" })
      at += 2
    }
  }
  return listed
}

const localJson = (root) => (tree, file) => {
  try {
    return JSON.parse(localGit(root, ["show", `${tree}:${file}`]))
  } catch {
    return undefined
  }
}

export const readLocal = (root) => {
  const { fork, why } = localFork(root)
  if (why !== undefined) return { why }
  const head = workingTree(root)
  const listed = listedFiles(localGit(root, ["diff", "--name-status", "-z", "-M", fork, head]))
  return {
    reasons: readReasons({ json: localJson(root), fork, head, listed }),
    shown: { shown: listed.map((file) => file.name).filter(seen), needed: true },
  }
}

const areasLine = (files) => `Areas: ${areasOf(files).join(", ") || "none"}.`

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self && process.argv[2] === "local") {
  try {
    const read = readLocal(path.resolve(process.argv[3] ?? "."))
    if (read.why !== undefined) console.log(read.why)
    for (const line of read.why === undefined ? verdict(read).lines : []) console.log(line)
    if (read.why === undefined && beforeAfterLine(read.shown)) console.log(beforeAfterLine(read.shown))
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
} else if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const [repository, number] = process.argv.slice(2)
  try {
    const read = readPull(repository, number)
    const result = verdict(read)
    for (const line of result.lines) console.log(line)
    if (beforeAfterLine(read.shown) && !read.shown.needed) console.log(beforeAfterLine(read.shown))
    for (const fault of read.body) console.log(`Body: ${fault}`)
    if (read.body.length > 0) process.exitCode = 1
    if (read.wrongBase !== undefined) {
      console.log(`Wrong base: ${read.wrongBase}`)
      process.exitCode = 1
    }
    console.log(areasLine(read.changedFiles))
    if (titleVerdict(read.title) !== undefined) console.log(`Long title: ${titleVerdict(read.title)}.`)
    const { add, remove } = labelChanges({ result, ...read })
    const issue = `repos/${repository}/issues/${number}/labels`
    for (const label of process.argv.includes("--label") ? remove : []) {
      try {
        github(["-X", "DELETE", `${issue}/${label}`])
      } catch (error) {
        if (!missing(error))
          console.log(`The label ${label} could not be removed: ${String(error.stderr ?? error.message).trim()}`)
      }
    }
    for (const label of process.argv.includes("--label") ? add : []) {
      try {
        github(["-X", "POST", issue, "-f", `labels[]=${label}`])
      } catch (error) {
        console.log(`The label ${label} could not be added: ${String(error.stderr ?? error.message).trim()}`)
      }
    }
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
