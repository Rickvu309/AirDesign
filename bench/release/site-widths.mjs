import assert from "node:assert/strict"
import {createServer} from "node:http"
import {readFile,stat} from "node:fs/promises"
import path from "node:path"
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
const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch(),overflows=[]
try{
 for(const width of widths){
  const page=await browser.newPage({viewport:{width,height:900}})
  for(const route of routes){
   const response=await page.goto(origin+route,{waitUntil:"load"})
   assert.equal(response?.status(),200,`${route} did not load`)
   await page.evaluate(()=>document.fonts.ready)
   const scrollWidth=await page.evaluate(()=>document.documentElement.scrollWidth)
   if(scrollWidth>width)overflows.push({route,width,scrollWidth})
  }
  await page.close()
 }
}finally{await browser.close();server.close()}
assert.deepEqual(overflows,[],`site pages wider than the viewport: ${JSON.stringify(overflows)}`)
console.log(JSON.stringify({siteWidths:"pass",routes:routes.length,widths}))
