import { it,expect } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Slide } from "../src/index.ts"
import { fixtureDeck } from "../../deck/src/fixture.ts"
it("includes canonical text and styles without browser effects for PDF and read-only rendering",()=>{
  const deck=fixtureDeck(1),slide=deck.slides[0]!,element=slide.elements.find(element=>element.kind==="text")
  if(!element||element.kind!=="text")throw new Error("text-required")
  const html=renderToStaticMarkup(createElement(Slide,{slide,themes:deck.themes}))
  expect(html).toContain(element.runs[0]!.text)
  expect(html).toContain("font-weight:600")
  expect(html).toContain('data-theme-font="Geist"')
})
