export type UndoName =
  | "text"
  | "notes"
  | "move"
  | "resize"
  | "add-box"
  | "add-table"
  | "add-picture"
  | "delete-element"
  | "new"
  | "duplicate"
  | "delete"
  | "order"
  | "add-row"
  | "delete-row"

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
    "add-picture": "Undo add picture",
    "delete-element": "Undo delete element",
    new: "Undo new slide",
    duplicate: "Undo duplicate slide",
    delete: "Undo delete slide",
    order: "Undo slide order",
    "add-row": "Undo add row",
    "delete-row": "Undo delete row",
  },
  redoNamed: {
    text: "Redo text edit",
    notes: "Redo speaker notes edit",
    move: "Redo move",
    resize: "Redo resize",
    "add-box": "Redo add text box",
    "add-table": "Redo add table",
    "add-picture": "Redo add picture",
    "delete-element": "Redo delete element",
    new: "Redo new slide",
    duplicate: "Redo duplicate slide",
    delete: "Redo delete slide",
    order: "Redo slide order",
    "add-row": "Redo add row",
    "delete-row": "Redo delete row",
  },
  undoChanged: "Unable to undo. This changed after your edit, so it stays as it is.",
  redoChanged: "Unable to redo. This changed after your undo, so it stays as it is.",
} as const satisfies {
  readonly undoNamed: Record<UndoName, string>
  readonly redoNamed: Record<UndoName, string>
  readonly [key: string]: unknown
}
