const plural = new Intl.PluralRules("en")

function slidesOf(count: number): string {
  return plural.select(count) === "one" ? `${String(count)} slide` : `${String(count)} slides`
}

function slideLimit(limit: number): string {
  return `A deck can have up to ${slidesOf(limit)}.`
}

export const slideListCopy = {
  groupCount: slidesOf,
  listName: "Slides",
  slideName: (number: number, count: number) => `Slide ${String(number)} of ${String(count)}`,
  selectedName: (number: number, count: number) => `Slide ${String(number)} of ${String(count)}, selected`,
  selected: (count: number) => `${slidesOf(count)} selected`,
  nothingSelected: "Nothing selected",
  entered: (number: number) => `Editing slide ${String(number)}. Tab moves through its layers`,
  newSlide: "New slide",
  addSlide: "Add slide",
  lastSlide: "The last slide cannot be deleted.",
  slideLimit,
  addLimit: (limit: number) => `${slideLimit(limit)} Delete a slide to add another.`,
  setRefused: "Unable to change the selected slides. Select them again and try again.",
  added: (number: number) => `Added slide ${String(number)}`,
  addAfterMenu: "Add slide after",
  addBelowMenu: "Add slide in a new slide group below",
  moveBelowMenu: "Move to a new slide group below",
  addAfter: (number: number) => `Add slide after slide ${String(number)}`,
  moveGroup: (group: number) => `Move slide group ${String(group)}`,
  groupMoved: (from: number, to: number) => `Moved slide group ${String(from)} to position ${String(to)}`,
  groupKeys: "Alt+ArrowUp Alt+ArrowDown",
  addBelow: (group: number) => `Add slide in a new slide group below slide group ${String(group)}`,
  duplicated: (number: number) => `Duplicated slide ${String(number)}. The copy is slide ${String(number + 1)}`,
  deletedSet: (count: number) => `${slidesOf(count)} deleted`,
  duplicatedSet: (count: number) => `Duplicated ${slidesOf(count)}`,
  deleted: (number: number) => `Slide ${String(number)} deleted`,
  moved: (from: number, to: number) => `Moved slide ${String(from)} to position ${String(to)}`,
  movedSeveral: (count: number, to: number) => `Moved ${slidesOf(count)} to position ${String(to)}`,
  groupRange: (range: string) => `slides ${range}`,
  actions: (number: number) => `Slide ${String(number)} actions`,
  open: "Open",
  openKey: "Enter",
  skip: "Skip slide",
  unskip: "Unskip slide",
  skipSet: (count: number) => `Skip ${slidesOf(count)}`,
  unskipSet: (count: number) => `Unskip ${slidesOf(count)}`,
  skipped: "Skipped in Present",
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
