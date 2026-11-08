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
it("labels preserved original object types even with missing or failed previews and tiny placement",()=>{
  const slide=fixtureDeck(1).slides[0]!,element=slide.elements[0]!
  for(const preview of [null,"","data:image/png;base64,broken"]){
    const kept={...element,source:{kind:"original" as const,part:"ppt/slides/slide1.xml",sha256:"hash",objectId:"table:0",dependencies:[]},support:{kind:"kept" as const,preview},box:{x:-10,y:-10,width:0,height:0}}
    const html=renderToStaticMarkup(createElement(Slide,{slide:{...slide,elements:[kept]}}))
    expect(html).toContain("Table · Preserved on export")
    expect(html).toContain('data-preservation=')
    expect(html).toContain("Original placement is small or outside the slide")
  }
})
it("never labels removed content preserved",()=>{
  const slide=fixtureDeck(1).slides[0]!,element=slide.elements[0]!
  const html=renderToStaticMarkup(createElement(Slide,{slide:{...slide,elements:[{...element,support:{kind:"flagged",preservation:"removed",preview:null,reason:"remote image removed"}}]}}))
  expect(html).toContain("Removed for safety")
  expect(html).not.toContain("Preserved on export")
})
