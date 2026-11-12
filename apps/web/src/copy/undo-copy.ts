export type UndoName =
  | "text"
  | "notes"
  | "move"
  | "resize"
  | "add-box"
  | "delete-element"
  | "new"
  | "duplicate"
  | "delete"
  | "order"

export const undoCopy = {
  undo: "Undo",
  redo: "Redo",
  undoNamed: {
    text: "Undo text edit",
    notes: "Undo speaker notes edit",
    move: "Undo move",
    resize: "Undo resize",
    "add-box": "Undo add text box",
    "delete-element": "Undo delete element",
    new: "Undo new slide",
    duplicate: "Undo duplicate slide",
    delete: "Undo delete slide",
    order: "Undo slide order",
  },
  redoNamed: {
    text: "Redo text edit",
    notes: "Redo speaker notes edit",
    move: "Redo move",
    resize: "Redo resize",
    "add-box": "Redo add text box",
    "delete-element": "Redo delete element",
    new: "Redo new slide",
    duplicate: "Redo duplicate slide",
    delete: "Redo delete slide",
    order: "Redo slide order",
  },
  undoChanged: "Unable to undo. This changed after your edit, so it stays as it is.",
  redoChanged: "Unable to redo. This changed after your undo, so it stays as it is.",
} as const satisfies {
  readonly undoNamed: Record<UndoName, string>
  readonly redoNamed: Record<UndoName, string>
  readonly [key: string]: unknown
}
