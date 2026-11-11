import { execFileSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { workingTree } from "./checked.mjs"

const guardedFolders = [".github/", "tooling/", "scripts/", "specs/"]
const openFolders = ["scripts/pptx-fixtures/"]
const guardedFiles = new Set([".node-version", ".npmrc", ".oxfmtrc.json", "AGENTS.md", "pnpm-workspace.yaml"])
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

const testFile = (name) => typeof name === "string" && (name.includes(".test.") || name.includes(".spec."))

export const removedTestFiles = (files) =>
  files.flatMap((file) => {
    if (file.status === "removed" && testFile(file.name)) return [file.name]
    if (file.status === "renamed" && testFile(file.before) && !testFile(file.name)) return [file.before]
    return []
  })

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
const floored = (metric) => keysOf(metric) === "floor" && finite(metric.floor)

const metricsFile = "metrics.json"
export const oldMetricsFile = "sticks.json"

export const oldMetricNames = {
  "known faults": "known-failures",
  tests: "test-count",
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

const recordsFaults = new Set(["known-failures"])
const countsProof = new Set(["fault-detection"])

const metricReason = (name, before, after) => {
  if (after === undefined) return `The metric ${name} was removed.`
  if (!timed(after) && !counted(after) && !floored(after)) {
    return `The metric ${name} must be only a limit, or only now and goal, or only a floor, as numbers.`
  }
  if (before === undefined) return undefined
  if (timed(before)) {
    if (!timed(after)) return `The metric ${name} stopped being a limit.`
    return after.limit <= before.limit ? undefined : `The limit of ${name} went from ${before.limit} to ${after.limit}.`
  }
  if (floored(before)) {
    if (!floored(after)) return `The metric ${name} stopped being a floor.`
    return after.floor >= before.floor ? undefined : `The floor of ${name} went from ${before.floor} to ${after.floor}.`
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
  removedTests = [],
  changedKinds = [],
}) => {
  const reasons = []
  for (const name of new Set([...Object.keys(baseMetrics), ...Object.keys(headMetrics)])) {
    const text = metricReason(name, baseMetrics[name], headMetrics[name])
    const recorded = recordsFaults.has(name) && text?.includes("away from its goal")
    if (text !== undefined) reasons.push({ about: `metric ${name}`, text, blocks: !recorded })
  }
  for (const file of changedFiles.filter(guarded)) {
    reasons.push({ about: `file ${file}`, text: `${file} decides what ci checks.`, blocks: false })
  }
  for (const file of removedTests) {
    reasons.push({ about: `file ${file}`, text: `The test file ${file} was removed.`, blocks: true })
  }
  for (const file of changedFixtures) {
    reasons.push({
      about: `file ${file}`,
      text: `${file} is a deck the PowerPoint check already judges.`,
      blocks: true,
    })
  }
  for (const name of changedCases) {
    reasons.push({ about: `case ${name}`, text: `The PowerPoint case ${name} was changed or removed.`, blocks: true })
  }
  for (const name of changedDecks) {
    reasons.push({
      about: `deck ${name}`,
      text: `The corpus deck ${name} was removed or its sha256 changed.`,
      blocks: true,
    })
  }
  for (const name of changedKinds) {
    reasons.push({
      about: `break ${name}`,
      text: `The judge proof no longer records ${name} as caught.`,
      blocks: true,
    })
  }
  for (const file of changedScripts) {
    reasons.push({
      about: `scripts ${file}`,
      text: `The scripts in ${file} changed, and they are what ci runs.`,
      blocks: false,
    })
  }
  return reasons
}

export const verdict = ({ owner, reasons, headPrints, approvedPrints, forkPrints, approvedForkPrints }) => {
  if (reasons.length === 0) return { pass: true, listed: false, lines: ["Nothing here touches the bar."] }
  const blocking = reasons.filter((reason) => reason.blocks)
  const lines = [
    ...blocking.map((reason) => `Lowers the bar: ${reason.text}`),
    ...reasons
      .filter((reason) => !reason.blocks)
      .map((reason) => `Listed for ${owner}, does not block: ${reason.text}`),
  ]
  if (blocking.length === 0) return { pass: true, listed: true, lines }
  const ask = `Undo what lowers the bar. Only an approval from ${owner} lets it through as it is.`
  if (approvedPrints === undefined) return { pass: false, listed: true, lines: [...lines, ask] }
  const moved = blocking.filter((reason) => headPrints[reason.about] !== approvedPrints[reason.about])
  const rebased = blocking.filter((reason) => forkPrints[reason.about] !== approvedForkPrints[reason.about])
  if (moved.length === 0 && rebased.length === 0) {
    return { pass: true, listed: true, lines: [...lines, `${owner} approved this.`] }
  }
  return {
    pass: false,
    listed: true,
    lines: [
      ...lines,
      ...moved.map((reason) => `Changed since ${owner} approved: ${reason.about}.`),
      ...rebased.map((reason) => `Changed on main since ${owner} approved: ${reason.about}.`),
      ask,
    ],
  }
}

export const approvedCommit = (owner, reviews) => {
  const latest = reviews.filter((review) => review.user === owner && review.state !== "COMMENTED").at(-1)
  return latest !== undefined && latest.state === "APPROVED" ? latest.commit : undefined
}

const mayAllow = new Set(["OWNER", "MEMBER"])

export const allowedCommit = (comments, sha) =>
  comments.some(
    (comment) =>
      mayAllow.has(comment.role) && typeof comment.body === "string" && comment.body.trim() === `owner-allows ${sha}`,
  )
    ? sha
    : undefined

const github = (args) =>
  execFileSync("gh", ["api", ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  })

const rows = (endpoint, shape) =>
  github(["--paginate", endpoint, "--jq", `.[] | ${shape} | @json`])
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line))

export const readComments = (repository, number) =>
  rows(`repos/${repository}/issues/${number}/comments`, "{body, role: .author_association}")

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

const blobAt = (repository, sha, file) => {
  try {
    return github([contents(repository, sha, file), "--jq", ".sha"]).trim()
  } catch (error) {
    if (missing(error)) return "absent"
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

const printsAt = (repository, sha, reasons) => {
  const json = githubJson(repository)
  const metrics = metricsAt(json, sha) ?? {}
  const cases = casesAt(json, sha)
  const corpus = corpusAt(json, sha)
  const proof = proofAt(json, sha)
  const prints = {}
  for (const { about } of reasons) {
    const [kind, ...rest] = about.split(" ")
    const subject = rest.join(" ")
    if (kind === "metric") prints[about] = JSON.stringify(metrics[subject])
    if (kind === "file") prints[about] = blobAt(repository, sha, subject)
    if (kind === "scripts") prints[about] = scriptsAt(json, sha, subject)
    if (kind === "break") prints[about] = JSON.stringify(proof[subject])
    if (kind === "case") prints[about] = JSON.stringify(cases.filter((row) => String(row.name) === subject))
    if (kind === "deck") prints[about] = JSON.stringify(corpus.filter((row) => String(row.name) === subject))
  }
  return prints
}

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
    removedTests: removedTestFiles(listed),
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
  const pull = JSON.parse(github([pulls, "--jq", "{head: .head.sha, base: .base.sha, files: .changed_files} | @json"]))
  const forkOf = (sha) =>
    github([`repos/${repository}/compare/${pull.base}...${sha}`, "--jq", ".merge_base_commit.sha"]).trim()
  const fork = forkOf(pull.head)
  const listed = rows(`${pulls}/files`, "{name: .filename, before: .previous_filename, status}")
  if (listed.length !== pull.files) {
    throw new Error(`This pull request changes ${pull.files} files and only ${listed.length} can be read. Split it.`)
  }
  const owner = repository.split("/")[0]
  const reasons = readReasons({ json: githubJson(repository), fork, head: pull.head, listed })
  const reviews = rows(`${pulls}/reviews`, "{user: .user.login, state, commit: .commit_id}")
  const commit = reasons.some((reason) => reason.blocks)
    ? (approvedCommit(owner, reviews) ?? allowedCommit(readComments(repository, number), pull.head))
    : undefined
  return {
    owner,
    reasons,
    headPrints: printsAt(repository, pull.head, reasons),
    approvedPrints: commit === undefined ? undefined : printsAt(repository, commit, reasons),
    forkPrints: commit === undefined ? undefined : printsAt(repository, fork, reasons),
    approvedForkPrints: commit === undefined ? undefined : printsAt(repository, forkOf(commit), reasons),
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

export const localWarning = (check, owner) =>
  `Warning: the ${check} check on GitHub blocks this unless ${owner} approves it. This step passes, and GitHub judges.`

export const ownerOf = (remote) => /github\.com[:/]([^/]+)\//.exec(remote ?? "")?.[1] ?? "the repo owner"

const localJson = (root) => (tree, file) => {
  try {
    return JSON.parse(localGit(root, ["show", `${tree}:${file}`]))
  } catch {
    return undefined
  }
}

export const localOwner = (root) => {
  try {
    return ownerOf(localGit(root, ["config", "--get", "remote.origin.url"]).trim())
  } catch {
    return ownerOf(undefined)
  }
}

export const readLocal = (root) => {
  const { fork, why } = localFork(root)
  if (why !== undefined) return { why }
  const head = workingTree(root)
  const listed = listedFiles(localGit(root, ["diff", "--name-status", "-z", "-M", fork, head]))
  return {
    owner: localOwner(root),
    reasons: readReasons({ json: localJson(root), fork, head, listed }),
    headPrints: {},
  }
}

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self && process.argv[2] === "local") {
  try {
    const read = readLocal(path.resolve(process.argv[3] ?? "."))
    if (read.why !== undefined) console.log(read.why)
    const result = read.why === undefined ? verdict(read) : { pass: true, lines: [] }
    for (const line of result.lines) console.log(line)
    if (!result.pass) console.log(localWarning("ratchet", read.owner))
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
} else if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const [repository, number] = process.argv.slice(2)
  try {
    const result = verdict(readPull(repository, number))
    for (const line of result.lines) console.log(line)
    if (result.listed && process.argv.includes("--label")) {
      try {
        github(["-X", "POST", `repos/${repository}/issues/${number}/labels`, "-f", "labels[]=changes-ci"])
      } catch (error) {
        console.log(`The label could not be added: ${String(error.stderr ?? error.message).trim()}`)
      }
    }
    if (!result.pass) process.exit(1)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
