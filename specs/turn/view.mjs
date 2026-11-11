const steps = {
  TurnStart: "the account's first edit starts a turn",
  AgentEdit: "the agent edits an element in the turn",
  PersonEdit: "a person edits an element",
  Stop: "the agent stops the run and the turn ends",
  Undo: "the agent undoes the run and the turn ends",
  Idle: "the idle window passes and the turn ends",
  Refused: "a refused call changes nothing",
}

export const state = (v) => `turn ${v.turn}, x ${v.stateX}, y ${v.stateY}, last ${v.outcome} on ${v.landedOn}`

export const step = (action) => steps[action] ?? null

export const group = (v) => (v.turn === "live" ? "In a turn" : "Between turns")

export const colors = {
  "In a turn": "teal",
  "Between turns": "gray",
}

export const title = "A person's edit closes an element to agent writes until the turn ends"
