import assert from "node:assert/strict"
import {createServer} from "node:http"
import {once} from "node:events"
import {readFile,mkdir,writeFile,rm} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {scenario,execute} from "../../bench/agent-account/fixture.mjs"
import {verifyLive} from "./verify-live.mjs"

const root=path.join(os.homedir(),"tmp/airdesign-live-verify/local-"+Date.now()),sha=(await execute("git",["rev-parse","HEAD"])).stdout.trim()
await mkdir(root,{recursive:true})
let broken=false,stack,site
try{
  stack=await scenario({browserEnabled:true,exposeInbox:false,realtime:true})
  await execute(process.execPath,["node_modules/vite/bin/vite.js","build","apps/site","--outDir",path.join(root,"site")],{env:{...process.env,AIRDESIGN_STUDIO_ORIGIN:stack.origin},maxBuffer:1000000})
  const siteRoot=path.join(root,"site")
  site=createServer(async(request,response)=>{
    try{
      const url=new URL(request.url,"http://localhost"),filename=path.resolve(siteRoot,"."+url.pathname+(url.pathname.endsWith("/") ? "index.html" : ""))
      if(!filename.startsWith(siteRoot+path.sep))throw new Error("invalid-path")
      let body=await readFile(filename)
      if(broken && url.pathname==="/")body=Buffer.from(body.toString().replace("</body>",'<a href="/deliberately-broken-link">Broken link proof</a></body>'))
      response.writeHead(200,{"content-type":({".html":"text/html",".css":"text/css",".js":"text/javascript",".json":"application/json"})[path.extname(filename)] ?? "application/octet-stream","x-content-type-options":"nosniff","referrer-policy":"no-referrer","cache-control":url.pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-store"});response.end(body)
    }catch{response.writeHead(404);response.end("not found")}
  }).listen(0,"127.0.0.1");await once(site,"listening")
  const base={sha,site:`http://127.0.0.1:${site.address().port}`,studio:stack.origin,mcp:stack.origin,email:"live-smoke@example.com",signInLink:async()=>{
    const result=await execute(process.execPath,["apps/server/src/smoke/mint-link.ts","live-smoke@example.com"],{env:{...process.env,AIRDESIGN_DATABASE_URL:stack.fixture.url,AIRDESIGN_SECRET:"dev-only-secret-change-me-32chars",AIRDESIGN_PUBLIC_ORIGIN:stack.origin,AIRDESIGN_SMOKE_EMAILS:"live-smoke@example.com"},maxBuffer:8192});return result.stdout.trim()
  },runWorker:async()=>{await execute(process.execPath,["apps/worker/src/main.ts"],{env:{...process.env,AIRDESIGN_WORKER_API_ORIGIN:"",AIRDESIGN_DATABASE_URL:stack.fixture.url,AIRDESIGN_OPERATIONS_PATH:stack.fixture.operationsPath,AIRDESIGN_WORKER_TEMP:path.join(root,"worker")},timeout:120000,maxBuffer:1000000})}}
  const wrong=await verifyLive({...base,sha:"0".repeat(40),output:path.join(root,"wrong-sha")});assert.equal(wrong.status,"fail");assert.equal(wrong.failedStep,"site-build-identity")
  broken=true
  const bad=await verifyLive({...base,output:path.join(root,"broken-link")});assert.equal(bad.status,"fail");assert.equal(bad.failedStep,"site-page:/");assert.match(bad.error,/broken link/)
  broken=false
  const studioFailure=await verifyLive({...base,output:path.join(root,"studio-error"),configureContext:async context=>context.addInitScript(({origin})=>{if(location.origin===origin)throw new Error("deliberate-studio-script-error")},{origin:stack.origin})});assert.equal(studioFailure.status,"fail");assert.equal(studioFailure.failedStep,"studio-sign-in");assert.match(studioFailure.error,/deliberate-studio-script-error/)
  const mismatch=await verifyLive({...base,output:path.join(root,"stale-worker"),configureContext:async context=>context.route("**/api/operations/*",async route=>{
    if(route.request().method()!=="GET"){await route.continue();return}
    const response=await route.fetch(),operation=await response.json()
    if(operation.kind==="ready")operation.report={...operation.report,workerSha:"f".repeat(40)}
    await route.fulfill({response,json:operation})
  })});assert.equal(mismatch.status,"fail");assert.equal(mismatch.failedStep,"import-powerpoint");assert.match(mismatch.error,/worker commit/)
  const passed=await verifyLive({...base,output:path.join(root,"pass")});assert.equal(passed.status,"pass",passed.failedStep+": "+passed.error)
  await writeFile(path.join(root,"proof.json"),JSON.stringify({sha,status:"pass",wrongSha:wrong.failedStep,brokenLink:bad.failedStep,studioError:studioFailure.failedStep,staleWorker:mismatch.failedStep,pass:path.join(root,"pass/receipt.json")},null,2))
  process.stdout.write(`pass: ${root}/proof.json\n`)
}finally{
  if(site){site.closeAllConnections();await new Promise(resolve=>site.close(resolve))}
  if(stack)await stack.close()
  await rm(path.join(root,"worker"),{recursive:true,force:true})
  await rm(path.join(root,"site"),{recursive:true,force:true})
}
