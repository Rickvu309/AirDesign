const edits = { 0: "the file's", 1: "the person's step", 2: "the agent's", 3: "the undo", 4: "the redo" }

const steps = {
  PersonStep: "the person changes the shape's text and the slide's notes in one step",
  PersonUndo: "the person asks for an undo, on what their view shows",
  PersonRedo: "the person asks for a redo, on what their view shows",
  SyncStep: "the step reaches the server",
  SyncUndo: "the undo reaches the server",
  SyncRedo: "the redo reaches the server",
  AgentStart: "an agent's run starts",
  AgentStop: "the agent's run stops",
  AgentWrite: "the agent writes one property",
}

const props = (mask) =>
  [mask % 2 === 1 ? "the text" : null, mask >= 2 ? "the notes" : null].filter(Boolean).join(" and ")

const queued = (v) =>
  [
    v.s === "pending" ? "the step" : null,
    v.u === "pending" ? `an undo of ${props(v.uK)}` : null,
    v.r === "pending" ? `a redo of ${props(v.rK)}` : null,
  ]
    .filter(Boolean)
    .join(", ")

const outcomes = (v) =>
  [
    v.s === "refused" ? "the step was refused" : null,
    v.u === "dropped" ? "the undo found nothing to put back" : null,
    v.u === "refused" ? "the undo was refused" : null,
    v.r === "dropped" ? "the redo found nothing to put back" : null,
    v.r === "refused" ? "the redo was refused" : null,
    v.g === "fenced" || v.g === "person" ? `the agent's write was refused (${v.g})` : null,
  ]
    .filter(Boolean)
    .join(", ")

export const state = (v) =>
  `server: text is ${edits[v.vT]} value with rev ${edits[v.tT]}, notes ${edits[v.vN]} value with rev ${edits[v.tN]}; ` +
  `run ${v.run}` +
  `${v.gT || v.gN ? `, a person wrote ${props((v.gT ? 1 : 0) + (v.gN ? 2 : 0))} during it` : ""}` +
  `${v.g === "landed" ? ", the agent's write landed" : ""}` +
  `${queued(v) === "" ? "" : `; queued: ${queued(v)}`}` +
  `${outcomes(v) === "" ? "" : `; ${outcomes(v)}`}` +
  `${v.told === "none" ? "" : `; the person is told nothing changed (${v.told})`}`

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (v.turns > 0) return "Undoing"
  if (v.s !== "none") return "Stepped"
  return "Opened"
}

export const colors = { Opened: "blue", Stepped: "teal", Undoing: "orange" }

export const title =
  "A person's step and undo and an agent's run write properties on their own: each lands whole, an undo puts back only what is still the step's"
