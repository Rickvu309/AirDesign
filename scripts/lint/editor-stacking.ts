export function editorStackingHits(file:string,source:string):{line:number;reason:string}[]{
  if(!file.endsWith("apps/studio/src/editor/workspace.css"))return []
  const levels=(selector:string)=>[...source.matchAll(/([^{}]+)\{([^{}]+)\}/g)].flatMap(match=>match[1]!.trim().split(",").map(value=>value.trim()).includes(selector) ? [...match[2]!.matchAll(/z-index:\s*(\d+)/g)].map(value=>Number(value[1])) : [])
  const toolbar=levels(".editor-bar").at(-1)??0,exportLevel=levels(".editor-export").at(-1)??0
  return toolbar>exportLevel ? [] : [{line:1,reason:"deck-menu-toolbar-must-stack-above-export"}]
}
