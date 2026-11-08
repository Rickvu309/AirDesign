import type {Slide} from "../../../../packages/deck/src/index.ts"
export function slideSections(slides:Slide[]) {
  const sections:{name:string;slides:{slide:Slide;number:number}[]}[]=[]
  for(const [index,slide] of slides.entries()){
    const name=slide.section ?? "Slides",last=sections.at(-1)
    if(last?.name===name)last.slides.push({slide,number:index+1})
    else sections.push({name,slides:[{slide,number:index+1}]})
  }
  return sections
}
