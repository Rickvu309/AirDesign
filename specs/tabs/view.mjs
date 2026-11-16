const steps = {
  Move: "the person moves the box in the first tab",
  Format: "the person makes the box's words bold in the second tab",
  SendOne: "the first tab sends the next batch of pending rows",
  SendTwo: "the second tab sends the next batch of pending rows",
  ApplyOne: "the server applies the first tab's batch, or answers its once again",
  ApplyTwo: "the server applies the second tab's batch, or answers its once again",
  AnswerOne: "the first tab reads the server's answer",
  AnswerTwo: "the second tab reads the server's answer",
  FollowOne: "the first tab follows a newer revision into the shared copy and paints it",
  FollowTwo: "the second tab follows a newer revision into the shared copy and paints it",
  ReloadTwo: "the person reloads the second tab",
  ReadTwo: "the server answers the opening page's read of the deck",
  AdoptTwo: "the second tab writes the deck it read into the shared copy and paints it",
}

const shown = (text) => (text === "" ? "nothing yet" : text)

const row = (state) => (state === "row" ? "pending" : state === "sealed" ? "sealed" : "")

const copy = (v) => {
  const rows = [
    v.mv !== "none" ? `move ${row(v.mv)}` : "",
    v.mvc ? "move saved" : "",
    v.fm !== "none" ? `${v.words} words ${row(v.fm)}${v.floored ? " over the file's box" : ""}` : "",
    v.fmc ? `${v.words} words saved` : "",
  ].filter((each) => each !== "")
  return rows.length === 0 ? "empty" : rows.join(", ")
}

const tab = (v, n) => {
  const build = n === 2 && v.build2 === 2 ? "newer build" : "older build"
  if (n === 1 && v.stopped1) return `tab 1 (${build}) shows the newer-version notice`
  const wire =
    v[`wire${n}`] === "sent"
      ? `, sent ${v[`batch${n}`]}`
      : v[`wire${n}`] === "applied"
        ? `, answer to ${v[`batch${n}`]} on its way`
        : ""
  const known = v[`known${n}`] === -1 ? "has not read the deck" : `read ${v[`known${n}`]}`
  const asked = n === 2 && v.asked2 !== -1 ? `, holds the server's answer at ${v.asked2}` : ""
  return `tab ${n} (${build}) shows ${shown(v[`shown${n}`])}, ${known}${asked}${wire}`
}

const landed = (v) =>
  [v.mvAt > 0 ? `move at ${v.mvAt}` : "", v.fmAt > 0 ? `${v.words} words at ${v.fmAt}` : ""]
    .filter((each) => each !== "")
    .join(", ") || "nothing"

export const state = (v) =>
  `${tab(v, 1)}; ${tab(v, 2)}; shared copy v${v.version}: ${copy(v)}; server at ${v.rev} holds ${landed(v)}`

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (v.stopped1) return "A tab told to reload"
  if (v.mv !== "none" || v.fm !== "none") return "Rows pending"
  if (v.wire1 !== "none" || v.wire2 !== "none") return "Waiting for an answer"
  return "Settled"
}

export const colors = {
  Settled: "green",
  "Rows pending": "blue",
  "Waiting for an answer": "orange",
  "A tab told to reload": "gray",
}

export const title = "Two tabs share one deck through the browser's copy and the server, and no edit is lost"
