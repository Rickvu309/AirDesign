const edits = { 0: "the file's", 1: "the person's", 2: "run a's", 3: "the undo's", 5: "run b's" }
const shown = { T: "the text", N: "the notes" }

const steps = {
  PersonWrites: "the person writes the text",
  StartA: "run a starts",
  StartB: "run b starts",
  StopA: "run a stops",
  StopB: "run b stops",
  WriteA: "run a writes one property",
  WriteB: "run b writes the text",
  UndoA: "the person undoes run a",
}

const guarded = (v) =>
  [
    v.gaT ? "the text from run a" : null,
    v.gaN ? "the notes from run a" : null,
    v.gbT ? "the text from run b" : null,
  ].filter(Boolean)

const wrote = (name, outcome, key) =>
  outcome === "none"
    ? null
    : outcome === "landed"
      ? `run ${name}'s write of ${shown[key]} landed`
      : `run ${name}'s write of ${shown[key]} was refused (${outcome})`

export const state = (v) =>
  [
    `text is ${edits[v.vT]} value with ${edits[v.tT]} rev, notes ${edits[v.vN]} value with ${edits[v.tN]} rev`,
    `run a ${v.ra}, run b ${v.rb}`,
    guarded(v).length === 0 ? null : `protected: ${guarded(v).join(", ")}`,
    wrote("a", v.wa, v.ka),
    wrote("b", v.wb, "T"),
    v.ua === "none" ? null : v.ua === "landed" ? "the undo of run a landed" : "the undo of run a found nothing",
  ]
    .filter(Boolean)
    .join("; ")

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (v.ua !== "none") return "Undone"
  if (v.rb !== "idle") return "Two runs"
  if (v.ra !== "idle") return "One run"
  return "Opened"
}

export const colors = { Opened: "blue", "One run": "teal", "Two runs": "purple", Undone: "orange" }

export const title =
  "Each run is protected only by what a person wrote while it ran, and undoing a run takes back only its own write"
