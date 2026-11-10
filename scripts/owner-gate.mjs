import { execFileSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const guardedFolders = [".github/", "tooling/", "scripts/", "specs/"]
const openFolders = ["scripts/pptx-fixtures/"]
const guardedFiles = new Set([".node-version", ".npmrc", ".oxfmtrc.json", "AGENTS.md", "pnpm-workspace.yaml"])
const guardedNames = [/^tsconfig.*\.json$/, /^\.oxlintrc\.json$/, /^vitest\./, /^playwright\.config\./]
const casesFile = "scripts/pptx-fixtures/cases.json"
const proofFile = "scripts/pptx-fixtures/judge-proof.json"

export const guarded = (file) => {
  if (openFolders.some((folder) => file.startsWith(folder))) return false
  if (guardedFiles.has(file) || guardedFolders.some((folder) => file.startsWith(folder))) return true
  const name = file.slice(file.lastIndexOf("/") + 1)
  return guardedNames.some((pattern) => pattern.test(name))
}

export const replacedFixtures = (files) =>
  files
    .filter((file) => file.status !== "added" && file.name !== casesFile && file.name !== proofFile)
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
const keysOf = (stick) =>
  stick !== null && typeof stick === "object" && !Array.isArray(stick) ? Object.keys(stick).sort().join() : ""
const timed = (stick) => keysOf(stick) === "limit" && finite(stick.limit)
const counted = (stick) => keysOf(stick) === "goal,now" && finite(stick.now) && finite(stick.goal)
const floored = (stick) => keysOf(stick) === "floor" && finite(stick.floor)

const recordsFaults = new Set(["known faults"])
const countsProof = new Set(["planted breaks the judge catches"])

const stickReason = (name, before, after) => {
  if (after === undefined) return `The stick ${name} was removed.`
  if (!timed(after) && !counted(after) && !floored(after)) {
    return `The stick ${name} must be only a limit, or only now and goal, or only a floor, as numbers.`
  }
  if (before === undefined) return undefined
  if (timed(before)) {
    if (!timed(after)) return `The stick ${name} stopped being a limit.`
    return after.limit <= before.limit ? undefined : `The limit of ${name} went from ${before.limit} to ${after.limit}.`
  }
  if (floored(before)) {
    if (!floored(after)) return `The stick ${name} stopped being a floor.`
    return after.floor >= before.floor ? undefined : `The floor of ${name} went from ${before.floor} to ${after.floor}.`
  }
  if (!counted(after)) return `The stick ${name} stopped being a count with a goal.`
  if (countsProof.has(name)) return undefined
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

export const lostKinds = (baseProof, headProof) =>
  Object.keys(baseProof).filter(
    (kind) => headProof[kind] === undefined || (baseProof[kind] === "caught" && headProof[kind] !== "caught"),
  )

export const ownerReasons = ({
  baseSticks,
  headSticks,
  changedFiles,
  changedScripts,
  changedCases = [],
  changedFixtures = [],
  removedTests = [],
  changedKinds = [],
}) => {
  const reasons = []
  for (const name of new Set([...Object.keys(baseSticks), ...Object.keys(headSticks)])) {
    const text = stickReason(name, baseSticks[name], headSticks[name])
    const recorded = recordsFaults.has(name) && text?.includes("away from its goal")
    if (text !== undefined) reasons.push({ about: `stick ${name}`, text, blocks: !recorded })
  }
  for (const file of changedFiles.filter(guarded)) {
    reasons.push({ about: `file ${file}`, text: `${file} decides what the gate checks.`, blocks: false })
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
      text: `The scripts in ${file} changed, and they are what the gate runs.`,
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

const missing = (error) => String(error.stderr ?? error.message).includes("HTTP 404")

export const contents = (repository, sha, file) =>
  `repos/${repository}/contents/${file.split("/").map(encodeURIComponent).join("/")}?ref=${sha}`

const jsonAt = (repository, sha, file) => {
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

const scriptsAt = (repository, sha, file) => JSON.stringify(jsonAt(repository, sha, file)?.scripts ?? {})

const casesAt = (repository, sha) => {
  const cases = jsonAt(repository, sha, casesFile)
  return Array.isArray(cases) ? cases : []
}

const proofAt = (repository, sha) => {
  const proof = jsonAt(repository, sha, proofFile)
  return proof !== null && typeof proof === "object" && !Array.isArray(proof) ? proof : {}
}

const printsAt = (repository, sha, reasons) => {
  const sticks = jsonAt(repository, sha, "sticks.json") ?? {}
  const cases = casesAt(repository, sha)
  const proof = proofAt(repository, sha)
  const prints = {}
  for (const { about } of reasons) {
    const [kind, ...rest] = about.split(" ")
    const subject = rest.join(" ")
    if (kind === "stick") prints[about] = JSON.stringify(sticks[subject])
    if (kind === "file") prints[about] = blobAt(repository, sha, subject)
    if (kind === "scripts") prints[about] = scriptsAt(repository, sha, subject)
    if (kind === "break") prints[about] = JSON.stringify(proof[subject])
    if (kind === "case") prints[about] = JSON.stringify(cases.filter((row) => String(row.name) === subject))
  }
  return prints
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
  const changedFiles = listed.flatMap((file) => [file.name, file.before].filter((name) => name != null))
  const baseSticks = jsonAt(repository, fork, "sticks.json")
  if (baseSticks === undefined) throw new Error("sticks.json could not be read where this branch left main.")
  const owner = repository.split("/")[0]
  const modelPackage = "packages/document"
  const generated = new Set()
  for (const file of listed) {
    const model = `${modelPackage}/${file.name.slice(file.name.lastIndexOf("/") + 1)}`
    if (
      newPackageFile(file, "tsconfig.json") &&
      sameButReferences(jsonAt(repository, pull.head, file.name), jsonAt(repository, fork, model))
    ) {
      generated.add(file.name)
    }
    if (
      newPackageFile(file, "package.json") &&
      scriptsAt(repository, pull.head, file.name) === scriptsAt(repository, fork, model)
    ) {
      generated.add(file.name)
    }
    if (
      file.name === "tsconfig.json" &&
      file.status === "modified" &&
      onlyAddsReferences(jsonAt(repository, fork, file.name), jsonAt(repository, pull.head, file.name))
    ) {
      generated.add(file.name)
    }
  }
  const reasons = ownerReasons({
    baseSticks,
    headSticks: jsonAt(repository, pull.head, "sticks.json") ?? {},
    changedFiles: changedFiles.filter((file) => !generated.has(file)),
    changedFixtures: replacedFixtures(listed),
    removedTests: removedTestFiles(listed),
    changedCases: changedFiles.includes(casesFile)
      ? lostCases(casesAt(repository, fork), casesAt(repository, pull.head))
      : [],
    changedKinds: changedFiles.includes(proofFile)
      ? lostKinds(proofAt(repository, fork), proofAt(repository, pull.head))
      : [],
    changedScripts: changedFiles
      .filter(packageFile)
      .filter((file) => !generated.has(file))
      .filter((file) => scriptsAt(repository, fork, file) !== scriptsAt(repository, pull.head, file)),
  })
  const reviews = rows(`${pulls}/reviews`, "{user: .user.login, state, commit: .commit_id}")
  const commit = reasons.some((reason) => reason.blocks) ? approvedCommit(owner, reviews) : undefined
  return {
    owner,
    reasons,
    headPrints: printsAt(repository, pull.head, reasons),
    approvedPrints: commit === undefined ? undefined : printsAt(repository, commit, reasons),
    forkPrints: commit === undefined ? undefined : printsAt(repository, fork, reasons),
    approvedForkPrints: commit === undefined ? undefined : printsAt(repository, forkOf(commit), reasons),
  }
}

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const [repository, number] = process.argv.slice(2)
  try {
    const result = verdict(readPull(repository, number))
    for (const line of result.lines) console.log(line)
    if (result.listed && process.argv.includes("--label")) {
      try {
        github(["-X", "POST", `repos/${repository}/issues/${number}/labels`, "-f", "labels[]=touched the bar"])
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
