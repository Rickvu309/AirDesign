import { elementId, slideId, writeTextValue } from "@airdesign/document"
import { paintStore } from "@airdesign/render"
import { expect, it } from "vitest"
import { airaStarters } from "./aira-starters"
import { airaCopy } from "./copy/aira-copy"

function deck(slides: readonly (readonly string[])[]) {
  const store = paintStore()
  slides.forEach((texts, slide) => {
    texts.forEach((text, index) => {
      store.publish({ id: elementId(`${256 + slide}.${index + 2}`), kind: "shape", text, picture: null })
    })
  })
  store.setSlides(
    slides.map((texts, slide) => ({
      id: slideId(String(256 + slide)),
      elements: texts.map((_, index) => elementId(`${256 + slide}.${index + 2}`)),
    })),
  )
  return store
}

function words(text: string): string {
  return writeTextValue([{ from: 0, runs: [{ from: -1, text }] }])
}

it("offers no starters before the deck has painted", () => {
  expect(airaStarters(deck([]))).toEqual([])
})

it("offers the drafting starters on a blank deck", () => {
  expect(airaStarters(deck([["", words("  ")]]))).toEqual(airaCopy.draftStarters)
})

it("offers the drafting starters while only one slide has words", () => {
  expect(airaStarters(deck([[words("Hello")], [""], [words(" ")]]))).toEqual(airaCopy.draftStarters)
})

it("offers the repair starters once two slides have words", () => {
  expect(airaStarters(deck([[words("Hello")], [""], ["Heat pumps move heat"]]))).toEqual(airaCopy.repairStarters)
})

it("offers four starters in each set, none in both", () => {
  expect(airaCopy.draftStarters).toHaveLength(4)
  expect(airaCopy.repairStarters).toHaveLength(4)
  expect(airaCopy.draftStarters.filter((starter) => airaCopy.repairStarters.includes(starter as never))).toEqual([])
})
