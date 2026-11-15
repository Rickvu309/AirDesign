const ran = {
  add: "an agent's run added it",
  remove: "an agent's run removed it",
  both: "an agent's run added and removed it",
}
const run = (value) => (value.run === "none" ? "" : `, ${ran[value.run]}`)
const kind = (value) => (value.picture ? "picture" : "text box")
const said = { opening: "showing its opening text", typed: "showing typed text", aira: "showing an agent's text" }
const typing = (value) =>
  value.picture
    ? ""
    : `, ${said[value.shows] ?? "empty"}${value.left !== value.shows ? `, not what the person's edit left` : ""}`
const bytes = (value) => (!value.picture ? "" : value.uploaded ? ", bytes uploaded" : ", bytes on this device only")
const elsewhere = (value) => (value.exported ? ", exported on another device" : "")
const wrote = {
  none: "",
  before: ", an agent's row from before the person's edit",
  since: ", an agent's row written after the person's edit",
  undone: ", the agent's row undone",
}
const agent = (value) => wrote[value.agent] ?? ""
export const state = (value) =>
  !value.added
    ? `nothing added${elsewhere(value)}`
    : `${kind(value)} ${value.removed ? "removed" : "on the slide"}${typing(value)}${agent(value)}${bytes(value)}${elsewhere(value)}${run(value)}, ${
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
    AgentWrite: "another agent's run writes in the text box",
    UndoWrite: "the person undoes the run that wrote in the text box",
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
  "A person's undo, or the undo of an agent's run, brings back or removes an element only while nothing else changed it, takes a box away only while it shows what the person's edit left, and a picture exports only with its bytes"
