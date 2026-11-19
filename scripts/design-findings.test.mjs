import { gather, judge, reportFile } from "./design-findings.mjs"

const finding = (rank, detector) => ({ rank, detector, selector: "[data-editor-panel]", message: `${detector} found` })
const reports = [
  {
    rows: [{ page: "/screens/s42-01", findings: [finding(2, "text-contrast")] }],
    used: [0],
    failures: [],
    seconds: 1.25,
  },
  {
    rows: [{ page: "agent-working", findings: [finding(1, "internal-identifier")] }],
    used: [],
    failures: [{ page: "agent-failed", error: "journey aira-panel never reached failed" }],
    seconds: 20,
  },
]
const entries = [
  { index: 0, page: "/screens/*", detector: "text-contrast", selector: "[data-slide-label]", reason: "used" },
  { index: 1, page: "agent-*", detector: "empty-region", selector: "[role=log]", reason: "stale" },
]

const result = judge({ reports, entries, recorded: { now: 2, goal: 0 } })
if (result.count !== 2)
  throw new Error(`design-findings counts every finding on every page, and it counted ${result.count}`)
if (result.seconds !== 21.3)
  throw new Error(`design-findings adds the scan time of both reports, and it gave ${result.seconds}`)
if (!result.lines[0].startsWith("rank 1 internal-identifier on agent-working"))
  throw new Error("design-findings does not list the worst finding first")
if (!result.problems.some((line) => line.includes("agent-failed was not scanned")))
  throw new Error("a state that was not reached is not reported")
if (!result.problems.some((line) => line.includes("entry 2") && line.includes("silences nothing")))
  throw new Error("an allow entry that silences nothing is not reported")
if (result.problems.some((line) => line.includes("entry 1"))) throw new Error("a used allow entry is reported as stale")
if (result.problems.some((line) => line.includes("Record")))
  throw new Error("a count equal to metrics.json is reported as drift")

const drifted = judge({ reports, entries, recorded: { now: 5, goal: 0 } })
if (!drifted.problems.includes("design-findings is 2 and metrics.json says 5. Record 2 in metrics.json."))
  throw new Error("a count that differs from metrics.json is not reported")

const names = (files) => gather(files.map((file) => `design-${file}.json`))
const whole = names(["screens-1-of-1", "states-2-of-2", "states-1-of-2"])
if (JSON.stringify(whole.problems) !== "[]")
  throw new Error(`every shard of every design scan is here, and design-findings refuses them: ${whole.problems}`)
if (whole.files.join() !== "design-screens-1-of-1.json,design-states-1-of-2.json,design-states-2-of-2.json")
  throw new Error(`design-findings must judge every shard's report, and it reads ${whole.files}`)
const lostShard = names(["screens-1-of-1", "states-1-of-2"])
if (
  lostShard.problems.join() !== "No design report for states shard 2 of 2. Its design job did not finish; read its log."
)
  throw new Error(`a missing design shard must fail design-findings, and it said ${lostShard.problems}`)
const noScan = names(["states-1-of-1"])
if (noScan.problems.join() !== "No design report for screens. The browser tests write them; run pnpm test:browser.")
  throw new Error(`a design scan with no report must fail design-findings, and it said ${noScan.problems}`)
const twoSplits = names(["screens-1-of-1", "states-1-of-1", "states-1-of-2", "states-2-of-2"])
if (!twoSplits.problems.join().includes("states come from splits into 1 and 2 shards"))
  throw new Error(`reports from two different splits must fail design-findings, and it said ${twoSplits.problems}`)
if (
  names(["screens-1-of-1", "states-1-of-1"]).problems.length !== 0 ||
  gather(["browser-timings.json"]).files.length !== 0
)
  throw new Error("design-findings must read only design reports")
if (!reportFile("/r", "states", { current: 2, total: 3 }).endsWith("test-results/design-states-2-of-3.json"))
  throw new Error("a design report must name its shard")

const unsplit = judge({
  reports: [
    {
      ...reports[0],
      rows: [...reports[0].rows, ...reports[1].rows],
      used: [0],
      failures: reports[1].failures,
      seconds: 21.25,
    },
  ],
  entries,
  recorded: { now: 2, goal: 0 },
})
if (JSON.stringify({ ...result, seconds: 0 }) !== JSON.stringify({ ...unsplit, seconds: 0 }))
  throw new Error("design-findings must judge the shards' reports as it judges one report of every state")
