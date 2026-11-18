export type UndoName =
  | "text"
  | "format"
  | "notes"
  | "move"
  | "resize"
  | "add-box"
  | "slide-number"
  | "skip-slide"
  | "unskip-slide"
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
  | "group"
  | "ungroup"
  | "template"
  | "background"
  | "theme-color"
  | "theme-font"
  | "text-style"
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
  | "connector"
  | "rename"
  | "alt-text"
  | "hide"
  | "cell-fill"
  | "border"
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
    notes: "Undo presenter notes edit",
    move: "Undo move",
    resize: "Undo resize",
    "add-box": "Undo add text",
    "slide-number": "Undo add slide numbers",
    "skip-slide": "Undo skip slide",
    "unskip-slide": "Undo unskip slide",
    "add-table": "Undo add table",
    "add-shape": "Undo add shape",
    "add-picture": "Undo add image",
    "add-icon": "Undo add icon",
    "delete-element": "Undo delete layer",
    new: "Undo new slide",
    duplicate: "Undo duplicate slide",
    delete: "Undo delete slide",
    order: "Undo slide order",
    front: "Undo bring to front",
    forward: "Undo bring forward",
    backward: "Undo send backward",
    back: "Undo send to back",
    group: "Undo group",
    ungroup: "Undo ungroup",
    template: "Undo template style",
    background: "Undo background color",
    "theme-color": "Undo template color",
    "theme-font": "Undo template font",
    "text-style": "Undo text style",
    fill: "Undo fill",
    "cell-fill": "Undo cell fill",
    border: "Undo border",
    line: "Undo line",
    effects: "Undo effects",
    "text-box": "Undo text box",
    shape: "Undo shape",
    rotate: "Undo rotate",
    flip: "Undo flip",
    opacity: "Undo opacity",
    picture: "Undo image",
    crop: "Undo crop",
    connector: "Undo connector",
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
    notes: "Redo presenter notes edit",
    move: "Redo move",
    resize: "Redo resize",
    "add-box": "Redo add text",
    "slide-number": "Redo add slide numbers",
    "skip-slide": "Redo skip slide",
    "unskip-slide": "Redo unskip slide",
    "add-table": "Redo add table",
    "add-shape": "Redo add shape",
    "add-picture": "Redo add image",
    "add-icon": "Redo add icon",
    "delete-element": "Redo delete layer",
    new: "Redo new slide",
    duplicate: "Redo duplicate slide",
    delete: "Redo delete slide",
    order: "Redo slide order",
    front: "Redo bring to front",
    forward: "Redo bring forward",
    backward: "Redo send backward",
    back: "Redo send to back",
    group: "Redo group",
    ungroup: "Redo ungroup",
    template: "Redo template style",
    background: "Redo background color",
    "theme-color": "Redo template color",
    "theme-font": "Redo template font",
    "text-style": "Redo text style",
    fill: "Redo fill",
    "cell-fill": "Redo cell fill",
    border: "Redo border",
    line: "Redo line",
    effects: "Redo effects",
    "text-box": "Redo text box",
    shape: "Redo shape",
    rotate: "Redo rotate",
    flip: "Redo flip",
    opacity: "Redo opacity",
    picture: "Redo image",
    crop: "Redo crop",
    connector: "Redo connector",
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
