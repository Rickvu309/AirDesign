import { judge } from "./design-findings.mjs"

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
