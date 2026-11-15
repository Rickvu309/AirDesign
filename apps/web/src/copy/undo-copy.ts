export type UndoName =
  | "text"
  | "format"
  | "notes"
  | "move"
  | "resize"
  | "add-box"
  | "add-table"
  | "add-shape"
  | "add-picture"
  | "add-icon"
  | "delete-element"
  | "new"
  | "duplicate"
  | "delete"
  | "order"
  | "front"
  | "forward"
  | "backward"
  | "back"
  | "background"
  | "fill"
  | "line"
  | "effects"
  | "text-box"
  | "shape"
  | "rotate"
  | "flip"
  | "opacity"
  | "picture"
  | "crop"
  | "rename"
  | "alt-text"
  | "hide"
  | "add-row"
  | "delete-row"
  | "add-column"
  | "delete-column"

export const undoCopy = {
  undo: "Undo",
  redo: "Redo",
  undoNamed: {
    text: "Undo text edit",
    format: "Undo text format",
    notes: "Undo speaker notes edit",
    move: "Undo move",
    resize: "Undo resize",
    "add-box": "Undo add text box",
    "add-table": "Undo add table",
    "add-shape": "Undo add shape",
    "add-picture": "Undo add picture",
    "add-icon": "Undo add icon",
    "delete-element": "Undo delete element",
    new: "Undo new slide",
    duplicate: "Undo duplicate slide",
    delete: "Undo delete slide",
    order: "Undo slide order",
    front: "Undo bring to front",
    forward: "Undo bring forward",
    backward: "Undo send backward",
    back: "Undo send to back",
    background: "Undo background color",
    fill: "Undo fill",
    line: "Undo line",
    effects: "Undo effects",
    "text-box": "Undo text box",
    shape: "Undo shape",
    rotate: "Undo rotate",
    flip: "Undo flip",
    opacity: "Undo opacity",
    picture: "Undo picture",
    crop: "Undo crop",
    rename: "Undo rename",
    "alt-text": "Undo alt text",
    hide: "Undo hide",
    "add-row": "Undo add row",
    "delete-row": "Undo delete row",
    "add-column": "Undo add column",
    "delete-column": "Undo delete column",
  },
  redoNamed: {
    text: "Redo text edit",
    format: "Redo text format",
    notes: "Redo speaker notes edit",
    move: "Redo move",
    resize: "Redo resize",
    "add-box": "Redo add text box",
    "add-table": "Redo add table",
    "add-shape": "Redo add shape",
    "add-picture": "Redo add picture",
    "add-icon": "Redo add icon",
    "delete-element": "Redo delete element",
    new: "Redo new slide",
    duplicate: "Redo duplicate slide",
    delete: "Redo delete slide",
    order: "Redo slide order",
    front: "Redo bring to front",
    forward: "Redo bring forward",
    backward: "Redo send backward",
    back: "Redo send to back",
    background: "Redo background color",
    fill: "Redo fill",
    line: "Redo line",
    effects: "Redo effects",
    "text-box": "Redo text box",
    shape: "Redo shape",
    rotate: "Redo rotate",
    flip: "Redo flip",
    opacity: "Redo opacity",
    picture: "Redo picture",
    crop: "Redo crop",
    rename: "Redo rename",
    "alt-text": "Redo alt text",
    hide: "Redo hide",
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
