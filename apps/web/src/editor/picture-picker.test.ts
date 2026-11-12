import { expect, it } from "vitest"
import { pickPicture, pictureAccept } from "./picture-picker"

type FakeInput = {
  type: string
  accept: string
  files: File[] | null
  clicked: boolean
  changed?: () => void
  addEventListener(name: string, listener: () => void): void
  click(): void
}

it("opens a picker for PNG, JPEG and GIF and hands over the chosen file", () => {
  const chosen: File[] = []
  const input: FakeInput = {
    type: "",
    accept: "",
    files: null,
    clicked: false,
    addEventListener(name, listener) {
      if (name === "change") input.changed = listener
    },
    click() {
      input.clicked = true
    },
  }
  pickPicture((file) => chosen.push(file), { createElement: () => input } as unknown as Document)
  expect(input).toMatchObject({ type: "file", accept: "image/png,image/jpeg,image/gif", clicked: true })
  expect(pictureAccept).toBe(input.accept)
  const file = new File([new Uint8Array([1])], "a.png", { type: "image/png" })
  input.files = [file]
  input.changed?.()
  expect(chosen).toEqual([file])
})
