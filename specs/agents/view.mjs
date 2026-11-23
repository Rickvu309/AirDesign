const steps = {
  AgentReads: "an agent reads the deck",
  AgentStarts: "an agent edits x without a runId, starting a run",
  AgentWrites: "an agent edits x naming a run",
  AgentStops: "an agent stops a run",
  Done: "nothing is left to do",
}

const runs = ["a1", "a2", "b1", "b2"]

const running = (v) => runs.filter((run) => v[`p${run}`] === "running")

export const state = (v) => {
  const live = running(v)
  const stopped = runs.filter((run) => v[`p${run}`] === "stopped")
  return `x at version ${v.ver}, ${live.length === 0 ? "no run running" : `${live.join(" and ")} running`}${stopped.length === 0 ? "" : `, ${stopped.join(" and ")} stopped`}, a read ${v.readA}, b read ${v.readB}${v.out === "none" ? "" : `, the last call was answered ${v.out}`}`
}

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  const live = running(v)
  const a = live.some((run) => run.startsWith("a"))
  const b = live.some((run) => run.startsWith("b"))
  return a && b ? "both running" : a ? "a running" : b ? "b running" : "none running"
}

export const colors = {
  "none running": "gray",
  "a running": "teal",
  "b running": "blue",
  "both running": "purple",
}

export const title = "Each agent works in its own run, and no agent's edit silently replaces another's"
