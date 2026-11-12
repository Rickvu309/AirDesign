const steps = {
  AgentLoadsTurn: "an agent call loads the turn row",
  AgentLoadsDeck: "the agent call reads the deck",
  AgentReads: "read_deck answers and the agent keeps that revision as its base",
  AgentAddsSlide: "add_slide decides on the deck it read and writes it if the revision still matches",
  AgentSavesTurn: "the agent call saves the turn row",
  StopLoadsTurn: "stop_run loads the turn row",
  StopLoadsDeck: "stop_run reads the deck",
  StopCommits: "stop_run stops r and writes the deck if it changed",
  StopSavesTurn: "stop_run saves the turn row",
  Done: "nothing is left to do",
}

const elementWords = { none: "holds no element", running: "holds an element", stopped: "is stopped on its element" }

export const state = (v) =>
  `deck at ${v.rev}, r added ${v.shown} slides, r ${elementWords[v.element]}, turn ${v.turn} at ${v.turnRev}` +
  `${v.stopped ? ", stop took effect" : ""}${v.late > 0 ? `, ${v.late} slides of r landed after the stop` : ""}`

export const step = (action) => steps[action] ?? null

export const group = (v) => (v.stopped ? "After the stop" : "Before the stop")

export const colors = {
  "Before the stop": "teal",
  "After the stop": "gray",
}

export const title = "A stopped run lands no slide, and its turn stays ended"
