export const slideListCopy = {
  listName: "Slides",
  slideName: (number: number, count: number) => `Slide ${String(number)} of ${String(count)}`,
  added: (number: number) => `Added slide ${String(number)}`,
  addAfter: (number: number) => `Add slide after slide ${String(number)}`,
  duplicated: (number: number) => `Duplicated slide ${String(number)}. The copy is slide ${String(number + 1)}`,
  deleted: (number: number) => `Deleted slide ${String(number)}. Press Control+Z to undo`,
  moved: (from: number, to: number) => `Moved slide ${String(from)} to position ${String(to)}`,
  sectionRange: (range: string) => `slides ${range}`,
} as const
