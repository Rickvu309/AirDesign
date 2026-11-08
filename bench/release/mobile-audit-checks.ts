export function mobileAuditFailures(viewportWidth:number){
  const hits:string[]=[]
  if(document.documentElement.scrollWidth>viewportWidth)hits.push("horizontal overflow: "+document.documentElement.scrollWidth)
  const modal=document.querySelector("dialog:modal")
  const visible=(element:Element)=>{const r=element.getBoundingClientRect(),s=getComputedStyle(element);return r.width>0&&r.height>0&&s.visibility!=="hidden"&&s.display!=="none"&&!element.closest("[inert]")&&(!modal||modal.contains(element))}
  const positions=[...document.querySelectorAll("*")].filter(element=>element.scrollHeight>element.clientHeight||element.scrollWidth>element.clientWidth).map(element=>({element,top:element.scrollTop,left:element.scrollLeft}))
  const scrollX=window.scrollX,scrollY=window.scrollY
  try{
  for(const element of document.querySelectorAll("input,textarea,select")){
   if(visible(element)&&parseFloat(getComputedStyle(element).fontSize)<16)hits.push("small input: "+(element.getAttribute("aria-label")||element.id||element.outerHTML.slice(0,100)))
  }
  for(const element of document.querySelectorAll("button,a,[role=button],summary")){
   if(!visible(element))continue
   element.scrollIntoView({block:"center",inline:"center",behavior:"instant"})
   const rect=element.getBoundingClientRect(),style=getComputedStyle(element)
   if(rect.bottom<=0||rect.top>=innerHeight||rect.right<=0||rect.left>=innerWidth)continue
   const label=element.textContent?.trim().slice(0,55)||element.getAttribute("aria-label")
   const left=(rect.left+rect.right)/2-22,top=(rect.top+rect.bottom)/2-22
   let tappable=true
   for(let x=0;x<44&&tappable;x++){
    for(let y=0;y<44;y++){
     const target=document.elementFromPoint(left+x+.5,top+y+.5)
     if(!target||!element.contains(target)){tappable=false;break}
    }
   }
   if(!tappable)hits.push("small target: "+label+" "+Math.round(rect.width)+"x"+Math.round(rect.height))
   if(style.touchAction!=="manipulation")hits.push("touch action: "+label)
  }
  for(const element of document.querySelectorAll("*")){
   const ownText=[...element.childNodes].some(node=>node.nodeType===Node.TEXT_NODE&&node.textContent?.trim())
   if(ownText&&visible(element)&&!element.closest("button,a,[role=button],summary,input,textarea,select,option,script,style")&&getComputedStyle(element).userSelect==="none")hits.push("unselectable content: "+element.textContent?.slice(0,50))
  }
  return hits
  }finally{
   for(const {element,top,left} of positions)element.scrollTo({top,left,behavior:"instant"})
   window.scrollTo({left:scrollX,top:scrollY,behavior:"instant"})
  }
 }
