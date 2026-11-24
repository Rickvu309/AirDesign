const steps = {
  Step: "the person, or an agent run, moves the card K out of P into frame H, and may turn K or H in the same edit",
  OtherTurn: "another tab turns frame H by 15 degrees",
  OtherDelete: "another tab deletes frame P",
  Undo: "the person presses Ctrl+Z, or Undo on the run",
}

const frames = { 1: "P", 4: "H" }
const writers = ["the file", "the step", "the other tab", "the undo"]
const degrees = (units) => `${units * 15}°`

export const state = (v) =>
  `K is in ${frames[v.pK]} at ${degrees(v.rK)}, H is at ${degrees(v.tH)} (by ${writers[v.wH]})` +
  `${v.gone ? ", P is deleted" : ""}` +
  `${v.made ? `; the step was ${v.run ? "an agent run's" : "the person's"}` : ""}` +
  `${v.dH === 1 ? ", and the other tab turned H after it" : ""}` +
  `${v.told === "none" ? "" : `; the press: ${v.told}`}`

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (v.pressed) return "Pressed"
  if (v.gone || v.turnedH) return "Other tab"
  if (v.made) return "Stepped"
  return "Opened"
}

export const colors = { Opened: "blue", Stepped: "teal", "Other tab": "red", Pressed: "orange" }

export const title =
  "The turn an undo writes for a card it leaves in its new frame, beside another tab's turn of that frame"
