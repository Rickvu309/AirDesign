import {expect,it} from "vitest"
import {applyTemplate,basics,templateDeck} from "../src/index.ts"
import {welcomeDeck} from "../../catalog/src/welcome-deck.ts"
import {flatten,id,parseDeck,themeId} from "../../deck/src/index.ts"
import {parseNativeArchiveV3} from "../../deck/src/text/native-v3.ts"
import {commandId} from "../../change-log/src/index.ts"
import {executeNative,initialNativeHistory,nativeNodes} from "../../change-log/src/text/native-model.ts"

it("creates native welcome and branded seeds without a legacy text conversion",()=>{
  const deck=welcomeDeck()
  expect(parseNativeArchiveV3({version:3,deck}).deck).toEqual(deck)
  expect(welcomeDeck()).toEqual(deck)
  expect(new Set(nativeNodes(deck).map(node=>node.id)).size).toBe(nativeNodes(deck).length)
  expect(()=>parseDeck(deck)).toThrow()
  const legacy=welcomeDeck("legacy-text-v2")
  expect(parseDeck(legacy)).toEqual(legacy)
  expect(()=>parseNativeArchiveV3({version:3,deck:legacy})).toThrow()
  expect(flatten(deck.slides[0]!.elements).map(element=>element.id)).toEqual([id("heading0"),id("body0")])
  expect(templateDeck(basics[1]!)).toMatchObject({template:{id:"dark",version:1,family:"basic"},slides:[]})
})

it("brands nested native paragraphs and insertion styles while preserving topology and protected undo",()=>{
  const deck=welcomeDeck(),slide=deck.slides[0]!,text=slide.elements[0]!
  if(text.kind!=="text")throw new Error("text-required")
  text.theme=themeId("welcome")
  text.styleLinks=["color"]
  text.body.frame.anchor="bottom"
  text.body.frame.insets={top:1,right:2,bottom:3,left:4}
  const first=text.body.paragraphs[0]
  first.runs.push({kind:"break",style:{...first.endStyle,italic:true}})
  first.marker={kind:"number",format:"romanUpper",start:4}
  first.indentation={left:24,right:8,firstLine:-12}
  first.spacing.after=18
  text.body.paragraphs.push({...structuredClone(first),id:id("trailing"),runs:[],endStyle:{...first.endStyle,size:31,underline:true},marker:{kind:"number",format:"romanUpper",start:null}})
  const {body,...groupBase}=text
  void body
  slide.elements=[{...groupBase,id:id("nested"),kind:"group",children:[text]}]
  const before=structuredClone(text),ids=nativeNodes(deck).map(node=>node.id),plan=applyTemplate(deck,{...basics[1]!,font:"BrandSans"},{kind:"apply-deck"})
  const branded=executeNative(initialNativeHistory(deck),{id:commandId("brand"),kind:"edit",base:0,run:null,changes:plan.changes})
  expect(branded.receipt.kind).toBe("applied")
  expect(nativeNodes(branded.history.deck).map(node=>node.id)).toEqual(ids)
  const result=flatten(branded.history.deck.slides[0]!.elements).find(element=>element.id===text.id)
  if(result?.kind!=="text")throw new Error("branded-text-required")
  expect(result.body.frame).toEqual(before.body.frame)
  expect(result.body.paragraphs).toEqual(before.body.paragraphs.map(paragraph=>({...paragraph,endStyle:{...paragraph.endStyle,color:"#ffffff"},runs:paragraph.runs.map(run=>({...run,style:{...run.style,color:"#ffffff"}}))})))
  expect(plan.retained).toContain(`${text.id}.font`)
  const later=executeNative(branded.history,{id:commandId("later"),kind:"patch",base:1,run:null,target:first.id,fields:{alignment:"center"}})
  const undone=executeNative(later.history,{id:commandId("undo"),kind:"undo",target:commandId("brand")})
  expect(undone.receipt.kind).toBe("applied")
  const restored=flatten(undone.history.deck.slides[0]!.elements).find(element=>element.id===text.id)
  expect(restored).toEqual({...before,body:{...before.body,paragraphs:before.body.paragraphs.map(paragraph=>paragraph.id===first.id ? {...paragraph,alignment:"center"} : paragraph)}})
  expect(()=>applyTemplate(deck,{...basics[1]!,fontRight:"missing"},{kind:"apply-deck"})).toThrow("choose-font-substitution")
})

it("brands linked native fonts and inserts a themed slide without changing existing paragraphs",()=>{
  const deck=welcomeDeck(),text=deck.slides[0]!.elements[0]!
  if(text.kind!=="text")throw new Error("text-required")
  text.theme=themeId("welcome")
  const template={...basics[1]!,font:"BrandSans"},plan=applyTemplate(deck,template,{kind:"apply-deck"})
  const branded=executeNative(initialNativeHistory(deck),{id:commandId("linked"),kind:"edit",base:0,run:null,changes:plan.changes})
  const actual=flatten(branded.history.deck.slides[0]!.elements).find(element=>element.id===text.id)
  if(actual?.kind!=="text")throw new Error("text-required")
  expect(actual.body.paragraphs[0].endStyle).toMatchObject({font:"BrandSans",color:"#ffffff"})
  expect(actual.body.paragraphs[0].runs[0]?.style).toMatchObject({font:"BrandSans",color:"#ffffff"})
  const insertion=applyTemplate(branded.history.deck,basics[0]!,{kind:"insert-slide",slideId:"inserted",family:"basic"})
  const inserted=executeNative(branded.history,{id:commandId("insert"),kind:"edit",base:branded.history.seq,run:null,changes:insertion.changes})
  expect(inserted.receipt.kind).toBe("applied")
  expect(inserted.history.deck.slides.slice(0,-1)).toEqual(branded.history.deck.slides.map(slide=>({...slide,version:inserted.history.seq})))
  expect(inserted.history.deck.slides.at(-1)).toMatchObject({id:"inserted",elements:[],theme:"light"})
})
