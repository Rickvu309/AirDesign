const steps = {
  SlideReads: "add_slide, or its next try, reads the deck and decides on its base",
  SlideWrites: "add_slide writes the deck if the revision it read still holds, or tries again",
  EditReads: "edit_deck, or its next try, reads the deck",
  EditWrites: "edit_deck writes the deck if the revision it read still holds, or tries again",
  PersonEdits: "a person edits another element",
  Done: "nothing is left to do",
}

const outcome = (pc, out) => (pc === "done" ? out : pc === "write" ? "about to write" : "waiting")

export const state = (v) =>
  `deck at ${v.rev}, ${v.last === "none" ? "no run wrote its latest revision" : `r wrote every revision after ${v.since}`}` +
  `${v.person ? `, a person wrote ${v.foreign}` : ""}, add_slide ${outcome(v.sPc, v.sOut)}, edit_deck ${outcome(v.ePc, v.eOut)}`

export const step = (action) => steps[action] ?? null

export const group = (v) => (v.foreign > 1 ? "Another writer after the base" : "Only the turn's run after the base")

export const colors = {
  "Only the turn's run after the base": "teal",
  "Another writer after the base": "gray",
}

export const title =
  "Calls of one turn sent at one base both land, and a person's write since the base still refuses a slide"
