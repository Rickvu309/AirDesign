const steps = {
  Step: "the person, or an agent run, moves the card K out of P into frame H, and may turn K or H in the same edit",
  AgentMove: "an agent run moves K from H onto the slide and keeps its turn in its frame",
  OtherTurn: "another tab turns frame H or frame Q by 15 degrees",
  OtherDelete: "another tab deletes frame P or frame Q",
  Undo: "the person presses Ctrl+Z",
  Redo: "the person presses Ctrl+Y",
  UndoRun: "the person presses Undo on an agent run",
}

const frames = ["the slide", "P", "H"]
const degrees = (units) => `${units * 15}°`
const slide = (v) => (v.kr + (v.kp === 1 ? 2 : v.kp === 2 ? v.hr + v.qr : 0)) % 24

export const state = (v) =>
  `K is in ${frames[v.kp]} at ${degrees(v.kr)}, ${degrees(slide(v))} on the slide; H is at ${degrees(v.hr)} in Q at ` +
  `${degrees(v.qr)}` +
  `${v.pg > 0 ? ", P is deleted" : ""}${v.qg > 0 ? ", Q is deleted" : ""}` +
  `${v.made === "none" ? "" : `; the move was ${v.made === "run" ? "an agent run's" : "the person's"}`}` +
  `${v.moved ? ", and an agent moved K onto the slide" : ""}` +
  `${v.told === "none" ? "" : `; the press: ${v.told === "undone" ? "undone" : "nothing to undo"}`}`

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (v.presses > 0) return "Pressed"
  if (v.gone || v.acted || v.moved) return "Others"
  if (v.made !== "none") return "Moved"
  return "Opened"
}

export const colors = { Opened: "blue", Moved: "teal", Others: "red", Pressed: "orange" }

export const title = "The turn an undo leaves on a card it does not put back into its old frame"
