import assert from "node:assert/strict"
import {createServer} from "node:http"
import {mkdir,readFile,stat,writeFile} from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import {chromium} from "playwright"

const root=path.resolve("apps/site/dist")
const routes=["/","/pricing/","/agents/","/agents/claude/","/agents/codex/","/examples/","/status/"]
const widths=[320,390,768,900,1024,1180,1280,1295,1296,1440,1920]
const contrastWidths=[390,1440]
const buttonStates=["normal","hover","press"]
const signatureButtons={"/":3,"/pricing/":2}
const types={".html":"text/html",".css":"text/css",".js":"text/javascript",".png":"image/png",".svg":"image/svg+xml",".woff2":"font/woff2",".json":"application/json",".txt":"text/plain"}
const server=createServer(async(request,response)=>{
 const url=new URL(request.url,"http://site.local"),relative=url.pathname,file=path.resolve(root,"."+(relative.endsWith("/")?relative+"index.html":relative))
 if(!file.startsWith(root+path.sep)){response.writeHead(403);response.end();return}
 try{await stat(file);response.writeHead(200,{"content-type":types[path.extname(file)]??"application/octet-stream"});response.end(await readFile(file))}catch{response.writeHead(404);response.end()}
})
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve))
const contrastEvidence=[]
const layoutEvidence=[]
const evidenceDirectory=process.env.SITE_EVIDENCE_DIR
if(evidenceDirectory)await mkdir(evidenceDirectory,{recursive:true})
const luminance=rgb=>rgb.map(channel=>channel/255).map(channel=>channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4).reduce((sum,channel,index)=>sum+channel*[.2126,.7152,.0722][index],0)
async function checkButtonContrast(page,route,width){
 const buttons=await page.locator(".button").all()
 assert.equal(buttons.length,signatureButtons[route],`${route} at ${width}px must render every signature button for the contrast check`)
 for(const [index,button] of buttons.entries()){
  await button.scrollIntoViewIfNeeded()
  for(const state of buttonStates){
   await page.mouse.move(0,0)
   if(state!=="normal")await button.hover()
   if(state==="press")await page.mouse.down()
   try{
    await button.evaluate(element=>Promise.all(element.getAnimations().map(animation=>animation.finished)))
    const label=await button.evaluate(element=>{
     const style=getComputedStyle(element),range=document.createRange()
     range.selectNodeContents(element)
     const text=range.getBoundingClientRect(),box=element.getBoundingClientRect()
     return {x:text.x-box.x,y:text.y-box.y,width:text.width,height:text.height,color:style.color,filter:style.filter,opacity:style.opacity,hover:element.matches(":hover"),active:element.matches(":active")}
    })
    assert.equal(label.opacity,"1",`${route} button ${index} ${state} must keep opaque text`)
    if(state==="press")assert.ok(label.active,"press state must be activated")
    if(state==="hover"&&width===1440)assert.notEqual(label.filter,"none","fine-pointer hover must be activated")
    if(evidenceDirectory&&index===0)await button.screenshot({path:path.join(evidenceDirectory,`button-${route==="/"?"landing":"pricing"}-${width}-${state}.png`)})
    const foreground=label.color.match(/[\d.]+/g).slice(0,3).map(Number)
    const brightness=label.filter.match(/brightness\(([\d.]+)\)/)
    const textLuminance=luminance(foreground.map(channel=>channel*(brightness?Number(brightness[1]):1)))
    await button.evaluate(element=>element.style.setProperty("color","transparent","important"))
    let painted
    try{painted=await sharp(await button.screenshot()).removeAlpha().raw().toBuffer({resolveWithObject:true})}
    finally{await button.evaluate(element=>element.style.removeProperty("color"))}
    let minimum=Infinity
    for(let y=Math.ceil(label.y);y<Math.floor(label.y+label.height);y++){
     for(let x=Math.ceil(label.x);x<Math.floor(label.x+label.width);x++){
      const offset=(y*painted.info.width+x)*painted.info.channels
      const background=luminance([...painted.data.subarray(offset,offset+3)])
      minimum=Math.min(minimum,(Math.max(textLuminance,background)+.05)/(Math.min(textLuminance,background)+.05))
     }
    }
    contrastEvidence.push({route,width,index,state,minimum})
    assert.ok(Number.isFinite(minimum)&&minimum>=4.5,`${route} ${width}px button ${index} ${state} rendered label contrast ${minimum.toFixed(3)}:1 is below 4.5:1`)
   }finally{await page.mouse.move(0,0);await page.mouse.up()}
  }
 }
}
let focusedCapture=false
const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch(),overflows=[]
try{
 for(const width of widths){
  const page=await browser.newPage({viewport:{width,height:width===390?844:900},isMobile:width===390,hasTouch:width===390})
  for(const route of routes){
   const response=await page.goto(origin+route,{waitUntil:"load"})
   assert.equal(response?.status(),200,`${route} did not load`)
   await page.evaluate(()=>document.fonts.ready)
   const scrollWidth=await page.evaluate(()=>document.documentElement.scrollWidth)
   if(scrollWidth>width)overflows.push({route,width,scrollWidth})
   if(route in signatureButtons&&contrastWidths.includes(width))await checkButtonContrast(page,route,width)
   if(route in signatureButtons&&width===390){
    const smallTargets=await page.evaluate(()=>[...document.querySelectorAll("a[href],button,summary,[tabindex]:not([tabindex='-1'])")].map(element=>({element,box:element.getBoundingClientRect()})).filter(({element,box})=>element.checkVisibility()&&box.width>0&&box.bottom+scrollY>0).filter(({box})=>box.width<44||box.height<44).map(({element,box})=>`${element.textContent.trim()} ${box.width.toFixed(1)}x${box.height.toFixed(1)}`))
    assert.deepEqual(smallTargets,[],`${route} at 390px needs 44px tap targets on every control`)
   }
   if(route==="/"){
    const spacing=await page.evaluate(()=>{
     const section=document.querySelector(".product-section"),note=document.querySelector(".capture-note"),style=getComputedStyle(section)
     return {padding:parseFloat(style.paddingBlockEnd),gap:section.getBoundingClientRect().bottom-note.getBoundingClientRect().bottom}
    })
    layoutEvidence.push({width,...spacing})
    if(width>=900&&width<1296){
     assert.equal(spacing.padding,72,`tablet product padding at ${width}px`)
     assert.ok(Math.abs(spacing.gap-73)<=1,`tablet product section must end after its content at ${width}px: ${spacing.gap}`)
    }
    if(evidenceDirectory&&[390,1024,1440].includes(width)){
     await page.evaluate(()=>scrollTo(0,0))
     await page.screenshot({path:path.join(evidenceDirectory,`landing-${width}.png`),fullPage:true})
    }
    if(width===1440){
     for(const [selector,expected] of [[".studio-demo",{width:1248,height:784}],[".agent-pills a",{width:248,height:64}],[".agent-hub",{width:200,height:72}],[".chart-card",{width:480,height:270}],[".product-section",{height:1224}],[".agent-section",{height:840}],[".landing-pricing",{height:840}],["footer",{height:120}]]){
      const box=await page.locator(selector).first().boundingBox()
      for(const [dimension,value] of Object.entries(expected))assert.ok(Math.abs(box[dimension]-value)<=1,`S11.01 ${selector} ${dimension}: expected ${value}, received ${box[dimension]}`)
     }
     assert.equal(await page.locator(".studio-demo").evaluate(element=>getComputedStyle(element).boxShadow),await page.locator(".chart-card").evaluate(element=>getComputedStyle(element).boxShadow),"S11.01 both exhibit surfaces use the same outline and depth")
    }
    const milestone=await page.evaluate(()=>{
     const dot=document.querySelector(".chart-dot"),point=new DOMPoint(Number(dot.getAttribute("cx")),Number(dot.getAttribute("cy"))).matrixTransform(dot.getScreenCTM())
     const callout=document.querySelector(".chart-callout"),box=callout.getBoundingClientRect(),style=getComputedStyle(callout),line=getComputedStyle(callout,"::after")
     return {dx:Math.abs(box.x+parseFloat(style.borderLeftWidth)+parseFloat(line.left)-point.x),dy:Math.abs(box.y+parseFloat(style.borderTopWidth)+parseFloat(line.top)+parseFloat(line.height)-point.y)}
    })
    assert.ok(milestone.dx<=3&&milestone.dy<=3,`the milestone connector must meet its chart point at ${width}px: ${JSON.stringify(milestone)}`)
   }
   if(route==="/"&&width===390){
    const exhibit=page.getByRole("region",{name:"Slide 3 of the Halden investor deck"})
    await exhibit.scrollIntoViewIfNeeded()
    await page.locator("#product img").evaluate(async element=>{await element.decode();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})
    const painted=await sharp(await exhibit.screenshot()).removeAlpha().raw().toBuffer({resolveWithObject:true})
    let chartPixels=0
    for(let offset=0;offset<painted.data.length;offset+=painted.info.channels){
     const red=painted.data[offset],green=painted.data[offset+1],blue=painted.data[offset+2]
     if(red<80&&blue>red+30&&green>red+20)chartPixels++
    }
    assert.ok(chartPixels>1000,"the mobile frame must paint the captured chart rather than an empty surface")
    const image=await page.locator("#product img").evaluate(element=>({source:element.currentSrc,width:element.getBoundingClientRect().width,naturalWidth:element.naturalWidth}))
    assert.ok(image.source.endsWith("/studio-capture-mobile.png"),"phones must receive the focused Studio crop")
    assert.ok(image.width>=640&&image.naturalWidth>=image.width,"the captured slide must remain readable and sharp")
    const navigation=await page.locator("header").boundingBox()
    assert.ok(navigation.height<=140,"mobile navigation must keep both rows compact")
    for(const link of await page.locator("header a").all()){
     const box=await link.boundingBox()
     assert.ok(box.width>=44&&box.height>=44,`mobile navigation needs 44px tap targets: ${await link.textContent()} ${box.width}x${box.height}`)
    }
    await exhibit.focus()
    await page.keyboard.press("ArrowRight")
    await page.waitForFunction(()=>document.querySelector(".demo-workspace").scrollLeft>0)
    assert.ok(await exhibit.evaluate(element=>element.matches(":focus-visible")),"the keyboard scroll frame needs a visible focus ring")
    focusedCapture=true
   }
  }
  await page.close()
 }
}finally{await browser.close();server.close()}
assert.ok(focusedCapture,"focused capture check did not run")
const expectedContrastSamples=Object.values(signatureButtons).reduce((sum,count)=>sum+count,0)*buttonStates.length*contrastWidths.length
assert.equal(contrastEvidence.length,expectedContrastSamples,"every signature button state must be contrast checked")
assert.ok(contrastEvidence.every(item=>Number.isFinite(item.minimum)),"every contrast sample must be measured")
assert.deepEqual(overflows,[],`site pages wider than the viewport: ${JSON.stringify(overflows)}`)
if(evidenceDirectory)await writeFile(path.join(evidenceDirectory,"checks.json"),JSON.stringify({contrastEvidence,layoutEvidence},null,2))
console.log(JSON.stringify({contrastMinimum:Math.min(...contrastEvidence.map(item=>item.minimum)),contrastSamples:contrastEvidence.length,layoutEvidence,siteWidths:"pass",routes:routes.length,widths,focusedCapture}))
