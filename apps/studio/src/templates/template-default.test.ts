import { expect,it } from "vitest"
import { newSlide } from "../editor/editor-model.ts"
import { fixtureDeck } from "../../../../packages/deck/src/fixture.ts"
import { apply } from "../../../../packages/deck/src/index.ts"
import { applyTemplate,basics } from "../../../../packages/brand/src/index.ts"
it("uses the pinned default look for slides added to a new deck",()=>{
  const deck=fixtureDeck(0),result=apply(deck,applyTemplate(deck,basics[1]!,{kind:"apply-deck"}).changes)
  if(!result.ok)throw new Error(result.error.message)
  const slide=newSlide(result.deck),text=slide.elements[0]
  expect(slide.theme).toBe("dark")
  expect(text?.theme).toBe("dark")
  expect(text?.kind==="text" && text.runs[0].color).toBe("#ffffff")
})

it("retains the imported default layout when the first slide is added",()=>{
  const deck=fixtureDeck(0),template={...basics[0]!,id:"imported",families:[{id:"master1",name:"Master 1",master:"ppt/slideMasters/slideMaster1.xml",layouts:["ppt/slideLayouts/slideLayout1.xml"]}]},result=apply(deck,applyTemplate(deck,template,{kind:"apply-deck"}).changes)
  if(!result.ok)throw new Error("default-imported-look")
  expect(newSlide(result.deck).layout).toEqual({template:"imported",version:1,family:"master1",master:"ppt/slideMasters/slideMaster1.xml",part:"ppt/slideLayouts/slideLayout1.xml"})
})
