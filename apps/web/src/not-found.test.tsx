import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { productCopy } from "@/copy/product-copy"
import { NotFound } from "@/decks/not-found"

const escaped = (text: string) => text.replaceAll("'", "&#x27;")

const page = (kind: "address" | "deck") => renderToStaticMarkup(<NotFound kind={kind} />)

it("names a wrong address and links to the decks", () => {
  const html = page("address")
  expect(html).toContain(`<h1`)
  expect(html).toContain(productCopy.addressNotFoundTitle)
  expect(html).toContain(escaped(productCopy.addressNotFoundBody))
  expect(html).toMatch(new RegExp(`<a href="/"[^>]*>${productCopy.goToDecks}</a>`))
})

it("names a missing deck and links to the decks", () => {
  const html = page("deck")
  expect(html).toContain(productCopy.deckNotFoundTitle)
  expect(html).toContain(escaped(productCopy.deckNotFoundBody))
  expect(html).toMatch(new RegExp(`<a href="/"[^>]*>${productCopy.goToDecks}</a>`))
})

it("keeps the decks sidebar and offers no editing controls", () => {
  const html = page("deck")
  expect(html).toContain("data-decks-sidebar")
  expect(html).not.toContain("Export")
  expect(html).not.toContain("Ask Aira")
  expect(html).not.toContain("contenteditable")
})
