import assert from "node:assert/strict"
import {fixtureDeck} from "../../packages/deck/src/fixture.ts"

export const brandFont="Geist"
export function fontDeck(id,count=2){
  const deck={...fixtureDeck(2,count),id,template:{id:"light",version:1,family:"basic"}}
  for(const slide of deck.slides){
    slide.elements[0].runs=[{...slide.elements[0].runs[0],font:"Arial"},{text:" with evidence",font:"Georgia",size:18,color:"#123456",bold:false}]
  }
  return deck
}
export function content(deck){
  return {...deck,version:0,slides:deck.slides.map(slide=>({...slide,version:0}))}
}
export function assertFontChange(before,after,selection=[]){
  const expected=structuredClone(before),selected=new Set(selection)
  for(const slide of expected.slides){
    for(const element of slide.elements){
      if(element.kind==="text"&&(!selected.size||selected.has(slide.id)||selected.has(element.id)))element.runs=element.runs.map(run=>({...run,font:brandFont}))
    }
  }
  assert.notDeepEqual(content(after),content(before),"the adapter must make an observable style mutation")
  assert.deepEqual(content(after),content(expected),"only the selected brand font may change; preserve text, notes and other content")
}
export function assertStylePaint(before,after,paint,seq,suppliedFonts){
  assert.deepEqual(before.fonts.map(font=>font.split(",")[0].trim()),suppliedFonts,"initial browser paint must preserve the supplied run fonts")
  assert.equal(paint.seq,seq)
  assert.notDeepEqual(paint.fonts,before.fonts,"a sequence update without changed rendered style is not font paint")
  assert.deepEqual(paint.fonts,after.fonts)
  assert.deepEqual(paint.texts,before.texts)
  assert.deepEqual(paint.texts,after.texts)
  assert.ok(paint.fonts.every(font=>font===brandFont||font.startsWith(brandFont+",")))
}
export const textStyleObservation=`(()=>{const spans=[...document.querySelectorAll('[data-text="s0e0"] span')];return {seq:Number(document.querySelector(".studio-editor").dataset.seq),fonts:spans.map(span=>getComputedStyle(span).fontFamily.replaceAll('"',"")),texts:spans.map(span=>span.textContent)}})()`
