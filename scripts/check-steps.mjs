import os from "node:os"
import path from "node:path"
import { smallLaneCommand } from "./machine-lock.mjs"

export const specCache = path.join(os.homedir(), ".cache", "airdesign", "spec-results")
export const designScans = ["tests/browser/design-states.spec.ts", "tests/browser/every-screen.spec.ts"]
export const onCi = (env) => env.CI === "true" || env.CI === "1"

const exceptDesignScans = designScans.map((file) => path.basename(file).replaceAll(".", "\\.")).join("|")

const browserArgs = (part, shard) =>
  part === "design"
    ? designScans
    : part === "browser"
      ? [
          "--grep-invert",
          exceptDesignScans,
          ...(shard === undefined ? [] : [`--shard=${shard.current}/${shard.total}`]),
        ]
      : []

const gateTests = ({ tests }, [name, command, args, env]) =>
  tests?.length ? [name, ...smallLaneCommand(command, [...args, "--maxWorkers=2", ...tests]), env] : undefined

const gateTooling = ({ tooling }, [name]) =>
  tooling?.length ? [name, "node", ["scripts/tooling-tests.mjs", ...tooling]] : undefined

const gateBuild = ({ packages }, [name, command]) =>
  packages?.length
    ? [
        name,
        command,
        [
          "--workspace-concurrency=1",
          ...packages.flatMap((folder) => ["--filter", `...{./${folder}}`]),
          "-r",
          "--if-present",
          "run",
          "build",
        ],
      ]
    : undefined

const rows = [
  {
    name: "format",
    kind: "rule",
    command: "pnpm",
    args: ["exec", "oxfmt", "--check"],
    preflight: true,
    gate: { order: 2 },
    failureHint: "Run pnpm exec oxfmt <files> and commit again.",
  },
  {
    name: "lint",
    kind: "rule",
    command: "pnpm",
    args: ["lint"],
    preflight: true,
    gate: { order: 3 },
    showOnSuccess: true,
  },
  { name: "copy-in-tests", kind: "rule", command: "node", args: ["scripts/copy-literals.mjs"], gate: { order: 11 } },
  {
    name: "test-imports",
    kind: "rule",
    command: "node",
    args: ["scripts/browser-imports.mjs"],
    part: "all",
    preflight: true,
    gate: { order: 1 },
  },
  { name: "actionlint", kind: "rule", command: "node", args: ["scripts/actionlint.mjs"], gate: { order: 10 } },
  {
    name: "unit-tests",
    kind: "tests",
    command: "node",
    args: ["node_modules/vitest/vitest.mjs", "run"],
    env: { AIRDESIGN_REPLAY_ONLY: "1", AIRDESIGN_SPEC_CACHE: specCache },
    gate: { order: 2, select: gateTests },
    localLimit: 720,
    judgedOnCi: true,
    rerunAlone: true,
  },
  {
    name: "script-tests",
    kind: "tests",
    command: "pnpm",
    args: ["test:tooling"],
    part: "scripts",
    gate: { order: 3, select: gateTooling },
  },
  {
    name: "lint-rules",
    kind: "rule",
    command: "node",
    args: ["scripts/bug-rule.mjs"],
    preflight: true,
    gate: { order: 6 },
    showOnSuccess: true,
  },
  {
    name: "file-growth",
    kind: "rule",
    command: "node",
    args: ["scripts/file-size.mjs"],
    preflight: true,
    gate: { order: 4 },
    verdict: "warn-in-queue",
  },
  {
    name: "tsconfig-references",
    kind: "rule",
    command: "node",
    args: ["scripts/reference-order.mjs"],
    preflight: true,
    gate: { order: 5 },
  },
  {
    name: "unused-exports",
    kind: "rule",
    command: "node",
    args: ["scripts/interface-width.mjs"],
    preflight: true,
    gate: { order: 9 },
  },
  {
    name: "sweep-list",
    kind: "report",
    command: "node",
    args: ["scripts/sweep.mjs"],
    gate: { order: 12 },
    showOnSuccess: true,
  },
  {
    name: "commit-authors",
    kind: "rule",
    command: "node",
    args: ["scripts/commit-authors.mjs"],
    preflight: true,
    gate: { order: 7 },
    showOnSuccess: true,
  },
  { name: "commit-titles", kind: "rule", command: "node", args: ["scripts/commit-titles.mjs"], verdict: "warn" },
  { name: "conflict-markers", kind: "rule", command: "node", args: ["scripts/conflict-markers.mjs"], verdict: "warn" },
  {
    name: "migration-numbers",
    kind: "rule",
    command: "node",
    args: ["scripts/migration-numbers.mjs"],
    verdict: "warn",
  },
  { name: "restored-files", kind: "rule", command: "node", args: ["scripts/stale-tree.mjs"], verdict: "warn" },
  {
    name: "model-check",
    kind: "tests",
    command: "pnpm",
    args: ["check:specs"],
    env: { AIRDESIGN_SPEC_CACHE: specCache },
    showOnSuccess: true,
  },
  { name: "spec-coverage", kind: "rule", command: "node", args: ["scripts/spec-replays.mjs"], verdict: "warn" },
  { name: "spec-drift", kind: "rule", command: "node", args: ["scripts/spec-sync.mjs"], verdict: "warn" },
  {
    name: "browser-tests",
    kind: "tests",
    command: "pnpm",
    args: ["test:browser"],
    part: ["design", "browser"],
    where: "ci",
    partArgs: browserArgs,
    judgedOnCi: true,
    stampOnFailure: true,
  },
  {
    name: "package-boundaries",
    kind: "rule",
    command: "pnpm",
    args: ["check:boundaries"],
    preflight: true,
    gate: { order: 8 },
  },
  { name: "typecheck", kind: "rule", command: "pnpm", args: ["typecheck"], lane: "outputs" },
  {
    name: "build",
    kind: "build",
    command: "pnpm",
    args: ["--filter", "!@airdesign/site", "-r", "--if-present", "run", "build"],
    lane: "outputs",
    gate: { order: 1, select: gateBuild },
  },
  {
    name: "site-build",
    kind: "build",
    command: "pnpm",
    args: ["--filter", "@airdesign/site...", "run", "build"],
    part: "scripts",
    lane: "outputs",
  },
  {
    name: "bar",
    kind: "report",
    command: "node",
    args: ["scripts/bar.mjs", "local"],
    where: "local",
    showOnSuccess: true,
  },
  {
    name: "metrics",
    kind: "rule",
    command: "node",
    args: ["scripts/metrics.mjs"],
    after: "work",
    showOnSuccess: true,
  },
  {
    name: "design-findings",
    kind: "rule",
    command: "node",
    args: ["scripts/design-findings.mjs"],
    after: "work",
    part: "design",
    where: "ci",
    verdict: "warn",
  },
]

const defaultPart = "source"

const partsOf = ({ part = defaultPart }) => (Array.isArray(part) ? part : [part])

const tuple = ({ name, command, args = [], env, partArgs }, part, shard) => [
  name,
  command,
  [...args, ...(partArgs?.(part, shard) ?? [])],
  ...(env === undefined ? [] : [env]),
]

const wrapStage = (steps) => (steps.length === 0 ? [] : [steps])

const stageFor = (rows, part, shard) => {
  const lanes = new Map()
  const entries = []
  for (const row of rows) {
    const step = tuple(row, part, shard)
    if (row.lane === undefined) {
      entries.push(step)
    } else {
      if (!lanes.has(row.lane)) {
        const lane = []
        lanes.set(row.lane, lane)
        entries.push(lane)
      }
      lanes.get(row.lane).push(step)
    }
  }
  return entries
}

const validate = (rows) => {
  const names = new Set()
  const gateOrders = { cheap: new Set(), affected: new Set() }
  let rerun
  for (const row of rows) {
    const refuse = (fix) => {
      throw new Error(`${row.name}: ${fix}.`)
    }
    const { name, kind, command, where = "everywhere", verdict, after, lane, gate, preflight } = row
    if (typeof name !== "string" || !/^[a-z][a-z0-9-]*$/.test(name)) refuse("give the step a lowercase name")
    if (names.has(name)) refuse("give each step a unique name")
    names.add(name)
    if (!["rule", "tests", "build", "report"].includes(kind)) refuse("set kind to rule, tests, build, or report")
    if (typeof command !== "string" || !command.trim()) refuse("set command to an executable")
    const parts = partsOf(row)
    if (
      parts.length === 0 ||
      new Set(parts).size !== parts.length ||
      parts.some((part) => typeof part !== "string" || !/^[a-z][a-z0-9-]*$/.test(part)) ||
      (parts.includes("all") && row.part !== "all")
    )
      refuse("name one or more distinct parts, or use all")
    if (!["everywhere", "local", "ci"].includes(where)) refuse("set where to everywhere, local, or ci")
    if (kind === "report" && verdict !== undefined) refuse("remove verdict from the report")
    if (verdict !== undefined && !["block", "warn", "warn-in-queue"].includes(verdict))
      refuse("set verdict to block, warn, or warn-in-queue")
    if (after !== undefined && after !== "work") refuse("set after to work or omit it")
    if (preflight && (lane !== undefined || after !== undefined))
      refuse("remove preflight or run outside the lane and stage barrier")
    if (preflight && gate?.select !== undefined) refuse("remove preflight or select this step in the cheap gate")
    if (gate !== undefined) {
      if (where === "ci") refuse("remove gate or allow this step locally")
      if (!Number.isInteger(gate?.order) || gate.order < 1) refuse("give gate a positive integer order")
      if (gate.select !== undefined && typeof gate.select !== "function") refuse("make gate.select a function")
      const orders = gate.select === undefined ? gateOrders.cheap : gateOrders.affected
      if (orders.has(gate.order)) refuse("give each gate step in this phase a unique order")
      orders.add(gate.order)
    }
    if (row.rerunAlone) {
      if (kind !== "tests" || !row.judgedOnCi || gate?.select === undefined)
        refuse("give a rerun a gate selector on a test judged on ci")
      if (rerun !== undefined) refuse("give only one gate step a rerun")
      rerun = row
    }
    if (row.stampOnFailure && !row.judgedOnCi) refuse("set judgedOnCi to allow a stamp after failure")
  }
  return rerun
}

export const defineCheckSteps = (rows) => {
  const rerun = validate(rows)
  const byName = new Map(rows.map((row) => [row.name, row]))
  const parts = [...new Set(rows.flatMap(partsOf).filter((part) => part !== "all"))]
  const gate = rows.filter((row) => row.gate !== undefined).toSorted((a, b) => a.gate.order - b.gate.order)
  const runsOn = (name, ci) => byName.get(name)?.where !== (ci ? "local" : "ci")
  return {
    parts: () => [...parts],
    stagesFor: (part, ci = onCi(process.env), shard) => {
      const chosen = rows.filter(
        (row) => runsOn(row.name, ci) && (part === "all" || row.part === "all" || partsOf(row).includes(part)),
      )
      return [
        stageFor(
          chosen.filter((row) => row.after === undefined),
          part,
          shard,
        ),
        stageFor(
          chosen.filter((row) => row.after === "work"),
          part,
          shard,
        ),
      ].filter((stage) => stage.length > 0)
    },
    cheapGateStages: () => wrapStage(gate.filter((row) => row.gate.select === undefined).map((row) => tuple(row))),
    affectedGateStages: (selection) =>
      wrapStage(gate.map((row) => row.gate.select?.(selection, tuple(row))).filter((step) => step !== undefined)),
    aloneCommand: (file) => rerun.gate.select({ tests: [file] }, tuple(rerun)).slice(1),
    rerunsAlone: (name) => name === rerun?.name,
    kindOf: (name) => byName.get(name)?.kind,
    isPreflight: (name) => byName.get(name)?.preflight === true,
    showsOutput: (name) => byName.get(name)?.showOnSuccess === true,
    failureHint: (name) => byName.get(name)?.failureHint,
    stepLimit: (name, ci) => (ci ? undefined : (byName.get(name)?.localLimit ?? 480)),
    mayPush: (failed, ran) => ran && failed.every((name) => byName.get(name)?.judgedOnCi === true),
    stampable: (failed, ran) => ran && failed.every((name) => byName.get(name)?.stampOnFailure === true),
    warns: (name, event) => {
      const verdict = byName.get(name)?.verdict
      return verdict === "warn" || (verdict === "warn-in-queue" && event === "merge_group")
    },
  }
}

export const checkSteps = defineCheckSteps(rows)

export const partOf = (argv) => {
  const given = argv.find((word) => word.startsWith("--part="))
  if (given === undefined) return "all"
  const part = given.slice("--part=".length)
  const parts = checkSteps.parts()
  if (!parts.includes(part)) throw new Error(`--part must be one of ${parts.join(", ")}, and it is ${part}.`)
  return part
}

export const shardOf = (argv) => {
  const given = argv.find((word) => word.startsWith("--shard="))
  if (given === undefined) return undefined
  const value = given.slice("--shard=".length)
  const [current, total] = /^[1-9]\d*\/[1-9]\d*$/.test(value) ? value.split("/").map(Number) : []
  if (current === undefined || current > total)
    throw new Error(`--shard must be a part of a whole, such as 1/3, and it is ${value}.`)
  return { current, total }
}
