import { shortcutCopy } from "./shortcut-copy.ts"

const { ArrowLeft, ArrowRight, Home, End, Escape } = shortcutCopy.keyNames

export const deckViewCopy = {
  openInAirDesign: "Open in AirDesign",
  opening: "Opening deck",
  noDeck: "No deck to show yet",
  slide: "Slide preview",
  previousSlide: "Previous slide",
  nextSlide: "Next slide",
  counter: (at: number, count: number) => `${String(at)} / ${String(count)}`,
  fullscreen: "Fullscreen",
  exitFullscreen: "Exit fullscreen",
  selectedLayer: "Selected layer",
  layersSelected: (count: number) => (count === 1 ? "1 layer selected" : `${String(count)} layers selected`),
  clear: "Clear",
  clearSelection: "Clear selection",
  keys: {
    previous: ArrowLeft,
    next: ArrowRight,
    slide: [ArrowLeft, ArrowRight, Home, End].join(" "),
    clear: Escape,
  },
} as const
