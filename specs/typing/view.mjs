const texts = {
  N: ["the old notes", "the notes' first letter", "the new notes"],
  T: ["the old text", "the first letter", "the new text"],
}

const steps = {
  TypeNotes: "the person types a letter of speaker notes",
  TypeText: "the person types a letter over the text",
  RecordNotes: "a notes edit's undo record lands",
  RecordText: "a keystroke's undo record lands",
  UploadNotes: "a notes edit reaches the server",
  UploadText: "a keystroke reaches the server",
  KeyUndo: "the person presses Ctrl+Z",
  KeyRedo: "the person presses Ctrl+Shift+Z",
  MenuUndo: "the person picks Undo in the browser's menu, and the field they typed in refuses it",
  Turn: "the undo or redo reads the list and lands, or changes nothing",
}

const named = { 1: "N1", 2: "N2", 3: "T1", 4: "T2" }

const entries = (list) =>
  String(list)
    .split("")
    .filter((digit) => digit !== "0")
    .map((digit) => named[digit])
    .join(" ")

const pipeline = (typed, recorded, uploaded) => `${typed} typed, ${recorded} recorded, ${uploaded} sent`

export const state = (v) =>
  `box shows ${texts.T[v.shownT]}, notes show ${texts.N[v.shownN]}; ` +
  `text ${pipeline(v.tTyped, v.tRec, v.tUp)}, notes ${pipeline(v.nTyped, v.nRec, v.nUp)}; ` +
  `undo list [${entries(v.list)}]` +
  (v.ask === "none" ? "" : `, ${v.ask} waiting`) +
  (v.done === "none" ? "" : `, last turn ${v.done}${v.turned === "none" ? "" : ` ${v.turned}`}`)

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (v.done === "redone") return "Redone"
  if (v.done === "undone") return "Undone"
  if (v.done !== "none") return "Nothing changed"
  if (v.ask !== "none") return "Undo waiting"
  return "Typing"
}

export const colors = {
  Typing: "blue",
  "Undo waiting": "orange",
  Undone: "teal",
  Redone: "green",
  "Nothing changed": "gray",
}

export const title =
  "One Ctrl+Z after typing brings back the text from before the typing, even while it is still on its way"
