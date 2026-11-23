const plural = new Intl.PluralRules("en")

function slidesOf(count: number): string {
  return plural.select(count) === "one" ? `${String(count)} slide` : `${String(count)} slides`
}

function slideLimit(limit: number): string {
  return `A deck can have up to ${slidesOf(limit)}.`
}

export const slideListCopy = {
  listName: "Slides",
  slideName: (number: number, count: number) => `Slide ${String(number)} of ${String(count)}`,
  selectedName: (number: number, count: number) => `Slide ${String(number)} of ${String(count)}, selected`,
  selected: (count: number) => `${slidesOf(count)} selected`,
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
  groupRange: (range: string) => `slides ${range}`,
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
