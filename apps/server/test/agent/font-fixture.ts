import {fixtureDeck} from "../../../../packages/deck/src/fixture.ts"
import {id,type Deck,type Run} from "../../../../packages/deck/src/index.ts"

export const brandedRuns=[
  {text:"A clear direction",bold:true,font:"Geist",size:40,color:"#172333"},
  {text:" with evidence",bold:false,font:"Geist",size:18,color:"#123456"},
] satisfies Run[]

export function fontDeck(slideCount=2):Deck{
  const deck=fixtureDeck(2,slideCount)
  for(const slide of deck.slides){
    const title=slide.elements[0]
    if(title?.kind!=="text")throw new Error("text-fixture-required")
    title.runs=[{...title.runs[0],font:"Arial"},{text:" with evidence",bold:false,font:"Georgia",size:18,color:"#123456"}]
    slide.elements.push({...title,id:id(`${slide.id}detail`),runs:[{text:"Keep supporting detail",bold:false,font:"Georgia",size:18,color:"#123456"}]})
  }
  return {...deck,template:{id:"light",version:1,family:"basic"}}
}
