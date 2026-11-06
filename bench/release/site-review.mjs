import assert from "node:assert/strict"
import {mkdir,writeFile} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {preview} from "vite"
import {chromium} from "playwright"
import {execute,head} from "../agent-account/fixture.mjs"
const root=process.env.P09_EVIDENCE??path.join(os.homedir(),"tmp/airdesign-autopilot/P09"),directory=path.join(root,"review"),session=`p09-site-${process.pid}`,trace=[]
await mkdir(directory,{recursive:true})
const server=await preview({root:"apps/site",configFile:"apps/site/vite.config.ts",preview:{host:"127.0.0.1",port:0}}),origin=`http://127.0.0.1:${server.httpServer.address().port}`
async function browser(...args){const result=await execute("agent-browser",["--session",session,...args],{timeout:60000,maxBuffer:2*1024*1024});trace.push({args,stdout:result.stdout,stderr:result.stderr});return result.stdout}
const routes=["/","/pricing/","/agents/","/agents/claude/","/agents/codex/","/status/","/examples/"],rows=[]
const inspect=`(()=>{const rgb=value=>{const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');x.fillStyle=value;x.fillRect(0,0,1,1);return [...x.getImageData(0,0,1,1).data]};const lum=c=>c.slice(0,3).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);const bg=e=>{for(let n=e;n;n=n.parentElement){const v=rgb(getComputedStyle(n).backgroundColor);if(v[3]===255)return v}return [255,255,255,255]};const contrast=[...document.querySelectorAll('p,h1,h2,h3,li,a,small,figcaption,.eyebrow,.amount')].filter(e=>e.textContent.trim()).map(e=>{const s=getComputedStyle(e),a=lum(rgb(s.color)),b=lum(bg(e)),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700);return {text:e.textContent.trim().slice(0,60),ratio,required:large?3:4.5}});return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,links:[...document.querySelectorAll('a')].map(e=>({text:e.textContent,href:e.getAttribute('href')})),contrast,images:[...document.images].map(e=>({src:e.src,loaded:e.complete&&e.naturalWidth>0}))}})()`
let chrome
try{
 for(const route of routes)for(const width of [1440,320]){
  await browser("set","viewport",String(width),"960");await browser("open",origin+route);await browser("wait","--fn","document.fonts.status==='loaded'&&[...document.images].every(e=>e.complete)")
  const name=route==="/"?"landing":route.split("/").filter(Boolean).join("-"),result=JSON.parse(await browser("eval",inspect));assert.ok(result.scrollWidth<=width,`${route} overflow ${width}`);assert.ok(result.images.every(image=>image.loaded));assert.ok(result.contrast.every(row=>row.ratio>=row.required),JSON.stringify(result.contrast.filter(row=>row.ratio<row.required)))
  await browser("screenshot",path.join(directory,`${name}-${width}.png`),"--full");await writeFile(path.join(directory,`${name}-${width}.tree.txt`),await browser("snapshot","-i"))
  const focus=[]
  if(width===1440)for(let index=0;index<result.links.length;index++){
   await browser("press","Tab");const item=JSON.parse(await browser("eval","({tag:document.activeElement.tagName,href:document.activeElement.getAttribute('href'),outline:getComputedStyle(document.activeElement).outlineStyle,width:getComputedStyle(document.activeElement).outlineWidth,visible:document.activeElement.matches(':focus-visible')})"));assert.equal(item.tag,"A");assert.equal(item.visible,true);assert.notEqual(item.outline,"none");assert.notEqual(item.width,"0px");focus.push(item)
  }
  rows.push({route,width,...result,focus})
 }
 await writeFile(path.join(directory,"site.json"),JSON.stringify({head,status:"pass",browser:"agent-browser CLI, actual Chrome",origin,rows,trace},null,2))
 chrome=await chromium.launch();const samples=[],profile={viewport:{width:390,height:844},deviceScaleFactor:1,latencyMs:150,downloadBytesPerSecond:200000,uploadBytesPerSecond:93750,cpuSlowdown:4}
 const warm=await chrome.newContext({viewport:profile.viewport,deviceScaleFactor:1})
 for(let index=0;index<25;index++){
  const context=index<5?await chrome.newContext({viewport:profile.viewport,deviceScaleFactor:1}):warm,page=await context.newPage(),cdp=await context.newCDPSession(page)
  await cdp.send("Network.enable");await cdp.send("Network.emulateNetworkConditions",{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});await cdp.send("Emulation.setCPUThrottlingRate",{rate:4})
  await page.addInitScript(()=>{window.releaseLcp=0;new PerformanceObserver(list=>{for(const entry of list.getEntries())window.releaseLcp=entry.startTime}).observe({type:"largest-contentful-paint",buffered:true})})
  await page.goto(origin,{waitUntil:"networkidle"});await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  const value=await page.evaluate(()=>({lcpMs:window.releaseLcp,title:document.querySelector("h1").textContent,overflow:document.documentElement.scrollWidth>innerWidth}));assert.ok(value.lcpMs>0);assert.equal(value.overflow,false);samples.push({trial:index,cache:index<5?"cold":"warm",...value});await page.close();if(index<5)await context.close()
 }
 await warm.close();const worstMs=Math.max(...samples.map(row=>row.lcpMs)),perf={head,status:worstMs<=2500?"pass":"fail",profile,browser:await chrome.version(),trials:samples,budgetMs:2500,researchTargetMs:1000,worstMs,researchTargetMet:worstMs<=1000,scope:"local built site, throttled Chrome; no public CDN claim",baseline:"site absent on trunk; absolute budget only"}
 await mkdir(path.join(root,"perf"),{recursive:true});await writeFile(path.join(root,"perf/site.json"),JSON.stringify(perf,null,2));assert.ok(worstMs<=2500,`LCP ${worstMs}`);console.log(JSON.stringify({head,site:"pass",pages:routes.length,viewports:[1440,320],lcpWorstMs:worstMs}))
}finally{if(chrome)await chrome.close();await browser("close").catch(()=>undefined);await new Promise(resolve=>server.httpServer.close(resolve))}
