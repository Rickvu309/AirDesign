import type { Box, Element } from "../../deck/src/model.ts"
import { contentLabel } from "../../deck/src/content-labels.ts"

export function preservationLabel(element: Element): string {
  const label = element.source.kind === "original" ? contentLabel(element) : {text:"Text",image:"Image",shape:"Shape",group:"Group"}[element.kind]
  if(element.support.kind === "flagged") {
    if(element.support.preservation === "removed")return `${label} · Removed for safety · ${element.support.reason}`
    if(element.support.preservation === "partial")return `${label} · Some removed for safety · Rest preserved on export`
    if(element.support.preservation === "reported")return `${label} · Preserved on export · Prior source report (unverified)`
  }
  return `${label} · Preserved on export`
}
export function keptBounds(element: Element, canvas: {width:number;height:number}, obstacles: Box[] = [], markers: Box[] = []): Box {
  const width=Math.min(canvas.width,204),height=Math.min(canvas.height,40)
  const origin={x:Math.max(0,Math.min(canvas.width-width,element.box.x)),y:Math.max(0,Math.min(canvas.height-height,element.box.y)),width,height}
  const candidates=[origin]
  for(let y=0;y+height<=canvas.height&&candidates.length<129;y+=height+4)for(let x=0;x+width<=canvas.width&&candidates.length<129;x+=width+4)candidates.push({x,y,width,height})
  const overlap=(box:Box,obstacles:Box[])=>obstacles.reduce((sum,other)=>sum+Math.max(0,Math.min(box.x+box.width,other.x+other.width)-Math.max(box.x,other.x))*Math.max(0,Math.min(box.y+box.height,other.y+other.height)-Math.max(box.y,other.y)),0)
  return candidates.reduce((best,candidate)=>overlap(candidate,markers)<overlap(best,markers) || overlap(candidate,markers)===overlap(best,markers)&&overlap(candidate,obstacles)<overlap(best,obstacles) ? candidate : best,origin)
}
export function KeptContent({ element, bounds }: { element: Element; bounds: Box }) {
  if (element.support.kind === "native") return null
  return <svg data-kept-content="" role="img" aria-label={preservationLabel(element)} width="100%" height="100%" style={{overflow:"visible"}}>
    <foreignObject width="100%" height="100%"><div data-preservation={element.id} style={{width:"100%",height:"100%",background:"var(--muted, #f5f5f5)",color:"var(--foreground, #171717)",border:"1px solid var(--border, #a3a3a3)",fontFamily:"Geist, sans-serif",fontSize:11,lineHeight:"12px",padding:4,overflow:"hidden"}}>{preservationLabel(element)}</div></foreignObject>
    {element.support.preview?.trim() && <image href={element.support.preview} x={element.box.x-bounds.x} y={element.box.y-bounds.y} width={element.box.width} height={element.box.height} preserveAspectRatio="xMidYMid meet"/>}
  </svg>
}
