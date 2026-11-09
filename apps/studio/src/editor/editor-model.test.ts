import { createNativePresentation } from "../../../../packages/pptx/src/native.ts"
import { importedDeck } from "../../../../packages/pptx/src/import-deck.ts"
import { writeSavedPptx } from "../../../../packages/pptx/src/export-deck.ts"
import { exportPptx,importPptx } from "../../../../packages/pptx/src/index.ts"
import { describe,it,expect } from "vitest"
import { id } from "../../../../packages/deck/src/index.ts"
import { fixtureDeck,fixtureElement } from "../../../../packages/deck/src/fixture.ts"
import { elementWithBox,newSlide,orderedSlides,reviewPaste,selectSlides } from "./editor-model.ts"

describe("manual slide operations",()=>{
  it("adds slides in the imported presentation size",()=>{
    const deck=fixtureDeck(1);deck.slides[0]!.size={width:1280,height:720}
    expect(newSlide(deck).size).toEqual({width:1280,height:720})
  })
  it("exports imported presentations after adding a manual slide",async()=>{
    const source=await createNativePresentation([{title:"Imported",notes:"",table:{headers:["Year"],rows:[["2026"]]},chart:{name:"Value",labels:["A"],values:[3]}}]),deck=importedDeck(source)
    deck.slides.push(newSlide(deck))
    const result=importedDeck(await importPptx(await writeSavedPptx(deck,1,await exportPptx(source),{})))
    expect(result.slides).toHaveLength(2)
    expect(result.slides[1]?.size).toEqual(result.slides[0]?.size)
  })
  it("keeps toggle, shift and batch movement in deck order",()=>{
    const deck=fixtureDeck(1,5),s=deck.slides.map(slide=>slide.id)
    expect(selectSlides(deck,[],id("s3"),id("s1"),true,false)).toEqual(s.slice(1,4))
    expect(selectSlides(deck,[id("s3")],id("s1"),null,false,true)).toEqual([id("s1"),id("s3")])
    expect(orderedSlides(deck,[id("s1"),id("s2")],-1)).toEqual([s[1],s[2],s[0],s[3],s[4]])
    expect(orderedSlides(deck,[id("s1"),id("s2")],1)).toEqual([s[0],s[3],s[1],s[2],s[4]])
  })
  it("retains refused paste input and copies only the explicitly accepted subset",()=>{
    const slide=newSlide(),source=JSON.stringify({slides:[slide,{id:"broken"},slide]})
    const review=reviewPaste(source)
    expect(review.source).toBe(source)
    expect(review.accepted).toHaveLength(2)
    expect(review.refused).toHaveLength(1)
    expect(new Set(review.accepted.map(item=>item.id)).size).toBe(2)
    expect(review.accepted[0]?.elements[0]?.id).not.toBe(slide.elements[0]?.id)
    expect(reviewPaste(JSON.stringify({slides:[{...slide,source:{kind:"original",part:"ppt/slides/slide1.xml",sha256:"a".repeat(64),objectId:"slide",dependencies:[]}}]})).accepted).toHaveLength(0)
    expect(reviewPaste("not json").accepted).toHaveLength(0)
  })
})

it("expands a zero-sized native group without non-finite child geometry",()=>{
  const child=fixtureElement(1),group={...child,kind:"group" as const,box:{x:0,y:0,width:0,height:0},children:[child]}
  const resized=elementWithBox(group,{x:0,y:0,width:80,height:60})
  expect(resized.kind==="group"&&resized.children[0]?.box).toEqual(child.box)
  expect(resized.box).toEqual({x:0,y:0,width:80,height:60})
})
