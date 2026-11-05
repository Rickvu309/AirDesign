import { describe,it,expect } from "vitest"
import { id } from "../../../../packages/deck/src/index.ts"
import { fixtureDeck } from "../../../../packages/deck/src/fixture.ts"
import { newSlide,orderedSlides,reviewPaste,selectSlides } from "./editor-model.ts"

describe("manual slide operations",()=>{
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
