const steps = {
  Land: "the server writes the edit under run r",
  Read: "the browser reads the edit's answer and keeps r in the exchange's runs",
  Stop: "the person presses Stop and the exchange shows stopped",
  WaitEnds: "the wait after Stop ends with no answer, and the browser cuts the call",
  Finish: "the model's next turn ends the run",
  Close: "the browser stops r and the server answers",
  Ask: "the person asks again",
  Done: "nothing is left to do",
}

export const state = (v) =>
  [
    `server ${v.server}`,
    `answer ${v.answer}`,
    `shown ${v.shown}`,
    v.known ? "Undo offered" : "no Undo",
    v.closed ? "r stopped" : "r not stopped",
    v.settled ? "settled" : "settling",
    v.asked
      ? `next ask ${v.held ? "from a chat with Undo" : "from a chat without Undo"}, ${v.sent ? `sent${v.nextKnown ? " with Undo" : " without Undo"}` : "waits"}`
      : "no next ask",
    ...(v.late ? ["landed late"] : []),
  ].join(", ")

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (v.settled) return "Settled"
  if (v.shown === "working") return "Working"
  return "Settling"
}

export const colors = {
  Working: "blue",
  Settling: "orange",
  Settled: "purple",
}

export const title = "A Stop that races an edit still offers Undo for the edit that landed"
