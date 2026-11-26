const plural = new Intl.PluralRules("en")

function slidesOf(count: number): string {
  return plural.select(count) === "one" ? `${String(count)} slide` : `${String(count)} slides`
}

function slideLimit(limit: number): string {
  return `A deck can have up to ${slidesOf(limit)}.`
}

export const slideListCopy = {
  listName: "Slides",
  gridView: "Grid view",
  slidesView: "Slides view",
  slideName: (number: number, count: number) => `Slide ${String(number)} of ${String(count)}`,
  selectedName: (number: number, count: number) => `Slide ${String(number)} of ${String(count)}, selected`,
  selected: (count: number) => `${slidesOf(count)} selected`,
  nothingSelected: "Nothing selected",
  entered: (number: number) => `Editing slide ${String(number)}. Tab moves through its layers`,
  newSlide: "New slide",
  addSlide: "Add slide",
  lastSlide: "A deck keeps at least one slide.",
  slideLimit,
  added: (number: number) => `Added slide ${String(number)}`,
  duplicated: (number: number) => `Duplicated slide ${String(number)}. The copy is slide ${String(number + 1)}`,
  deletedSet: (count: number) => `${slidesOf(count)} deleted`,
  duplicatedSet: (count: number) => `Duplicated ${slidesOf(count)}`,
  deleted: (number: number) => `Slide ${String(number)} deleted`,
  moved: (from: number, to: number) => `Moved slide ${String(from)} to position ${String(to)}`,
  movedSeveral: (count: number, to: number) => `Moved ${slidesOf(count)} to position ${String(to)}`,
  skip: "Skip slide",
  unskip: "Unskip slide",
  skipSet: (count: number) => `Skip ${slidesOf(count)}`,
  unskipSet: (count: number) => `Unskip ${slidesOf(count)}`,
  skipped: "Skipped in Present",
  skippedInPresent: (count: number, number: number) =>
    count === 1 ? `Skipped slide ${String(number)} in Present` : `Skipped ${slidesOf(count)} in Present`,
  shownInPresent: (count: number, number: number) =>
    count === 1 ? `Slide ${String(number)} shows in Present` : `${slidesOf(count)} show in Present`,
  open: "Open",
  openKey: "Enter",
  addAfterMenu: "Add slide after",
  addBelowMenu: "Add slide in a new slide group below",
  moveBelowMenu: "Move to a new slide group below",
  addAfter: (number: number) => `Add slide after slide ${String(number)}`,
  addBelow: (group: number) => `Add slide in a new slide group below slide group ${String(group)}`,
  moveGroup: (group: number) => `Move slide group ${String(group)}`,
  groupMoved: (from: number, to: number) => `Moved slide group ${String(from)} to position ${String(to)}`,
  groupKeys: "Alt+ArrowUp Alt+ArrowDown",
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
  moveUpKey: "Ctrl+[",
  moveDownKey: "Ctrl+]",
} as const
