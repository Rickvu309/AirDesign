import {flatten,type Deck} from "../../../../packages/deck/src/index.ts"

export function scopeLabels(deck:Deck):Map<string,string> {
  const labels=new Map<string,string>()
  deck.slides.forEach((slide,index)=>{
    labels.set(slide.id,`Slide ${index+1}`)
    flatten(slide.elements).forEach(element=>{
      const content=element.kind==="text" ? element.runs.map(run=>run.text).join("").replaceAll(/\s+/g," ").trim() : element.kind==="image" ? element.image.alt : element.kind==="shape" ? "Shape" : "Group"
      labels.set(element.id,`Slide ${index+1} · ${content.slice(0,64) || "Untitled content"}`)
    })
  })
  return labels
}
