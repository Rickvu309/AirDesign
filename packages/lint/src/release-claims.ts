export type ExternalGate = "X01" | "X02" | "X03" | "X04" | "X05" | "X06"
export type PublicClaim = {id:string;text:string} & ({kind:"proven";receipt:string}|{kind:"external-passed";gate:ExternalGate;receipt:string}|{kind:"blocked";gate:string})
export function passedExternalClaim(claim:Extract<PublicClaim,{kind:"external-passed"}>,capabilities:string):boolean {
 const receipt=`P09/external/${claim.gate}/results/report.md`
 return claim.receipt===receipt && capabilities.split("\n").some(line=>{
  const cells=line.split("|").map(cell=>cell.trim())
  return cells[1]===claim.gate && cells[2]==="passed" && cells[3]===receipt
 })
}
export function publicCopy(source:string):string[]{
 const clean=source.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,"")
 const texts=clean.includes("<") ? [...clean.matchAll(/>([^<>]+)</g)].map(match=>match[1]!) : clean.split("\n")
 const copyBearing=clean.replace(/<meta\b[^>]*\bname="(?:viewport|theme-color)"[^>]*>/gi,"")
 const attributes=[...copyBearing.matchAll(/(?:alt|aria-label|content)="([^"]+)"/g)].map(match=>match[1]!)
 return [...texts,...attributes].map(text=>text.replace(/&amp;/g,"&").replace(/&gt;/g,">").replace(/&lt;/g,"<").replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g," ").trim()).filter(Boolean)
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
