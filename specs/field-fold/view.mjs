const edits = {
  1: "the file's colour",
  2: "inherit",
  3: "the person's colour",
  4: "the agent's colour",
  5: "the file's opacity",
  6: "the person's opacity",
  7: "the agent's opacity",
  8: "the file's size",
  9: "the person's size",
}

const steps = {
  Reset: "the person clicks Reset fill",
  SetColour: "the person sets the fill colour",
  SetAlpha: "the person sets the opacity",
  SetSize: "the person sets the font size",
  Undo: "the person clicks Undo",
  AgentColour: "an agent sets the fill colour on the server",
  AgentAlpha: "an agent sets the opacity on the server",
  AgentTheme: "an agent changes the theme colour a reset fill inherits",
  Sync: "the device sends its rows, the server applies them, and the device reads the deck",
}

const digits = (number) => (number === 0 ? [] : String(number).split("").map(Number))

const rows = (number) =>
  digits(number)
    .map((edit) => edits[edit])
    .join(", ")

const stepsOf = (list) =>
  (list === 0 ? [] : (String(list).match(/../g) ?? []))
    .map((step) => `${edits[Number(step[0])]} to ${edits[Number(step[1])]}`)
    .join("; ")

const shown = (value) => (value === "inherited" ? "the inherited" : `the ${value === "file" ? "file" : value}'s`)

export const state = (v) =>
  `panel and canvas show ${shown(v.colour)} colour${v.quiet ? " in quiet ink" : ""}, ${shown(v.alpha)} opacity, ` +
  `${shown(v.size)} size${v.dTheme === 2 ? " under the changed theme" : ""}; ` +
  (v.pending === 0 ? "nothing pending" : `pending ${rows(v.pending)}`) +
  `; server rows [${rows(v.log)}], device read ${v.seen}; undo [${stepsOf(v.undo)}]` +
  `${v.told === 0 ? "" : ", told nothing changed"}${v.bytes ? "; export writes the file's own bytes" : ""}`

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (v.turns > 0) return "Undoing"
  if (v.made > 0) return "Changed"
  return "Opened"
}

export const colors = { Opened: "blue", Changed: "teal", Undoing: "orange" }

export const title =
  "Each design panel field folds on its own: a reset shows the inherited value, and undo puts back what the field held"
