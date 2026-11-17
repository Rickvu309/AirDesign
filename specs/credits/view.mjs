const steps = {
  ResetA: "request or retry the first $5 reset",
  ResetB: "request or retry the second $5 reset",
  Reserve: "reserve an Aira turn",
  Finish: "finish the Aira turn",
  Monday: "apply the next weekly renewal when no turn is open",
}

export const state = (v) =>
  `$${v.cents / 100} credits, ${v.spent / 1000000000} usage, turn ${v.open ? "open" : "closed"}, week ${v.monday}, resets ${Number(v.onceA) + Number(v.onceB)}`
export const step = (action) => steps[action] ?? null
export const group = (v) => (v.open ? "Open" : v.cents < 500 ? "No credits" : "Ready")
export const colors = { Open: "blue", "No credits": "gray", Ready: "teal" }
export const title = "A usage reset charges $5 once, and never during an open turn or weekly renewal"
