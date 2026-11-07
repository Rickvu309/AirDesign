import assert from "node:assert/strict"
import {createServer} from "node:http"
import {readFile,stat} from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import {chromium} from "playwright"

const root=path.resolve("apps/site/dist")
const routes=["/","/pricing/","/agents/","/agents/claude/","/agents/codex/","/examples/","/status/"]
const widths=[320,390,768,900,1024,1180,1280,1440,1920]
const types={".html":"text/html",".css":"text/css",".js":"text/javascript",".png":"image/png",".svg":"image/svg+xml",".woff2":"font/woff2",".json":"application/json",".txt":"text/plain"}
const server=createServer(async(request,response)=>{
 const url=new URL(request.url,"http://site.local"),relative=url.pathname,file=path.resolve(root,"."+(relative.endsWith("/")?relative+"index.html":relative))
 if(!file.startsWith(root+path.sep)){response.writeHead(403);response.end();return}
 try{await stat(file);response.writeHead(200,{"content-type":types[path.extname(file)]??"application/octet-stream"});response.end(await readFile(file))}catch{response.writeHead(404);response.end()}
})
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve))
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
   if(route==="/"){
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
assert.deepEqual(overflows,[],`site pages wider than the viewport: ${JSON.stringify(overflows)}`)
console.log(JSON.stringify({siteWidths:"pass",routes:routes.length,widths,focusedCapture}))
