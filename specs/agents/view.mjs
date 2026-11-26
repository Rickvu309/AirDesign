const steps = {
  AgentReads: "an agent reads x without starting a run",
  PersonTypes: "the person changes x",
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
  return `x at version ${v.ver}${v.person ? " from the person" : ""}, a read ${v.readA}, b read ${v.readB}, ${live.length === 0 ? "no run running" : `${live.join(" and ")} running`}${stopped.length === 0 ? "" : `, ${stopped.join(" and ")} stopped`}${v.out === "none" ? "" : `, the last call was answered ${v.out}`}`
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

export const title = "Agents keep their own runs and preserve edits they have yet to read"
