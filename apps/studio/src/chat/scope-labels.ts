import {contentLabel} from "../../../../packages/deck/src/content-labels.ts"
import {flatten,type Deck} from "../../../../packages/deck/src/index.ts"

export function scopeLabels(deck:Deck):Map<string,string> {
  const labels=new Map<string,string>()
  deck.slides.forEach((slide,index)=>{
    labels.set(slide.id,`Slide ${index+1}`)
    flatten(slide.elements).forEach(element=>{
      const content=contentLabel(element)
      labels.set(element.id,`Slide ${index+1} · ${content.slice(0,64) || "Untitled content"}`)
    })
  })
  return labels
}
