import { mediaTypes } from "@airdesign/doom"

export const pictureAccept = mediaTypes.join(",")

let held: HTMLInputElement | null = null

function letGo(input: HTMLInputElement) {
  if (held === input) held = null
}

export function pickPicture(onPicture: (file: File) => void, made: Document = document) {
  const input = made.createElement("input")
  input.type = "file"
  input.accept = pictureAccept
  input.addEventListener("change", () => {
    letGo(input)
    input.blur()
    const file = input.files?.[0]
    if (file !== undefined) onPicture(file)
  })
  input.addEventListener("cancel", () => {
    letGo(input)
    input.blur()
  })
  held = input
  input.click()
}
