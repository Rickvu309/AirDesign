const kind = (value) => (value.picture ? "picture" : "text box")
const bytes = (value) => (!value.picture ? "" : value.uploaded ? ", bytes uploaded" : ", bytes on this device only")
const elsewhere = (value) => (value.exported ? ", exported on another device" : "")
const typing = (value) => (value.picture ? "" : value.typed ? ", typed in" : ", empty")
export const state = (value) =>
  !value.added
    ? `nothing added${elsewhere(value)}`
    : `${kind(value)} ${value.removed ? "removed" : "on the slide"}${typing(value)}${bytes(value)}${elsewhere(value)}, ${
        value.held === "dropped" ? "told nothing changed" : `can ${value.held} the ${value.kind}`
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
    Upload: "upload the picture's bytes",
    ExportElsewhere: "export the deck on another device",
  })[action] ?? null
export const group = (value) =>
  !value.added ? "None" : value.held === "dropped" ? "Told" : value.removed ? "Removed" : "Shown"
export const colors = { None: "gray", Shown: "blue", Removed: "purple", Told: "orange" }
export const title =
  "A person's undo brings back or removes an element only while their own edit still shows, and a picture exports only with its bytes"
