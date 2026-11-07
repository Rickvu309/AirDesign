type Hit = {line:number;reason:string}
type Rule = {selector:string;body:string;media:string;offset:number}

function cssRules(source:string):Rule[]{
  const rules:Rule[]=[]
  function walk(start:number,end:number,media:string){
    const pattern=/([^{}]+)\{/g
    pattern.lastIndex=start
    let match:RegExpExecArray|null
    while((match=pattern.exec(source))&&match.index<end){
      const open=pattern.lastIndex
      let depth=1,close=open
      while(close<end&&depth){if(source[close]==="{")depth++;if(source[close]==="}")depth--;close++}
      const selector=match[1]!.trim()
      if(selector.startsWith("@"))walk(open,close-1,media+" "+selector)
      else rules.push({selector,body:source.slice(open,close-1),media,offset:match.index})
      pattern.lastIndex=close
    }
  }
  walk(0,source.length,"")
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
  const coarse=/\(pointer\s*:\s*coarse\)/
  const controls=["input","textarea","select"]
  const safeOverride=(control:string)=>rules.some(rule=>coarse.test(rule.media)&&rule.selector.split(",").some(selector=>new RegExp("(?:^|[\\s])"+control+"$").test(selector.trim()))&&/font-size\s*:\s*(?:1[6-9]|[2-9]\d)px/.test(rule.body))
  for(const rule of rules){
    if(/:hover\b/.test(rule.selector)&&!(/\(hover\s*:\s*hover\)/.test(rule.media)&&/\(pointer\s*:\s*fine\)/.test(rule.media)))hit(rule.offset,"mobile-hover-needs-fine-hover-media")
    if(/\b100vh\b/.test(rule.body))hit(rule.offset,"mobile-height-use-dvh-or-svh")
    const size=rule.body.match(/font-size\s*:\s*([\d.]+)(px|rem|em)\b/)
    if(size){
      const pixels=Number(size[1])*(size[2]==="px"?1:16)
      if(pixels<16&&controls.some(control=>new RegExp("(?:^|[\\s,>+~])"+control+"(?:$|[\\s,.#:\\[])").test(rule.selector)&&(!safeOverride(control)||coarse.test(rule.media))))hit(rule.offset,"mobile-input-needs-16px-or-coarse-override")
    }
  }
  if(/(?:apps\/site\/src\/site|apps\/studio\/src\/mobile)\.css$/.test(file)){
    const root=rules.filter(rule=>rule.selector.split(",").some(selector=>["html",":root"].includes(selector.trim()))).map(rule=>rule.body).join(";")
    if(!/-webkit-tap-highlight-color\s*:\s*transparent/.test(root))hit(0,"mobile-root-needs-transparent-tap-highlight")
    if(!/-webkit-text-size-adjust\s*:\s*100%/.test(root))hit(0,"mobile-root-needs-text-size-adjust")
  }
  return hits
}
