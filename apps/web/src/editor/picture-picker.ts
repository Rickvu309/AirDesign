import { mediaTypes } from "@airdesign/document"

export const pictureAccept = mediaTypes.join(",")

export function pickPicture(onPicture: (file: File) => void, made: Document = document) {
  const input = made.createElement("input")
  input.type = "file"
  input.accept = pictureAccept
  input.addEventListener("change", () => {
    const file = input.files?.[0]
    if (file !== undefined) onPicture(file)
  })
  input.click()
}
