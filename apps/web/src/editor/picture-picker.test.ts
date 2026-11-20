import { expect, it } from "vitest"
import { openPicker, pickPicture, pictureAccept } from "./picture-picker"

type FakeInput = {
  type: string
  accept: string
  files: File[] | null
  clicked: boolean
  heard: Map<string, () => void>
  addEventListener(name: string, listener: () => void): void
  click(): void
}

function fakeInput(): FakeInput {
  const input: FakeInput = {
    type: "",
    accept: "",
    files: null,
    clicked: false,
    heard: new Map(),
    addEventListener(name, listener) {
      input.heard.set(name, listener)
    },
    click() {
      input.clicked = true
    },
  }
  return input
}

function madeWith(input: FakeInput): Document {
  return { createElement: () => input } as unknown as Document
}

it("opens a picker for PNG, JPEG and GIF and hands over the chosen file", () => {
  const chosen: File[] = []
  const input = fakeInput()
  pickPicture((file) => chosen.push(file), madeWith(input))
  expect(input).toMatchObject({ type: "file", accept: "image/png,image/jpeg,image/gif", clicked: true })
  expect(pictureAccept).toBe(input.accept)
  const file = new File([new Uint8Array([1])], "a.png", { type: "image/png" })
  input.files = [file]
  input.heard.get("change")?.()
  expect(chosen).toEqual([file])
})

it("holds the open picker until it reports a choice or a cancel, so its choice is never collected away", () => {
  const cancelled = fakeInput()
  pickPicture(() => undefined, madeWith(cancelled))
  expect(openPicker()).toBe(cancelled)
  cancelled.heard.get("cancel")?.()
  expect(openPicker()).toBeNull()
  const chosen = fakeInput()
  pickPicture(() => undefined, madeWith(chosen))
  expect(openPicker()).toBe(chosen)
  chosen.heard.get("change")?.()
  expect(openPicker()).toBeNull()
})
