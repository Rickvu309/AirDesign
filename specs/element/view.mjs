const ran = {
  add: "an agent's run added it",
  remove: "an agent's run removed it",
  both: "an agent's run added and removed it",
}
const run = (value) => (value.run === "none" ? "" : `, ${ran[value.run]}`)
const kind = (value) => (value.picture ? "picture" : "text box")
const typing = (value) => (value.picture ? "" : value.typed ? ", typed in" : ", empty")
const bytes = (value) => (!value.picture ? "" : value.uploaded ? ", bytes uploaded" : ", bytes on this device only")
const elsewhere = (value) => (value.exported ? ", exported on another device" : "")
export const state = (value) =>
  !value.added
    ? `nothing added${elsewhere(value)}`
    : `${kind(value)} ${value.removed ? "removed" : "on the slide"}${typing(value)}${bytes(value)}${elsewhere(value)}${run(value)}, ${
        value.held === "dropped"
          ? "told nothing changed"
          : value.run === "none"
            ? `can ${value.held} the ${value.kind}`
            : "run in the list"
      }`
export const step = (action) =>
  ({
    Add: "add a text box",
    AddPicture: "add a picture",
    Type: "type in the text box",
    Remove: "remove the element",
    OtherRemove: "another tab removes it",
    OtherRestore: "another tab brings it back",
    Undo: "the person undoes, or is told nothing changed",
    Redo: "the person redoes, or is told nothing changed",
    AgentAdd: "an agent adds a text box",
    AgentRemove: "an agent removes the element",
    AgentRemoveRefused: "an agent tries to remove a box a person typed in and is refused",
    UndoRun: "the person undoes the agent's run",
    UndoRunRefused: "the person undoes the agent's run and is told it changed",
    Upload: "upload the picture's bytes",
    ExportElsewhere: "export the deck on another device",
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
  "A person's undo, or the undo of an agent's run, brings back or removes an element only while nothing else changed it, and a picture exports only with its bytes"
