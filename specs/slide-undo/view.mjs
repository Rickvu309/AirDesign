const steps = {
  AgentAddsSlide: "the agent reads the deck and adds a slide under the turn's run",
  AgentStops: "the agent stops r, the deck records r ended, and the turn ends",
  PersonMoves: "a person moves a slide r added",
  PersonDeletes: "a person deletes D again after a run Undo brought it back",
  PersonUndoes: "a person asks for run Undo of r",
  Done: "nothing is left to do",
}

export const state = (v) =>
  `deck at ${v.rev}, ${v.shown} slides of r show${v.moved ? ", a person moved one" : ""}, turn ${v.turn}` +
  `${v.dropped ? `, r deleted D, D ${v.dShows ? "shows" : "is gone"}` : ""}${v.fenced ? ", fenced" : ""}` +
  `${v.ended ? ", r ended" : ""}${v.undone ? ", r undone" : ""}${v.afterUndo > 0 ? `, ${v.afterUndo} slides of r landed after its Undo` : ""}` +
  `${v.told === "none" ? "" : `, last Undo ${v.told}`}`

export const step = (action) => steps[action] ?? null

export const group = (v) => (v.undone ? "After run Undo" : "Before run Undo")

export const colors = {
  "Before run Undo": "teal",
  "After run Undo": "gray",
}

export const title = "Run Undo of slide commands is all or nothing, and nothing of the run lands after it"
