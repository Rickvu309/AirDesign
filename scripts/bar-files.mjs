const testFile = /\.(?:test|spec)\.[cm]?[jt]sx?$/
const toolFiles = new Set([
  "scripts/areas.json",
  "scripts/areas.mjs",
  "scripts/ci-failure-report.mjs",
  "scripts/detach.mjs",
  "scripts/failed-tests.mjs",
  "scripts/github-read.mjs",
  "scripts/job-logs.mjs",
  "scripts/land-follow.mjs",
  "scripts/land-git.mjs",
  "scripts/land-harness.mjs",
  "scripts/land-report.mjs",
  "scripts/land-status.mjs",
  "scripts/land.mjs",
  "scripts/machine-lock.mjs",
  "scripts/merge-queue.mjs",
  "scripts/new-package.mjs",
  "scripts/production-commit.mjs",
  "scripts/pull-edit.mjs",
  "scripts/queue-drop.mjs",
  "scripts/red-main-revert.mjs",
  "scripts/red-main-verdict.mjs",
  "scripts/red-main.sh",
  "scripts/worktrees.mjs",
])
const judgeFolders = [".github/workflows/", ".github/actions/", "scripts/", "tooling/"]
const speedBudgetFile = "tests/browser/editor-speed-budget.ts"
const judgeFiles = new Set([".github/pull_request_template.md", speedBudgetFile])
const judgeNames = [
  /^tsconfig.*\.json$/,
  /^\.?oxlintrc\.json$/,
  /^\.oxfmtrc\.json$/,
  /^vitest\./,
  /^playwright\.config\./,
]
const nameOf = (file) => file.slice(file.lastIndexOf("/") + 1)

const kinds = [
  ["other", (file) => file.endsWith(".rule.md")],
  ["test", (file) => testFile.test(file)],
  ["fixture", (file) => /(?:^|\/)[a-z-]*fixtures\//.test(file)],
  ["spec", (file) => file.startsWith("specs/")],
  ["tool", (file) => toolFiles.has(file)],
  [
    "judge",
    (file) =>
      judgeFiles.has(file) ||
      judgeFolders.some((folder) => file.startsWith(folder)) ||
      judgeNames.some((pattern) => pattern.test(nameOf(file))),
  ],
]

const kindOf = (file) => kinds.find(([, holds]) => holds(file))?.[0] ?? "other"

export const judges = (file) => kindOf(file) === "judge"

export const netLines = (before = "", after = "") => {
  const left = new Map()
  for (const line of before.split("\n")) left.set(line, (left.get(line) ?? 0) + 1)
  const added = []
  for (const line of after.split("\n")) {
    if ((left.get(line) ?? 0) > 0) left.set(line, left.get(line) - 1)
    else added.push(line)
  }
  const removed = [...left].flatMap(([line, count]) => Array(count).fill(line))
  return { added: added.filter((line) => line.trim() !== ""), removed: removed.filter((line) => line.trim() !== "") }
}

const minus = (base, head) => [...new Set(base)].filter((name) => !head.includes(name))

const checkRows = (text = "") =>
  text
    .split(/(?=\bname: ")/)
    .slice(1)
    .map((row) => ({
      name: row.match(/^name: "([^"]+)"/)[1],
      runs: `${row.match(/command: "[^"]*"/)?.[0]} ${row.match(/args: \[[^\]]*\]/)?.[0]}`,
      blocks: !/kind: "report"/.test(row) && !/verdict: "warn/.test(row),
      where: row.match(/where: "([^"]+)"/)?.[1] ?? "everywhere",
    }))

const rowsLowered = (file, { base, head }) => {
  const before = checkRows(base)
  const after = checkRows(head)
  const named = new Set(before.map((row) => row.name))
  const renamed = (row) => after.find((each) => !named.has(each.name) && each.runs === row.runs)
  return before.flatMap((row) => {
    const now = after.find((each) => each.name === row.name) ?? renamed(row)
    if (now === undefined) return [`The check step ${row.name} was removed.`]
    return [
      ...(row.blocks && !now.blocks ? [`The check step ${row.name} no longer blocks.`] : []),
      ...(row.where === "everywhere" && now.where !== "everywhere"
        ? [`The check step ${row.name} now runs only ${now.where}.`]
        : []),
    ]
  })
}

const jobsOf = (text = "") => {
  const block = text.split(/^jobs:\s*$/m)[1] ?? ""
  return [...block.matchAll(/^ {2}([\w-]+):\s*$/gm)].map((match) => match[1])
}
const needsOf = (text = "") =>
  [...text.matchAll(/^\s+needs:\s*\[?([^\]\n]*)\]?\s*$/gm)].flatMap((match) =>
    match[1].split(",").map((name) => name.trim()),
  )

const workflowLowered = (file, { base, head }) => [
  ...minus(jobsOf(base), jobsOf(head)).map((job) => `The job ${job} in ${file} was removed.`),
  ...minus(needsOf(base), needsOf(head)).map((job) => `A job in ${file} no longer needs ${job}.`),
]

const specNames = (text = "") =>
  [...text.matchAll(/^(?:INVARIANTS?|PROPERTY|PROPERTIES)\b([^\n]*(?:\n[ \t]+[^\n]+)*)/gm)].flatMap((match) =>
    match[1].split(/\s+/).filter((name) => name !== ""),
  )

const specLowered = (file, { base, head }) =>
  specNames(head).length < specNames(base).length
    ? minus(specNames(base), specNames(head)).map((name) => `${file} no longer checks ${name}.`)
    : []

const parsed = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

const failing = (level) => ["error", "deny", 2].includes(Array.isArray(level) ? level[0] : level)

const lintLowered = (file, { base, head }) => {
  const before = parsed(base)?.rules ?? {}
  const after = parsed(head)?.rules ?? {}
  return Object.keys(before)
    .filter((rule) => failing(before[rule]) && !failing(after[rule]))
    .map((rule) => `The lint rule ${rule} no longer fails in ${file}.`)
}

const strictOption = /^(?:strict|noImplicit|noUnused|noUnchecked|noFallthrough|noPropertyAccess|exactOptional)/

const typesLowered = (file, { base, head }) => {
  const before = parsed(base)?.compilerOptions ?? {}
  const after = parsed(head)?.compilerOptions ?? {}
  return Object.keys(before)
    .filter((option) => strictOption.test(option) && before[option] === true && after[option] !== true)
    .map((option) => `${file} turned off ${option}.`)
}

const skipped = /^\s*(?:it|test|describe|suite)(?:\.\w+)*\.(?:skip|skipIf|only|todo|fixme)\b/
const testsLowered = (file, { lines }) => {
  const { added, removed } = lines
  const more = added.filter((line) => skipped.test(line)).length - removed.filter((line) => skipped.test(line)).length
  return more > 0 ? [`${file} skips ${more} more test${more === 1 ? "" : "s"}.`] : []
}

const limitWord = /limit|max|timeout|budget|tolerance|seconds|minutes|tokens|bytes/i
const numbersIn = (line) =>
  [...line.matchAll(/\d[\d_]*(?:\.\d+)?/g)].map((match) => Number(match[0].replaceAll("_", "")))
const shapeOf = (line) => line.replace(/\d[\d_]*(?:\.\d+)?/g, "#")

const raisedLimits = (file, { lines }) => {
  const { added, removed } = lines
  const left = [...added]
  return removed.flatMap((line) => {
    if (!limitWord.test(line)) return []
    const at = left.findIndex((other) => shapeOf(other) === shapeOf(line))
    if (at < 0) return []
    const [now] = left.splice(at, 1)
    const was = numbersIn(line)
    return numbersIn(now).some((number, index) => number > was[index])
      ? [`In ${file}, ${line.trim()} became ${now.trim()}.`]
      : []
  })
}

const speedLimits = (text = "") => {
  const limits = new Map()
  const sections = [
    ["local", /const localTiming = \{([^}]*)\}/],
    ["CI", /const ciTiming = \{([^}]*)\}/],
    ["shared", /export const editorSpeedBudget = [^\n]*=> \(\{([^}]*)\}\)/],
  ]
  for (const [scope, section] of sections) {
    const body = text.match(section)?.[1] ?? ""
    for (const [, name, value] of body.matchAll(/^\s*(\w+):\s*(\d[\d_]*(?:\.\d+)?),?\s*$/gm)) {
      if (name === "slides") continue
      limits.set(`${scope} ${name}`, {
        value: Number(value.replaceAll("_", "")),
        minimum: name === "typePreviewRedraws",
      })
    }
  }
  return limits
}

const speedBudgetLowered = (file, { base, head }) => {
  const before = speedLimits(base)
  const after = speedLimits(head)
  return [...before].flatMap(([name, limit]) => {
    const now = after.get(name)?.value ?? limit.value
    const looser = limit.minimum ? now < limit.value : now > limit.value
    return looser ? [`In ${file}, ${name} went from ${limit.value} to ${now}.`] : []
  })
}

const workflowFile = (file) => file.startsWith(".github/workflows/") || file.startsWith(".github/actions/")
const lintFile = (file) => /^\.?oxlintrc\.json$/.test(nameOf(file))
const typesFile = (file) => /^tsconfig.*\.json$/.test(nameOf(file))

const detectors = [
  [(file) => file === "scripts/check-steps.mjs", rowsLowered],
  [workflowFile, workflowLowered],
  [(file) => kindOf(file) === "spec" && file.endsWith(".cfg") && !file.endsWith(".known.cfg"), specLowered],
  [lintFile, lintLowered],
  [typesFile, typesLowered],
  [(file) => /\.(?:test|spec)\.tsx?$/.test(file), testsLowered],
  [(file) => file === speedBudgetFile, speedBudgetLowered],
  [(file) => file !== speedBudgetFile && judges(file), raisedLimits],
]

export const patchLines = (patch) => {
  const lines = patch.split("\n").filter((line) => !line.startsWith("+++ ") && !line.startsWith("--- "))
  const side = (mark) => lines.filter((line) => line.startsWith(mark)).map((line) => line.slice(1))
  return netLines(side("-").join("\n"), side("+").join("\n"))
}

export const lowerings = (file, read) => {
  return detectors.flatMap(([applies, lowers]) => (applies(file.name) ? lowers(file.name, read(file)) : []))
}
