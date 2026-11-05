export function viewportPanelSizingHits(file:string,source:string):{line:number;reason:string}[]{
  if(!file.endsWith(".css"))return []
  return [...source.matchAll(/([^{}]+)\{([^{}]+)\}/g)].flatMap(match=>{
    const declarations=match[2]!
    const selector=match[1]!.trim()
    const line=source.slice(0,match.index).split("\n").length
    if(/overflow\s*:\s*auto/.test(declarations)&&/display\s*:\s*flex/.test(declarations)&&/flex-direction\s*:\s*column/.test(declarations)&&selector===".image-panel"&&!/\.image-panel\s*>\s*\*\s*\{[^}]*flex-shrink\s*:\s*0/.test(source))return [{line,reason:"scrolling-image-panel-must-not-shrink-controls"}]
    return /position\s*:\s*fixed/.test(declarations) && /inline-size\s*:[^;]*100vi/.test(declarations) && /padding(?:-inline)?\s*:/.test(declarations) && !/box-sizing\s*:\s*border-box/.test(declarations) ? [{line:source.slice(0,match.index).split("\n").length,reason:"viewport-panel-padding-needs-border-box"}] : []
  })
}
