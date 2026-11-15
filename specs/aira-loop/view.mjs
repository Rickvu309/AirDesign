const steps = {
  Land: "the server writes the edit under run r",
  Read: "the browser reads the edit's answer and keeps r in the exchange's runs",
  Stop: "the person presses Stop, the exchange shows stopped, and a waiting edit call is cut",
  Spend: "the stop names the cut call, and the server spends its once or answers the run it landed",
  Finish: "the model's next turn ends the run",
  Fail: "the model's next turn fails, and the request offers Try again",
  Close: "the browser stops r and the server answers",
  Ask: "the person asks again",
  Retry: "the person presses Try again, which retries the failed request in place",
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
      ? `${v.retried ? "Try again" : "next ask"} ${v.held ? "from a chat with Undo" : "from a chat without Undo"}, ${v.sent ? `sent${v.nextKnown ? " with Undo" : " without Undo"}` : "waits"}`
      : "no next ask",
    ...(v.named ? ["the stop named the call"] : []),
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

export const title = "A Stop that races an edit offers Undo for the edit that landed, and no edit lands after it"
