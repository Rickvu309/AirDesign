import type {Run} from "../../deck/src/model.ts"
export type TextFormat="bold"|"italic"|"underline"
export function formatRuns(runs:[Run,...Run[]],format:TextFormat,start:number,end:number):[Run,...Run[]] {
  let offset=0
  const enabled=!runs.filter(run=>{const from=offset;offset+=run.text.length;return from<end && offset>start}).every(run=>Boolean(run[format]))
  offset=0
  const next:Run[]=[]
  for(const run of runs){
    const from=Math.max(0,start-offset),to=Math.min(run.text.length,end-offset)
    if(from<to){if(from>0)next.push({...run,text:run.text.slice(0,from)});next.push({...run,text:run.text.slice(from,to),[format]:enabled});if(to<run.text.length)next.push({...run,text:run.text.slice(to)})}
    else next.push({...run})
    offset+=run.text.length
  }
  return [next[0] ?? runs[0],...next.slice(1)]
}
export function textSelection(node:HTMLElement):{start:number;end:number}|null {
  const selection=node.ownerDocument.getSelection()
  if(!selection?.rangeCount)return null
  const range=selection.getRangeAt(0)
  if(!node.contains(range.startContainer)||!node.contains(range.endContainer))return null
  const prefix=range.cloneRange();prefix.selectNodeContents(node);prefix.setEnd(range.startContainer,range.startOffset)
  const start=prefix.toString().length
  return {start,end:start+range.toString().length}
}
