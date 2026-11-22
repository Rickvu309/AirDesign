import { elementId, writeTextValue, type ElementId } from "@airdesign/document"
import { expect, it } from "vitest"
import { leftEmptied } from "./emptied-text"
import { indexedRegister } from "@/editing/indexed-register"
import { editedRegister, onSlide, twoBoxSlide, xml } from "@/slide-fixtures"

const emptied = writeTextValue([{ from: 0, runs: [{ from: 0, text: "" }] }])
const body = elementId("256.3")
const titled = twoBoxSlide.replace(
  '<p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr/>',
  '<p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr><p:ph type="body"/></p:nvPr>',
)

function leaving(slide: string, typed: boolean) {
  const parts = onSlide(xml(slide))
  const removed: ElementId[] = []
  const order: string[] = []
  const left = leftEmptied({
    typedIn: (node) => typed && node === body,
    landed: async () => {
      order.push("landed")
    },
    saved: async () => {
      order.push("read")
      return indexedRegister(parts, editedRegister([["256.3", emptied]]))
    },
    remove: async (node) => {
      removed.push(node)
    },
  })
  return { left, removed, order }
}

it("removes a text layer whose words the person deleted, once the typing is recorded", async () => {
  const deck = leaving(twoBoxSlide, true)
  await deck.left(body)
  expect(deck.removed).toEqual([body])
  expect(deck.order).toEqual(["landed", "read"])
})

it("keeps an empty text layer the person left without typing in it", async () => {
  const deck = leaving(twoBoxSlide, false)
  await deck.left(body)
  expect(deck.removed).toEqual([])
})

it("keeps an emptied placeholder, as PowerPoint does", async () => {
  const deck = leaving(titled, true)
  await deck.left(body)
  expect(deck.removed).toEqual([])
})
