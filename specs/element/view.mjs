const ran = {
  add: "an agent's run added it",
  remove: "an agent's run removed it",
  both: "an agent's run added and removed it",
}
const run = (value) => (value.run === "none" ? "" : `, ${ran[value.run]}`)
export const state = (value) =>
  !value.added
    ? "no text box"
    : `text box ${value.removed ? "removed" : "on the slide"}, ${value.typed ? "typed in" : "empty"}${run(value)}, ${
        value.held === "dropped"
          ? "told nothing changed"
          : value.run === "none"
            ? `can ${value.held} the ${value.kind}`
            : "run in the list"
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
    AgentAdd: "an agent adds a text box",
    AgentRemove: "an agent removes the text box",
    AgentRemoveRefused: "an agent tries to remove a box a person typed in and is refused",
    UndoRun: "the person undoes the agent's run",
    UndoRunRefused: "the person undoes the agent's run and is told it changed",
  })[action] ?? null
export const group = (value) =>
  !value.added
    ? "None"
    : value.held === "dropped" || (value.told && value.run !== "none")
      ? "Told"
      : value.removed
        ? "Removed"
        : "Shown"
export const colors = { None: "gray", Shown: "blue", Removed: "purple", Told: "orange" }
export const title =
  "A person's undo, or the undo of an agent's run, brings back or removes a text box only while nothing else changed it"
