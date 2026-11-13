export type UndoName =
  | "text"
  | "notes"
  | "move"
  | "resize"
  | "add-box"
  | "add-table"
  | "add-shape"
  | "add-picture"
  | "delete-element"
  | "new"
  | "duplicate"
  | "delete"
  | "order"
  | "front"
  | "forward"
  | "backward"
  | "back"
  | "add-row"
  | "delete-row"
  | "add-column"
  | "delete-column"

export const undoCopy = {
  undo: "Undo",
  redo: "Redo",
  undoNamed: {
    text: "Undo text edit",
    notes: "Undo speaker notes edit",
    move: "Undo move",
    resize: "Undo resize",
    "add-box": "Undo add text box",
    "add-table": "Undo add table",
    "add-shape": "Undo add shape",
    "add-picture": "Undo add picture",
    "delete-element": "Undo delete element",
    new: "Undo new slide",
    duplicate: "Undo duplicate slide",
    delete: "Undo delete slide",
    order: "Undo slide order",
    front: "Undo bring to front",
    forward: "Undo bring forward",
    backward: "Undo send backward",
    back: "Undo send to back",
    "add-row": "Undo add row",
    "delete-row": "Undo delete row",
    "add-column": "Undo add column",
    "delete-column": "Undo delete column",
  },
  redoNamed: {
    text: "Redo text edit",
    notes: "Redo speaker notes edit",
    move: "Redo move",
    resize: "Redo resize",
    "add-box": "Redo add text box",
    "add-table": "Redo add table",
    "add-shape": "Redo add shape",
    "add-picture": "Redo add picture",
    "delete-element": "Redo delete element",
    new: "Redo new slide",
    duplicate: "Redo duplicate slide",
    delete: "Redo delete slide",
    order: "Redo slide order",
    front: "Redo bring to front",
    forward: "Redo bring forward",
    backward: "Redo send backward",
    back: "Redo send to back",
    "add-row": "Redo add row",
    "delete-row": "Redo delete row",
    "add-column": "Redo add column",
    "delete-column": "Redo delete column",
  },
  undoChanged: "Unable to undo. This changed after your edit, so it stays as it is.",
  redoChanged: "Unable to redo. This changed after your undo, so it stays as it is.",
} as const satisfies {
  readonly undoNamed: Record<UndoName, string>
  readonly redoNamed: Record<UndoName, string>
  readonly [key: string]: unknown
}
