const widths = ["gone", "the file's width", "the first width", "the second width"]

const steps = {
  ClickFirst: "the person sets the first width in the design panel",
  ClickSecond: "the person sets the second width",
  ClickUndo: "the person clicks Undo",
  ClickRedo: "the person clicks Redo",
  Send: "the device sends its pending rows",
  Apply: "the server applies the batch, or answers its once again",
  Refuse: "the server refuses the batch, since the element is gone",
  Answer: "the device reads the answer and confirms the batch",
  Lose: "the answer is lost",
  SetAside: "the device reads the refusal and sets the rows aside",
  Reconcile: "the editor paints the device's deck again",
  AgentDelete: "an agent deletes the element on the server",
}

const digits = (number) => (number === 0 ? [] : String(number).split("").map(Number))

const rows = (v) =>
  digits(v.wrote)
    .slice(v.left)
    .map((width) => widths[width])
    .join(", ")

const stepsOf = (list) =>
  (list === 0 ? [] : (String(list).match(/../g) ?? []))
    .map((step) => `${widths[Number(step[0])]} to ${widths[Number(step[1])]}`)
    .join("; ")

const wire = (v) => {
  if (v.wire === "sent") return `, ${v.sealed} row${v.sealed === 1 ? "" : "s"} on the way`
  if (v.wire === "applied") return ", an answer on the way"
  if (v.wire === "refused") return ", a refusal on the way"
  return ""
}

export const state = (v) =>
  `canvas shows ${widths[v.shown]}; ` +
  (v.left < digits(v.wrote).length ? `pending ${rows(v)}` : "nothing pending") +
  `${wire(v)}; server applied ${digits(v.onServer).length} row${digits(v.onServer).length === 1 ? "" : "s"}` +
  `${v.gone ? ", element deleted" : ""}${v.aside > 0 ? `, ${v.aside} set aside` : ""}; ` +
  `undo [${stepsOf(v.undo)}], redo [${stepsOf(v.redo)}]${v.told ? ", told nothing changed" : ""}` +
  `${v.repaint ? ", repaint due" : ""}`

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (v.mirror === 0) return "Gone on the device"
  if (v.wire !== "none") return "Waiting for the server"
  if (v.left < digits(v.wrote).length) return "Rows pending"
  return "Settled"
}

export const colors = {
  Settled: "green",
  "Rows pending": "blue",
  "Waiting for the server": "orange",
  "Gone on the device": "gray",
}

export const title =
  "Panel changes, Undo and Redo paint before the server answers, land on it in order once, and turn only the person's last step"
