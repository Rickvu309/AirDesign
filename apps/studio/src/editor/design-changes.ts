import {flatten,type Change,type ChangeSet,type Deck,type Id,type Slide} from "../../../../packages/deck/src/index.ts"

export function slideBackground(slide:Slide) {
  const element=slide.elements[0]
  return element?.kind==="shape" && element.support.kind==="native" && element.geometry==="rectangle" && element.box.x===0 && element.box.y===0 && element.box.width===slide.size.width && element.box.height===slide.size.height ? element : undefined
}

export function backgroundChanges(deck:Deck,selection:Id[],color:string):ChangeSet {
  return {changes:deck.slides.filter(slide=>selection.includes(slide.id)).map(slide=>{
    const background=slideBackground(slide)
    if(background)return {kind:"set",target:background.id,value:{...background,fill:color}}
    return {kind:"set",target:slide.id,value:{...slide,background:color}}
  })}
}

export function paletteChanges(deck:Deck,selection:Id[],previous:string,color:string):ChangeSet {
  return {changes:deck.slides.filter(slide=>selection.includes(slide.id)).flatMap(slide=>flatten(slide.elements).flatMap((element):Change[]=>{
    if(element.support.kind!=="native")return []
    if(element.kind==="shape" && element.fill.toLowerCase()===previous.toLowerCase())return [{kind:"set" as const,target:element.id,value:{...element,fill:color}}]
    if(element.kind!=="text" || !element.runs.some(run=>run.color.toLowerCase()===previous.toLowerCase()))return []
    const [first,...rest]=element.runs.map(run=>run.color.toLowerCase()===previous.toLowerCase() ? {...run,color} : run)
    if(!first)return []
    return [{kind:"set" as const,target:element.id,value:{...element,runs:[first,...rest]}}]
  }))}
}
