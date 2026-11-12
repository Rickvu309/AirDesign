export const state = (value) =>
  !value.added
    ? "no text box"
    : `text box ${value.removed ? "removed" : "on the slide"}, ${value.typed ? "typed in" : "empty"}, ${
        value.held === "dropped" ? "told nothing changed" : `can ${value.held} the ${value.kind}`
      }`
export const step = (action) =>
  ({
    Add: "add a text box",
    Type: "type in the text box",
    Remove: "remove the text box",
    OtherRemove: "another tab removes it",
    OtherRestore: "another tab brings it back",
    Undo: "the person undoes, or is told nothing changed",
    Redo: "the person redoes, or is told nothing changed",
  })[action] ?? null
export const group = (value) =>
  !value.added ? "None" : value.held === "dropped" ? "Told" : value.removed ? "Removed" : "Shown"
export const colors = { None: "gray", Shown: "blue", Removed: "purple", Told: "orange" }
export const title = "A person's undo brings back or removes a text box only while their own edit still shows"
