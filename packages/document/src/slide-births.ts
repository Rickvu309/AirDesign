import type { SlideCommand } from "./slide-order.js"

type SlideBirth = Extract<SlideCommand, { readonly slide: "add" | "clone" }>

export function slideBirths(command: SlideCommand): readonly SlideBirth[] {
  if (command.slide === "clone-many")
    return command.copies.map((copy) => ({ ...copy, slide: "clone", grid: command.grid }))
  return command.slide === "add" || command.slide === "clone" ? [command] : []
}
