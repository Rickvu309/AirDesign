const plural = new Intl.PluralRules("en")

function slidesOf(count: number): string {
  return plural.select(count) === "one" ? `${String(count)} slide` : `${String(count)} slides`
}

export const slideListCopy = {
  sectionCount: slidesOf,
  listName: "Slides",
  slideName: (number: number, count: number) => `Slide ${String(number)} of ${String(count)}`,
  selectedName: (number: number, count: number) => `Slide ${String(number)} of ${String(count)}, selected`,
  selected: (count: number) => `${slidesOf(count)} selected`,
  nothingSelected: "Nothing selected",
  entered: (number: number) => `Editing slide ${String(number)}. Tab moves through its elements`,
  selectOne: "Select one slide to duplicate, delete or move it",
  added: (number: number) => `Added slide ${String(number)}`,
  addAfter: (number: number) => `Add slide after slide ${String(number)}`,
  moveRow: (row: number) => `Move row ${String(row)}`,
  rowMoved: (from: number, to: number) => `Moved row ${String(from)} to position ${String(to)}`,
  rowKeys: "Alt+ArrowUp Alt+ArrowDown",
  addBelow: (row: number) => `Add slide in a new row below row ${String(row)}`,
  duplicated: (number: number) => `Duplicated slide ${String(number)}. The copy is slide ${String(number + 1)}`,
  deleted: (number: number) => `Slide ${String(number)} deleted`,
  moved: (from: number, to: number) => `Moved slide ${String(from)} to position ${String(to)}`,
  movedSeveral: (count: number, to: number) => `Moved ${slidesOf(count)} to position ${String(to)}`,
  sectionRange: (range: string) => `slides ${range}`,
  actions: (number: number) => `Slide ${String(number)} actions`,
  open: "Open",
  openKey: "Enter",
  duplicate: "Duplicate",
  delete: "Delete",
  setActions: (count: number) => ({
    clone: `Duplicate ${slidesOf(count)}`,
    remove: `Delete ${slidesOf(count)}`,
    up: `Move ${slidesOf(count)} up`,
    down: `Move ${slidesOf(count)} down`,
  }),
  moveUp: "Move up",
  moveDown: "Move down",
  duplicateKey: "Ctrl+D",
  deleteKey: "Delete",
  moveUpKey: "Alt+Up",
  moveDownKey: "Alt+Down",
} as const
