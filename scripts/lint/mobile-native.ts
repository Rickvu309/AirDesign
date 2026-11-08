type Hit = {line:number;reason:string}
type Rule = {selector:string;body:string;fineHover:boolean;offset:number}

function fineHoverMedia(selector:string):boolean{
  const query=selector.replace(/^@media\s*/i,"").replace(/^(?:only\s+)?(?:screen|all)\s+and\s+/i,"")
  if(!/^(?:\([^()]+\)\s*and\s*)+\([^()]+\)$/i.test(query))return false
  const terms=[...query.matchAll(/\([^()]+\)/g)].map(match=>match[0])
  return terms.some(term=>/^\(\s*hover\s*:\s*hover\s*\)$/i.test(term))&&terms.some(term=>/^\(\s*pointer\s*:\s*fine\s*\)$/i.test(term))
}

function cssRules(source:string):Rule[]{
  const rules:Rule[]=[]
  function walk(start:number,end:number,fineHover:boolean):string{
    const pattern=/([^{}]+)\{/g
    pattern.lastIndex=start
    let cursor=start,body="",match:RegExpExecArray|null
    while((match=pattern.exec(source))&&match.index<end){
      const open=pattern.lastIndex
      let depth=1,close=open
      while(close<end&&depth){if(source[close]==="{")depth++;if(source[close]==="}")depth--;close++}
      const header=match[1]
      if(header===undefined)throw new Error("missing-css-rule-header")
      const headerStart=match.index+header.lastIndexOf(";")+1
      body+=source.slice(cursor,headerStart)
      const selector=source.slice(headerStart,open-1).trim()
      const guarded=fineHover||(/^@media\b/i.test(selector)&&fineHoverMedia(selector))
      const declarations=walk(open,close-1,guarded)
      if(!selector.startsWith("@"))rules.push({selector,body:declarations,fineHover:guarded,offset:headerStart})
      cursor=close
      pattern.lastIndex=close
    }
    return body+source.slice(cursor,end)
  }
  walk(0,source.length,false)
  return rules
}

export function mobileNativeHits(file:string,source:string):Hit[]{
  if(!/(?:apps\/(?:site|studio)\/|packages\/ui\/)/.test(file))return []
  const hits:Hit[]=[]
  const hit=(offset:number,reason:string)=>hits.push({line:source.slice(0,offset).split("\n").length,reason})
  if(file.endsWith(".html")){
    const metas=[...source.matchAll(/<meta\b[^>]*>/gi)].map(match=>match[0])
    const viewport=metas.find(meta=>/name=["']viewport["']/i.test(meta)) ?? ""
    if(/user-scalable\s*=\s*no|maximum-scale/i.test(viewport))hit(0,"mobile-viewport-must-allow-zoom")
    const themes=metas.filter(meta=>/name=["']theme-color["']/i.test(meta))
    const scheme=metas.find(meta=>/name=["']color-scheme["']/i.test(meta)) ?? ""
    if(!themes.length||!scheme||(/dark/.test(scheme)&&!["light","dark"].every(mode=>themes.some(meta=>meta.includes("prefers-color-scheme: "+mode)))))hit(0,"mobile-entry-needs-theme-color-and-color-scheme")
  }
  if(!file.endsWith(".css"))return hits
  const rules=cssRules(source)
  for(const rule of rules){
    if(/:hover\b/i.test(rule.selector)&&!rule.fineHover)hit(rule.offset,"mobile-hover-needs-fine-hover-media")
    const declarations=rule.body.split(";").map(value=>value.trim()).filter(Boolean)
    for(const [index,declaration] of declarations.entries()){
      if(!/\b100vh\b/i.test(declaration))continue
      const fallback=declaration.match(/^(height|min-height|max-height)\s*:\s*100vh\s*(!important)?$/i)
      const next=declarations[index+1] ?? ""
      const replacement=fallback&&new RegExp("^"+fallback[1]+"\\s*:\\s*100[ds]vh\\s*"+(fallback[2]?"!important":"")+"$","i")
      if(!replacement||!replacement.test(next))hit(rule.offset,"mobile-height-use-dvh-or-svh")
    }
  }
  if(/(?:apps\/site\/src\/site|apps\/studio\/src\/mobile)\.css$/.test(file)){
    const root=rules.filter(rule=>rule.selector.split(",").some(selector=>["html",":root"].includes(selector.trim()))).map(rule=>rule.body).join(";")
    const siteLinks=file.endsWith("apps/site/src/site.css")&&rules.some(rule=>["a","summary"].every(selector=>rule.selector.split(",").map(value=>value.trim()).includes(selector))&&/-webkit-tap-highlight-color\s*:\s*transparent/.test(rule.body)&&/touch-action\s*:\s*manipulation/.test(rule.body))
    if(!/-webkit-tap-highlight-color\s*:\s*transparent/.test(root)&&!siteLinks)hit(0,"mobile-root-needs-transparent-tap-highlight")
    if(!/-webkit-text-size-adjust\s*:\s*100%/.test(root))hit(0,"mobile-root-needs-text-size-adjust")
  }
  return hits
}
