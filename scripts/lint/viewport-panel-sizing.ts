export function viewportPanelSizingHits(file:string,source:string):{line:number;reason:string}[]{
  if(!file.endsWith(".css"))return []
  return [...source.matchAll(/([^{}]+)\{([^{}]+)\}/g)].flatMap(match=>{
    const declarations=match[2]!
    return /position\s*:\s*fixed/.test(declarations) && /inline-size\s*:[^;]*100vi/.test(declarations) && /padding(?:-inline)?\s*:/.test(declarations) && !/box-sizing\s*:\s*border-box/.test(declarations) ? [{line:source.slice(0,match.index).split("\n").length,reason:"viewport-panel-padding-needs-border-box"}] : []
  })
}
