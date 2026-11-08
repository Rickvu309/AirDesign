import assert from "node:assert/strict"
import {test} from "node:test"
import {fontDeck,assertFontChange,assertStylePaint} from "./font-contract.mjs"

function changed(deck,selection=[]){
  const after=structuredClone(deck)
  for(const slide of after.slides)for(const element of slide.elements)if(element.kind==="text"&&(!selection.length||selection.includes(slide.id)||selection.includes(element.id)))element.runs=element.runs.map(run=>({...run,font:"Geist"}))
  return after
}
test("font contract observes selected mutation and preserves content, notes and other scopes",()=>{
  const before=fontDeck("contract"),after=changed(before,["s0e0"])
  assertFontChange(before,after,["s0e0"])
  assert.throws(()=>assertFontChange(before,before,["s0e0"]),/observable style mutation/)
  assert.throws(()=>assertFontChange(before,changed(before),["s0e0"]),/preserve text/)
  for(const field of ["text","notes"]){
    const corrupted=structuredClone(after)
    if(field==="text")corrupted.slides[0].elements[0].runs[0].text="request text"
    else corrupted.slides[0].notes="lost notes"
    assert.throws(()=>assertFontChange(before,corrupted,["s0e0"]),/preserve text/)
  }
})
test("paint contract rejects a sequence-only update, wrong sequence, wrong font and changed text",()=>{
  const before={seq:1,fonts:["Arial","Georgia"],texts:["A clear direction"," with evidence"]},after={...before,seq:2,fonts:["Geist","Geist"]},paint={...after,wall:123},suppliedFonts=["Arial","Georgia"]
  assertStylePaint(before,after,paint,2,suppliedFonts)
  assert.throws(()=>assertStylePaint({...before,fonts:["Geist","Geist"]},after,paint,2,suppliedFonts),/supplied run fonts/)
  assert.throws(()=>assertStylePaint(before,after,{...before,seq:2},2,suppliedFonts),/changed rendered style/)
  assert.throws(()=>assertStylePaint(before,after,{...paint,seq:1},2,suppliedFonts))
  assert.throws(()=>assertStylePaint(before,after,{...paint,fonts:["Arial","Arial"]},2,suppliedFonts))
  assert.throws(()=>assertStylePaint(before,after,{...paint,texts:["prompt"]},2,suppliedFonts))
})
