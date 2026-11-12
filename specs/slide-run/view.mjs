const steps = {
  AgentLoadsTurn: "an agent call, or its next try, loads the turn row",
  AgentLoadsDeck: "the agent call reads the deck and decides on it",
  AgentAddsSlide: "add_slide writes the deck if the revision it read still holds, or tries again",
  AgentSavesTurn: "the agent call saves the turn row",
  StopLoadsTurn: "stop_run, or its next try, loads the turn row",
  StopLoadsDeck: "stop_run reads the deck and decides on it",
  StopCommits: "stop_run writes the stopped element if the revision it read still holds, or tries again",
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
