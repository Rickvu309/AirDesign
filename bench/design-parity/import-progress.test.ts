import path from "node:path"
import {createHash} from "node:crypto"
import os from "node:os"
import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises"
import {spawn} from "node:child_process"
import {once} from "node:events"
import {build} from "vite"
import {chromium} from "playwright"
import {beforeAll,expect,it,vi} from "vitest"
import {createAccess,createMemoryInbox} from "@airdesign/access"
import {OperationStore,type OperationId} from "../../packages/operations/src/index.ts"
import {ImportProgressDecoder,acceptImportProgress} from "../../apps/worker/src/import-progress.ts"
import {forwardImportProgress} from "../../apps/worker/src/remote-queue.ts"
import {workerHandler} from "../../apps/server/src/worker/handle.ts"
import {operationsHandler} from "../../apps/server/src/operations/handle.ts"
import type {ImportSlideProgress} from "../../packages/operations/src/import-progress.ts"

let script="",styles=""
beforeAll(async()=>{
  const entry=path.resolve("virtual:import-progress-proof")
  const built=await build({configFile:false,logLevel:"silent",oxc:{jsx:{runtime:"automatic",development:false}},define:{"process.env.NODE_ENV":JSON.stringify("production")},resolve:{alias:{"@airdesign/ui":path.resolve("packages/ui/src/index.ts")}},plugins:[{name:"import-progress-proof",resolveId:source=>source===entry ? entry : undefined,load:source=>source===entry ? `import {createElement} from "react";import {createRoot} from "react-dom/client";import {ImportCard} from "${path.resolve("apps/studio/src/import/import-card.tsx")}";import {StudioShell} from "${path.resolve("apps/studio/src/shell/studio-shell.tsx")}";import "${path.resolve("apps/studio/src/editor/workspace.css")}";import "${path.resolve("apps/studio/src/decks/decks.css")}";import "${path.resolve("packages/ui/src/tokens/tokens.css")}";createRoot(document.getElementById("root")).render(createElement(StudioShell,{intentLabel:"",showIntent:false,onSignOut:()=>{},search:"",onSearch:()=>{},starredDecks:[]},createElement(ImportCard,{finished:async()=>{},openDeck:id=>{document.body.dataset.opened=id}})));` : undefined}],build:{write:false,minify:false,lib:{entry,formats:["iife"],name:"ImportRecoveryProof"}}})
  const outputs=(Array.isArray(built) ? built : [built]).flatMap(output=>"output" in output ? output.output : [])
  script=outputs.filter(output=>output.type==="chunk").map(output=>output.code).join("\n")
  styles=outputs.flatMap(output=>output.type==="asset"&&output.fileName.endsWith(".css") ? [typeof output.source==="string" ? output.source : new TextDecoder().decode(output.source)] : []).join("\n")
})


it("carries actual child slide work across two leases, authenticated handlers and the real ImportCard",async()=>{
  const origin="http://localhost:4179",secret="progress-internal-secret",root=await mkdtemp(path.join(os.homedir(),"tmp/progress-vertical-"))
  const local=new OperationStore(path.join(root,"local.sqlite")),remote=new OperationStore(path.join(root,"remote.sqlite")),images=new OperationStore(path.join(root,"images.sqlite"))
  const inbox=createMemoryInbox(),access=await createAccess({driver:{kind:"pglite"},secret:"progress-access-secret-at-least-thirty-two",clock:Date.now,mail:inbox,guard:{allow:()=>true},exposeInbox:false,publicOrigin:origin})
  const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors:string[]=[],sent:ImportSlideProgress[]=[]
  let child:ReturnType<typeof spawn>|undefined
  try{
    async function login(email:string){
      const post=(route:string,body:unknown)=>access.handle(new Request(origin+route,{method:"POST",headers:{"content-type":"application/json",origin},body:JSON.stringify(body)}))
      const intent=await (await post("/api/access/intent",{kind:"import"})).json()
      await post("/api/access/email",{email,intent:intent.token})
      const response=await post("/api/access/code",{email,intent:intent.token,code:inbox.read(email)[0]?.code})
      expect(response.status).toBe(200)
      const cookie=response.headers.getSetCookie().map(value=>value.split(";")[0]).join("; ")
      const principal=await access.principal(new Request(origin,{headers:{cookie}}))
      if(!principal)throw new Error("principal-required")
      return {cookie,principal}
    }
    const owner=await login("progress@vertical.example"),other=await login("other@vertical.example")
    const input=await readFile("fixtures/pptx/native.pptx"),job=remote.submit(owner.principal,"vertical",input),remoteClaim=remote.claim(job.id)
    if(!remoteClaim)throw new Error("remote-claim-required")
    const localOwner={personId:job.id},localJob=local.submit(localOwner,"vertical",input),localClaim=local.claim(localJob.id)
    if(!localClaim)throw new Error("local-claim-required")
    const worker=workerHandler(remote,images,secret,async()=>{},path.join(root,"artifacts")),status=operationsHandler(access,remote,origin)
    const command=(body:unknown,token=secret)=>worker(new Request(origin+"/internal/worker",{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify(body)}))
    const update=(value:unknown,lease=remoteClaim.lease)=>({kind:"progress",queue:"import",id:job.id,lease,progress:value})
    const one={kind:"import-slides",completed:1,total:2}
    expect((await command(update(one),"wrong")).status).toBe(401)
    expect((await command({...update(one),queue:"image"})).status).toBe(400)
    expect((await command(update({...one,completed:3}))).status).toBe(400)
    expect((await command(update(one,crypto.randomUUID()))).status).toBe(409)
    expect((await status(new Request(origin+`/api/operations/${job.id}`))).status).toBe(401)
    expect((await status(new Request(origin+`/api/operations/${job.id}`,{headers:{cookie:other.cookie}}))).status).toBe(404)
    expect((await status(new Request(origin+`/api/operations/${job.id}/progress`,{method:"POST",headers:{cookie:owner.cookie,origin,"content-type":"application/json"},body:JSON.stringify(one)}))).status).toBe(404)
    let completeForward:()=>void=()=>{},forwarded=new Promise<void>(resolve=>{completeForward=resolve})
    vi.stubGlobal("fetch",async(input:URL|RequestInfo,init?:RequestInit)=>{
      const request=new Request(input,init)
      expect(request.url).toBe(origin+"/internal/worker")
      const response=await worker(request)
      expect(response.status).toBe(200)
      completeForward()
      return response
    })
    const forward=forwardImportProgress({origin,secret,id:job.id,lease:remoteClaim.lease})
    page.setDefaultTimeout(4000)
    page.on("pageerror",error=>errors.push(error.message));page.on("requestfailed",request=>errors.push(String(request.failure()?.errorText)))
    const key=JSON.stringify(["import",owner.principal.personId])
    await page.addInitScript(({key,id})=>{if(!localStorage.getItem(key))localStorage.setItem(key,id);localStorage.setItem(key+"title","native")},{key,id:job.id})
    const kept:OperationId[]=[]
    await page.route(origin+"/**",async route=>{
      const request=route.request(),url=new URL(request.url())
      if(url.pathname==="/")return route.fulfill({contentType:"text/html",body:'<div id="root"></div>'})
      if(url.pathname==="/api/account")return route.fulfill({json:{status:"signed-in",personId:owner.principal.personId}})
      if(url.pathname==="/api/catalog/import"){kept.push(job.id);return route.fulfill({json:{entry:{id:"retained-real-import"}}})}
      const response=await status(new Request(request.url(),{method:request.method(),headers:{cookie:owner.cookie,origin,"content-type":"application/json"},body:request.method()==="GET" ? undefined : request.postData()}))
      await route.fulfill({status:response.status,body:await response.text(),headers:{"content-type":"application/json"}})
    })
    await page.goto(origin);await page.addStyleTag({content:styles});await page.addScriptTag({content:script})
    const card=page.locator(".import-card"),meter=card.getByRole("progressbar",{name:"Import progress",exact:true})
    await expect.poll(()=>meter.count()).toBe(1)
    expect(await meter.getAttribute("value")).toBeNull()
    await writeFile(path.join(root,"input.pptx"),input)
    const source=await readFile("apps/worker/src/import.ts","utf8")
    const instrumented='import {readSync} from "node:fs"\n'+source.replace(/from "(\.[^"]+)"/g,(_,relative:string)=>`from ${JSON.stringify(path.resolve("apps/worker/src",relative))}`).replace('value=>progress.publish({kind:"import-slides",...value})','value=>{progress.publish({kind:"import-slides",...value});readSync(0,Buffer.alloc(1),0,1,null)}')
    expect(instrumented).toContain("readSync(0,Buffer.alloc(1),0,1,null)")
    const program=path.join(root,"barrier-import.ts");await writeFile(program,instrumented)
    const observed:ImportSlideProgress[]=[]
    let nextFrame:()=>void=()=>{},frame=new Promise<void>(resolve=>{nextFrame=resolve})
    const decoder=new ImportProgressDecoder(value=>{
      observed.push(value)
      expect(acceptImportProgress(local,localJob.id,"obsolete",value,sentValue=>sent.push(sentValue))).toBe(false)
      expect(acceptImportProgress(local,localJob.id,localClaim.lease,value,sentValue=>{sent.push(sentValue);forward.publish(sentValue)})).toBe(true)
      nextFrame()
    })
    child=spawn(process.execPath,[program],{cwd:root,env:{...process.env,AIRDESIGN_JOB_DIRECTORY:root},stdio:["pipe","ignore","pipe"]})
    child.stderr?.on("data",(value:Buffer)=>decoder.push(value))
    const closed=once(child,"close")
    for(const completed of [0,1,2]){
      await frame;await forwarded
      expect(observed.at(-1)).toEqual({kind:"import-slides",completed,total:2})
      expect(remote.status(owner.principal,job.id)).toMatchObject({kind:"running",progress:{completed,total:2}})
      await expect.poll(()=>card.getByText(`${completed} of 2 slides`,{exact:true}).count()).toBe(1)
      expect(await meter.getAttribute("value")).toBe(String(completed));expect(await meter.getAttribute("max")).toBe("2")
      expect(await card.getByRole("button",{name:"Keep and open deck",exact:true}).count()).toBe(0)
      frame=new Promise<void>(resolve=>{nextFrame=resolve});forwarded=new Promise<void>(resolve=>{completeForward=resolve})
      child.stdin?.write("x")
    }
    expect((await closed)[0],decoder.diagnostics()).toBe(0);decoder.finish();await forward.close()
    const actualReport=JSON.parse(await readFile(path.join(root,"report.json"),"utf8")),result=await readFile(path.join(root,"result.pptx"))
    expect(actualReport.deck.slides).toHaveLength(2)
    expect(local.complete(localJob.id,localClaim.lease,result,actualReport)).toBe(true)
    expect(remote.complete(job.id,remoteClaim.lease,result,actualReport)).toBe(true)
    await expect.poll(()=>card.getByRole("button",{name:"Keep and open deck",exact:true}).count()).toBe(1)
    expect(await meter.count()).toBe(0)
    await card.getByText("Import details",{exact:true}).focus();await page.keyboard.press("Enter")
    expect(await card.locator("details pre").innerText()).toContain('"deck"')
    await card.getByRole("button",{name:"Keep and open deck",exact:true}).click()
    await expect.poll(()=>page.locator("body").getAttribute("data-opened")).toBe("retained-real-import")
    expect(kept).toEqual([job.id]);expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull()
    expect(sent).toEqual(observed);expect(errors).toEqual([])
    const delayed=remote.submit(owner.principal,"delayed",input),delayedClaim=remote.claim(delayed.id)
    if(!delayedClaim)throw new Error("claim-required")
    let release:()=>void=()=>{},arrive:()=>void=()=>{}
    const gate=new Promise<void>(resolve=>{release=resolve}),arrived=new Promise<void>(resolve=>{arrive=resolve})
    let lateStatus=0
    vi.stubGlobal("fetch",async(input:URL|RequestInfo,init?:RequestInit)=>{
      const request=new Request(input,init);arrive();await gate
      const response=await worker(request);lateStatus=response.status;return response
    })
    const late=forwardImportProgress({origin,secret,id:delayed.id,lease:delayedClaim.lease})
    late.publish({kind:"import-slides",completed:1,total:2});await arrived
    remote.cancel(owner.principal,delayed.id);release();await late.close()
    expect(lateStatus).toBe(409);expect(remote.status(owner.principal,delayed.id)).toMatchObject({kind:"cancelled"})
    expect(remote.status(owner.principal,delayed.id)).not.toHaveProperty("progress")
    const zero=remote.submit(owner.principal,"zero-total",input),zeroClaim=remote.claim(zero.id)
    if(!zeroClaim)throw new Error("claim-required")
    expect(remote.recordProgress(zero.id,zeroClaim.lease,{kind:"import-slides",completed:0,total:0})).toBe(true)
    await page.evaluate(({key,id})=>localStorage.setItem(key,id),{key,id:zero.id});await page.reload();await page.addStyleTag({content:styles});await page.addScriptTag({content:script})
    await expect.poll(()=>meter.count()).toBe(1)
    expect(await meter.getAttribute("value")).toBeNull()
    expect(await card.getByText("0 of 0 slides",{exact:true}).count()).toBe(0)
    await card.getByRole("button",{name:"Cancel import",exact:true}).focus();await page.keyboard.press("Enter")
    await expect.poll(()=>card.getByRole("status").innerText()).toBe("Import cancelled")
    expect(remote.status(owner.principal,zero.id).kind).toBe("cancelled")
    for(const terminal of ["failed","cancelled"]){
      const next=remote.submit(owner.principal,terminal,input),claim=remote.claim(next.id)
      if(!claim)throw new Error("claim-required")
      remote.recordProgress(next.id,claim.lease,{kind:"import-slides",completed:2,total:2})
      if(terminal==="failed")remote.fail(next.id,claim.lease,"actual-import-diagnostic")
      else remote.cancel(owner.principal,next.id)
      expect((await command({...update(one),id:next.id,lease:claim.lease})).status).toBe(409)
      await page.evaluate(({key,id})=>localStorage.setItem(key,id),{key,id:next.id});await page.reload();await page.addStyleTag({content:styles});await page.addScriptTag({content:script})
      await expect.poll(()=>card.getByRole("status").innerText()).toBe(terminal==="failed" ? "Unable to import" : "Import cancelled")
      expect(await meter.count()).toBe(0);expect(await card.getByRole("button",{name:"Keep and open deck",exact:true}).count()).toBe(0)
      if(terminal==="failed"){await card.getByText("Details",{exact:true}).focus();await page.keyboard.press("Enter");expect(await card.locator(".import-diagnostics pre").innerText()).toBe("actual-import-diagnostic")}
    }
    if(process.env.IMPORT_PROGRESS_PROOF){
      const hash=(value:string|Uint8Array)=>createHash("sha256").update(value).digest("hex")
      await writeFile(process.env.IMPORT_PROGRESS_PROOF,JSON.stringify({fixture:"fixtures/pptx/native.pptx",fixtureSha256:hash(input),sourceSha256:hash(source),instrumentedSourceSha256:hash(instrumented),observed,sent,resultSha256:hash(result),slideCount:actualReport.deck.slides.length,lateStatus,errors,boundary:"actual child with test-only stdin barrier; real SQLite and authenticated Request/Response handlers; controlled fetch/browser routing, not production TCP or durable deployment"},null,2))
    }
  }finally{
    child?.kill("SIGKILL");vi.unstubAllGlobals();await browser.close();await access.close();local.close();remote.close();images.close();await rm(root,{recursive:true,force:true})
  }
},30000)
