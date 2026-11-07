import assert from "node:assert/strict"
import {createServer} from "node:http"
import {mkdir,mkdtemp,readFile,writeFile,rm} from "node:fs/promises"
import {once} from "node:events"
import path from "node:path"
import os from "node:os"
import {test} from "node:test"
import {verifyLive} from "../../scripts/live/verify-live.mjs"

const sha="8c7ed928b02cfc8d40fc1bc38cd225851556aae2"
const image=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="green"/></svg>')
const fixture=`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/assets/fixture-12345678.css"></head><body><h1>Responsive picture</h1><a href="/">Home</a><picture><source media="(max-width: 899.98px)" srcset="/phone.svg"><img src="/desktop.svg" width="100" height="100"></picture></body></html>`

for(const mode of ["capture","screenshot-error","request-failure"]){
  test(mode,{timeout:20000},async()=>{
    const temporary=await mkdtemp(path.join(os.homedir(),"tmp/picture-shot-"))
    const output=process.env.PICTURE_SHOT_EVIDENCE ? path.join(process.env.PICTURE_SHOT_EVIDENCE,mode) : temporary
    await mkdir(output,{recursive:true})
    let origin,page,viewport,screenshotViewport,events=[],failures=[],phoneRequests=0
    const server=createServer((request,response)=>{
      const route=new URL(request.url,"http://localhost").pathname
      response.setHeader("x-content-type-options","nosniff")
      response.setHeader("referrer-policy","no-referrer")
      if(route==="/version.json" || route==="/version"){
        response.setHeader("content-type","application/json")
        response.end(JSON.stringify({sha,builtAt:new Date().toISOString()}))
      }else if(route==="/.well-known/oauth-protected-resource"){
        response.setHeader("content-type","application/json")
        response.end(JSON.stringify({resource:origin+"/mcp",authorization_servers:[origin]}))
      }else if(route==="/mcp"){
        response.writeHead(401,{"www-authenticate":`Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`});response.end()
      }else if(route==="/api/dev/inbox"){
        response.writeHead(404);response.end()
      }else if(route==="/assets/fixture-12345678.css"){
        response.setHeader("content-type","text/css")
        response.setHeader("cache-control","public, max-age=31536000, immutable")
        response.end("html,body,h1{margin:0}body{height:3924px;background:linear-gradient(white,blue)}")
      }else if(route==="/phone.svg" || route==="/desktop.svg"){
        if(route==="/phone.svg")phoneRequests++
        response.setHeader("content-type","image/svg+xml");response.end(image)
      }else if(route==="/"){
        response.setHeader("content-type","text/html");response.end(fixture)
      }else{
        response.setHeader("content-type","text/html");response.end("<h1>End of screenshot fixture</h1><a href='/'>Home</a>")
      }
    })
    try{
      server.listen(0,"127.0.0.1");await once(server,"listening")
      const address=server.address();assert.ok(address && typeof address!=="string")
      origin=`http://127.0.0.1:${address.port}`
      const receipt=await verifyLive({sha,site:origin,studio:origin,mcp:origin,email:"fixture@example.com",output,
        configureContext:async context=>{
          await context.addInitScript(()=>{
            window.__pictureEvents=[]
            matchMedia("(max-width: 899.98px)").addEventListener("change",event=>window.__pictureEvents.push({matches:event.matches,width:innerWidth,height:innerHeight}))
          })
          await context.route("**/genuine-abort",route=>route.abort("aborted"))
          context.on("requestfailed",request=>failures.push({path:new URL(request.url()).pathname,error:request.failure()?.errorText}))
          context.on("page",opened=>{
            page=opened
            const screenshot=page.screenshot.bind(page)
            page.screenshot=async options=>{
              if(!String(options.path).endsWith("site-landing.png"))return screenshot(options)
              await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{window.__pictureEvents=[];resolve()}))))
              screenshotViewport=page.viewportSize()
              const result=await screenshot(options)
              events=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(window.__pictureEvents)))))
              await writeFile(path.join(output,"media-events.json"),JSON.stringify(events,null,2))
              if(mode==="screenshot-error")return screenshot({...options,path:path.join(options.path,"blocked.png")})
              if(mode==="request-failure"){
                const failed=page.waitForEvent("requestfailed",{predicate:request=>request.url().endsWith("/genuine-abort"),timeout:3000})
                await page.evaluate(()=>fetch("/genuine-abort").catch(()=>undefined))
                await failed
              }
              return result
            }
            page.on("close",()=>{viewport=page.viewportSize()})
          })
        }})
      const bytes=await readFile(path.join(output,"site-landing.png"))
      assert.equal(bytes.subarray(0,8).toString("hex"),"89504e470d0a1a0a")
      const png={width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)}
      assert.equal(png.width,1440);assert.equal(png.height,3924)
      assert.deepEqual(viewport,{width:1440,height:1000},"original viewport must be restored")
      await writeFile(path.join(output,"observed.json"),JSON.stringify({events,failures,phoneRequests,viewport,screenshotViewport,dimensions:{width:png.width,height:png.height}},null,2))
      assert.deepEqual(screenshotViewport,{width:1440,height:3924},"capture must use the document-height viewport")
      assert.deepEqual(events,[],"screenshot must not switch the narrow picture media query")
      assert.equal(phoneRequests,0,"screenshot must not request the narrow picture")
      if(mode==="capture"){
        assert.deepEqual(failures,[])
        assert.equal(receipt.steps.find(step=>step.name==="site-page:/")?.status,"pass")
        assert.equal(receipt.failedStep,"site-page:/pricing/")
      }else if(mode==="screenshot-error"){
        assert.equal(receipt.failedStep,"site-page:/")
        assert.match(receipt.error,/ENOTDIR/)
      }else{
        assert.equal(receipt.failedStep,"site-page:/")
        assert.ok(receipt.browserErrors.some(error=>error.kind==="request" && error.path==="/genuine-abort" && error.error.includes("ERR_ABORTED")))
        assert.ok(failures.some(failure=>failure.path==="/genuine-abort"))
      }
    }finally{
      server.closeAllConnections()
      await new Promise(resolve=>server.close(resolve))
      await rm(temporary,{recursive:true,force:true})
    }
  })
}
