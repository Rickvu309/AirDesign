const kind = (value) => (value.picture ? "picture" : "text box")
const bytes = (value) => (!value.picture ? "" : value.uploaded ? ", bytes uploaded" : ", bytes on this device only")
const elsewhere = (value) => (value.exported ? ", exported on another device" : "")
export const state = (value) =>
  !value.added
    ? `nothing added${elsewhere(value)}`
    : `${kind(value)} ${value.removed ? "removed" : "on the slide"}${value.picture ? "" : value.typed ? ", typed in" : ", empty"}${bytes(value)}${elsewhere(value)}`
export const step = (action) =>
  ({
    Add: "add a text box",
    AddPicture: "add a picture",
    Type: "type in the text box",
    Remove: "remove the element",
    Upload: "upload the picture's bytes",
    ExportElsewhere: "export the deck on another device",
  })[action] ?? null
export const group = (value) => (!value.added ? "None" : value.removed ? "Removed" : "Shown")
export const colors = { None: "gray", Shown: "blue", Removed: "purple" }
export const title =
  "A removed element takes no edit, its id is never handed out again, and a picture exports only with its bytes"
