const steps = {
  SlideReads: "add_slide, or its next try, reads the deck and its once, and decides on its base",
  SlideWrites: "add_slide writes the deck if the revision it read still holds, or tries again",
  EditReads: "the second call, or its next try, reads the deck",
  EditWrites: "the second call writes the deck if the revision it read still holds, or tries again",
  PersonEdits: "a person edits another element",
  Done: "nothing is left to do",
}

const outcome = (pc, out) => (pc === "done" ? out : pc === "write" ? "about to write" : "waiting")

const second = (v) => (v.second === "edit" ? "edit_deck" : "add_slide sent again")

export const state = (v) =>
  `deck at ${v.rev}, ${v.last === "none" ? "no run wrote its latest revision" : `r wrote every revision after ${v.since}`}` +
  `${v.person ? `, a person wrote ${v.foreign}` : ""}${v.spent ? ", the add's once spent" : ""}, add_slide ${outcome(v.sPc, v.sOut)}, ${second(v)} ${outcome(v.ePc, v.eOut)}`

export const step = (action) => steps[action] ?? null

export const group = (v) =>
  `${v.foreign > 1 ? "Another writer after the base" : "Only the turn's run after the base"}${v.second === "edit" ? "" : ", sent twice"}`

export const colors = {
  "Only the turn's run after the base": "teal",
  "Another writer after the base": "gray",
  "Only the turn's run after the base, sent twice": "blue",
  "Another writer after the base, sent twice": "purple",
}

export const title =
  "Calls of one turn sent at one base both land, a call sent twice lands once, and a person's write since the base still refuses a slide"
