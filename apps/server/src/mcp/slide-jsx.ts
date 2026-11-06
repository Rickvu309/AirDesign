import type {Element} from "../../../../packages/deck/src/index.ts"
export function jsxNode(element:Element):string{
  const {kind,id,...props}=element
  const tag=kind[0]!.toUpperCase()+kind.slice(1)
  const fields=kind==="group" ? Object.fromEntries(Object.entries(props).filter(([key])=>key!=="children")) : props
  const attributes=`id={${JSON.stringify(id)}} props={${JSON.stringify(fields).replaceAll("<","\\u003c").replaceAll(">","\\u003e")}}`
  return kind==="group" ? `<${tag} ${attributes}>${element.children.map(jsxNode).join("")}</${tag}>` : `<${tag} ${attributes} />`
}
