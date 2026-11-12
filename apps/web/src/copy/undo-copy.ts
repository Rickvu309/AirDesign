export type UndoName = "text" | "move" | "resize" | "new" | "duplicate" | "delete" | "order" | "add-row" | "delete-row"

export const undoCopy = {
  undo: "Undo",
  redo: "Redo",
  undoNamed: {
    text: "Undo text edit",
    move: "Undo move",
    resize: "Undo resize",
    new: "Undo new slide",
    duplicate: "Undo duplicate slide",
    delete: "Undo delete slide",
    order: "Undo slide order",
    "add-row": "Undo add row",
    "delete-row": "Undo delete row",
  },
  redoNamed: {
    text: "Redo text edit",
    move: "Redo move",
    resize: "Redo resize",
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
