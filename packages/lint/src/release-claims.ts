import {html,parse,type DefaultTreeAdapterTypes} from "parse5"
export type ExternalGate = "X01" | "X02" | "X03" | "X04" | "X05" | "X06"
export type PublicClaim = {id:string;text:string} & ({kind:"proven";receipt:string}|{kind:"external-passed";gate:ExternalGate;receipt:string}|{kind:"blocked";gate:string})
export function passedExternalClaim(claim:Extract<PublicClaim,{kind:"external-passed"}>,capabilities:string):boolean {
 const receipt=`P09/external/${claim.gate}/results/report.md`
 return claim.receipt===receipt && capabilities.split("\n").some(line=>{
  const cells=line.split("|").map(cell=>cell.trim())
  return cells[1]===claim.gate && cells[2]==="passed" && cells[3]===receipt
 })
}
const browserChromeNames=new Set(["viewport","theme-color","color-scheme"])
const browserChromeAttributes=new Set(["name","content","media"])
const copyAttributes=new Set(["alt","aria-label","content"])
const inertElements=new Set(["script","style","template"])
type ParsedNode=DefaultTreeAdapterTypes.Node
type ParsedElement=DefaultTreeAdapterTypes.Element
function isElement(node:ParsedNode):node is ParsedElement{
 return "tagName" in node
}
function isBrowserChromeMeta(element:ParsedElement):boolean{
 const name=element.attrs.find(attribute=>attribute.name==="name")?.value.trim().toLowerCase()??""
 return element.tagName==="meta" && browserChromeNames.has(name) && element.attrs.every(attribute=>browserChromeAttributes.has(attribute.name))
}
const foreignCdata=/^\[CDATA\[([\s\S]*)\]\]$/
function foreignCdataText(node:ParsedNode):string|undefined{
 if(node.nodeName!=="#comment"||!("data" in node)||!("parentNode" in node)||!node.parentNode||!isElement(node.parentNode)||node.parentNode.namespaceURI===html.NS.HTML)return undefined
 return foreignCdata.exec(node.data)?.[1]
}
function htmlCopy(source:string):string[]{
 const copy:string[]=[]
 const pending:ParsedNode[]=[parse(source,{scriptingEnabled:false})]
 for(let node=pending.pop();node;node=pending.pop()){
  if(node.nodeName==="#text"&&"value" in node)copy.push(node.value)
  const cdata=foreignCdataText(node)
  if(cdata!==undefined)copy.push(cdata)
  if(isElement(node)){
   if(!isBrowserChromeMeta(node))for(const attribute of node.attrs)if(copyAttributes.has(attribute.name))copy.push(attribute.value)
   if(inertElements.has(node.tagName))continue
   const frame=node.tagName==="iframe"?node.attrs.find(attribute=>attribute.name==="srcdoc"):undefined
   if(frame)pending.push(parse(frame.value,{scriptingEnabled:false}))
  }
  if("childNodes" in node)for(let index=node.childNodes.length-1;index>=0;index--)pending.push(node.childNodes[index]!)
 }
 return copy
}
export function publicCopy(source:string):string[]{
 return (source.includes("<") ? htmlCopy(source) : source.split("\n")).map(text=>text.replace(/\s+/g," ").trim()).filter(Boolean)
}
export function releaseClaimHits(source:string,claims:readonly PublicClaim[]=[],capabilities=""):string[]{
 const registered=new Set(claims.filter(claim=>claim.id && (claim.kind==="external-passed" ? passedExternalClaim(claim,capabilities) : claim.kind==="proven" ? /^P0[1-9]\/report\.md$/.test(claim.receipt) : /^X0[1-6]$/.test(claim.gate) && /pending|not yet|await|not available|unverified|blocked/i.test(claim.text))).map(claim=>claim.text))
 return [...retiredRouteHits(source),...publicCopy(source).filter(text=>!registered.has(text)).map(text=>`unregistered-public-copy:${text}`)]
}

export function publicAmountHits(source:string):string[]{
 return publicCopy(source).filter(text=>/\$\s*\d|\b\d[\d,]*(?:\.\d+)?\s*(?:units?|credits?|dollars?|cents?)\b/i.test(text)).map(text=>`hardcoded-public-amount:${text}`)
}

export function retiredRouteHits(source: string): string[] {
  return [/href=["'](?:[^"']*\/)?(?:share|present)(?:[/?"'])/i,/>\s*(?:Share|Present)\s*</i,/["']\/(?:share|present)(?:\/|["'])/i,/fake drafting|coming soon/i].filter(pattern=>pattern.test(source)).map(pattern=>`unsupported-release-claim:${pattern.source}`)
}

export function sandboxDependencyHits(file: string, source: string): string[] {
  if (!file.replaceAll("\\", "/").includes("bench/release/")) return []
  return /symlink\s*\([^\n;]*["']node_modules["']/.test(source)
    ? ["sandbox-dependencies-outside-root: copy dependencies inside the archived sandbox root"]
    : []
}

export function productCaptureHits(file: string, source: string): string[] {
  if (!file.replaceAll("\\", "/").endsWith("bench/release/product-review.mjs")) return []
  const before = source.indexOf("review/studio-before.png")
  return before >= 0 && !source.slice(0, before).includes('textContent.includes("Saved")')
    ? ["product-capture-before-ready: wait for the saved deck before capturing its initial state"]
    : []
}
