const steps = {
  AgentReads: "an agent reads the deck",
  AgentEdits: "an agent edits x with the version it holds",
  AgentStops: "an agent stops the run its turn names",
  AgentStopsOther: "an agent names the other agent's run in stop_run",
  Idle: "ten minutes pass with no call from one agent",
  Done: "nothing is left to do",
}

export const state = (v) =>
  `x ${v.holder === "none" ? "runs under no run" : `runs under ${v.holder}`} at version ${v.ver}, a's turn ${v.turnA}${v.liveA ? "" : " (idle)"}, b's turn ${v.turnB}${v.liveB ? "" : " (idle)"}, a read ${v.readA}, b read ${v.readB}${v.who === "none" ? "" : `, ${v.who} was answered ${v.out}`}`

export const step = (action) => steps[action] ?? null

export const group = (v) =>
  v.holder === "none" ? "x free" : v.holder.startsWith("a") ? "x held by a's run" : "x held by b's run"

export const colors = {
  "x free": "gray",
  "x held by a's run": "teal",
  "x held by b's run": "blue",
}

export const title = "Each agent works in its own run, and no agent's edit silently replaces another's"
