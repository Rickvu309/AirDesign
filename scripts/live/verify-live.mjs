import assert from "node:assert/strict"
import {mkdir,writeFile,readFile} from "node:fs/promises"
import {execFile} from "node:child_process"
import {promisify} from "node:util"
import {parseArgs} from "node:util"
import path from "node:path"
import os from "node:os"
import {pathToFileURL} from "node:url"
import {chromium,expect} from "playwright/test"
import {getDocument} from "pdfjs-dist/legacy/build/pdf.mjs"
import {importPptx} from "../../packages/pptx/src/index.ts"
import {libreOfficeFastCheck} from "../../packages/pptx/test/libreoffice.ts"
import {retiredRouteHits} from "../../packages/lint/src/release-claims.ts"
import {validateMcpMetadata} from "./mcp-metadata.ts"
import {checkWorkerIdentity} from "./worker-identity.ts"
import {railwaySshArguments,railwayTarget} from "./railway-ssh-arguments.ts"
import {classifyPageAssets} from "./site-assets.ts"

export const sitePages=["/","/pricing/","/examples/","/agents/","/agents/claude/","/agents/codex/","/status/"]
export async function checkIdentity(base,route,sha){
  const response=await fetch(new URL(route,base),{cache:"no-store",signal:AbortSignal.timeout(15000)})
  assert.equal(response.status,200,"version endpoint must return 200")
  const value=await response.json()
  assert.equal(value.sha,sha,"deployed commit does not match --expect-sha")
  assert.ok(Number.isFinite(Date.parse(value.builtAt)),"build time missing")
  return value
}
export async function auditLinks(page,base){
  const links=await page.locator("a[href]").evaluateAll(nodes=>nodes.map(node=>node.href))
  const checked=[]
  for(const href of new Set(links)){
    const url=new URL(href)
    if(!["http:","https:"].includes(url.protocol))continue
    assert.equal(retiredRouteHits(`href="${href}"`).length,0,"retired route linked")
    url.hash=""
    const response=await fetch(url,{signal:AbortSignal.timeout(20000)})
    assert.ok(response.ok,`broken link ${url.origin}${url.pathname}: ${response.status}`)
    checked.push({url:url.origin+url.pathname,status:response.status})
  }
  assert.ok(checked.length,`no links found on ${base}`)
  return checked
}
async function auditAssets(page){
  const urls=await page.locator('script[src],link[rel="stylesheet"][href]').evaluateAll(nodes=>nodes.map(node=>node.src || node.href))
  urls.push(...await page.evaluate(()=>performance.getEntriesByType("resource").map(entry=>entry.name).filter(name=>new URL(name).pathname.startsWith("/assets/"))))
  const assets=classifyPageAssets(urls)
  assert.deepEqual(assets.unhashed,[],`asset must have content hash: ${assets.unhashed.join(", ")}`)
  assert.ok(assets.built.length,"page must load built assets")
  for(const asset of assets.built){
    const response=await fetch(asset,{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200)
    assert.match(response.headers.get("cache-control") ?? "",/immutable/,"static asset missing immutable cache")
  }
  return {built:assets.built.map(asset=>new URL(asset).pathname),platform:assets.platform}
}
function safeError(error){return String(error?.message ?? error).replace(/https?:\/\/[^\s"']+/g,value=>{try{const url=new URL(value);return url.origin+url.pathname}catch{return "[url]"}}).replace(/token[=:][^\s&]+/gi,"token=[redacted]").slice(0,1500)}
export async function verifyLive(options){
  const {sha,site,studio,mcp,email,signInLink,output}=options
  await mkdir(output,{recursive:true,mode:0o700})
  const receipt={expectedSha:sha,startedAt:new Date().toISOString(),origins:{site,studio,mcp},status:"running",allowedBrowserExceptions:[],steps:[]}
  const created=[],paidCalls=[],browserErrors=[]
  let current="configuration",browser,context,page,signedSmoke=false
  async function step(name,run){current=name;const started=Date.now();try{const evidence=await run();assert.deepEqual(browserErrors,[],"browser errors");receipt.steps.push({name,status:"pass",durationMs:Date.now()-started,...evidence===undefined ? {} : {evidence}})}catch(error){receipt.steps.push({name,status:"fail",error:safeError(error)});throw error}}
  async function shot(name){const file=name+".png";await page.screenshot({path:path.join(output,file),fullPage:true});return file}
  try{
    assert.match(sha,/^[a-f0-9]{40}$/,"--expect-sha must be a full commit sha")
    assert.ok(email,"--smoke-email required")
    for(const origin of [site,studio,mcp]){const url=new URL(origin);assert.equal(url.origin,origin,"base URLs must be origins");assert.ok(url.protocol==="https:"||["127.0.0.1","localhost"].includes(url.hostname),"HTTP allowed only on loopback")}
    await step("site-build-identity",()=>checkIdentity(site,"/version.json",sha))
    await step("studio-build-identity",()=>checkIdentity(studio,"/version",sha))
    await step("health-and-access-boundaries",async()=>{
      assert.equal((await fetch(studio+"/healthz",{signal:AbortSignal.timeout(15000)})).status,200)
      const metadata=await fetch(mcp+"/.well-known/oauth-protected-resource",{signal:AbortSignal.timeout(15000)});assert.equal(metadata.status,200)
      validateMcpMetadata(await metadata.json(),studio,mcp)
      const unauthorized=await fetch(mcp+"/mcp",{signal:AbortSignal.timeout(15000),method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"initialize",params:{}})})
      assert.equal(unauthorized.status,401);assert.equal(unauthorized.headers.get("www-authenticate"),`Bearer resource_metadata="${mcp}/.well-known/oauth-protected-resource/mcp"`)
      assert.equal((await fetch(studio+"/api/dev/inbox?to=smoke@example.com",{signal:AbortSignal.timeout(15000)})).status,404,"production inbox exposed")
      for(const base of [site,studio,mcp]){const response=await fetch(base+(base===mcp ? "/.well-known/oauth-protected-resource" : "/"),{signal:AbortSignal.timeout(15000)});assert.equal(response.headers.get("x-content-type-options"),"nosniff");assert.equal(response.headers.get("referrer-policy"),"no-referrer");if(base.startsWith("https:"))assert.match(response.headers.get("strict-transport-security") ?? "",/max-age=[1-9]\d*/)}
    })
    browser=await chromium.launch({headless:true,...process.env.AIRDESIGN_CHROME_PATH ? {executablePath:process.env.AIRDESIGN_CHROME_PATH} : {}})
    context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true})
    await context.route("**/api/aira**",async route=>{if(route.request().method()==="POST"){paidCalls.push(route.request().method());await route.abort("blockedbyclient");return}await route.continue()})
    await options.configureContext?.(context)
    context.on("page",opened=>{
      opened.on("pageerror",error=>browserErrors.push({kind:"script",error:safeError(error)}))
      opened.on("console",message=>{if(message.type()==="error")browserErrors.push({kind:"console",error:safeError(message.text())})})
    })
    context.on("requestfailed",request=>browserErrors.push({kind:"request",path:new URL(request.url()).pathname,error:safeError(request.failure()?.errorText)}))
    context.on("response",response=>{if(response.status()>=400)browserErrors.push({kind:"http",status:response.status(),path:new URL(response.url()).pathname})})
    page=await context.newPage()
    for(const route of sitePages)await step("site-page:"+route,async()=>{
        const response=await page.goto(site+route,{waitUntil:"networkidle"});assert.equal(response.status(),200)
        await expect(page.locator("h1")).toBeVisible()
        await page.locator("img").evaluateAll(nodes=>Promise.all(nodes.map(image=>{image.loading="eager";return image.decode()})))
        const links=await auditLinks(page,site)
        const assets=await auditAssets(page)
        const screenshot=await shot("site"+(route==="/" ? "-landing" : route.replaceAll("/","-")))
        return {links,assets,screenshot}
    })
    await step("studio-sign-in",async()=>{await page.goto(studio);await expect(page.getByRole("textbox",{name:/email/i})).toBeVisible();return {assets:await auditAssets(page),screenshot:await shot("studio-sign-in")}})
    await step("smoke-sign-in",async()=>{
      const link=new URL(await signInLink());assert.equal(link.origin,studio);assert.equal(link.pathname,"/access/link");assert.ok(link.searchParams.get("token"))
      await page.goto(link.href);await page.getByRole("button",{name:"+ New deck",exact:true}).waitFor()
      const response=await context.request.get(studio+"/api/account"),account=await response.json()
      assert.equal(account.email?.toLowerCase(),email.toLowerCase(),"authenticated account must be the smoke account")
      for(const trash of [false,true]){const response=await context.request.get(studio+"/api/catalog?trash="+trash);assert.ok(response.ok());assert.equal((await response.json()).length,0,"dedicated smoke account must start empty")}
      signedSmoke=true
      return {screenshot:await shot("smoke-home")}
    })
    await step("create-deck-and-aira-entry",async()=>{
      await page.getByRole("button",{name:"+ New deck",exact:true}).click();await page.getByRole("button",{name:"Blank deck",exact:true}).click()
      await page.waitForURL(/\/deck\//);created.push(new URL(page.url()).pathname.split("/").at(-1))
      await expect(page.getByRole("button",{name:"Build with Aira",exact:true})).toBeVisible()
      return {screenshot:await shot("blank-deck")}
    })
    await step("import-powerpoint",async()=>{
      await page.goto(studio);await page.getByRole("button",{name:"+ New deck",exact:true}).click()
      await page.getByLabel("New deck",{exact:true}).getByRole("button",{name:"Import PowerPoint",exact:true}).click()
      await page.getByLabel("Import PowerPoint",{exact:true}).setInputFiles(path.resolve("fixtures/pptx/preservation.pptx"))
      if(options.runWorker){await expect(page.getByRole("status").filter({hasText:"Import queued"})).toBeVisible();await options.runWorker()}
      await expect(page.locator(".import-report")).toBeVisible({timeout:120000})
      const workerIdentity=checkWorkerIdentity(JSON.parse(await page.locator(".import-report pre").textContent()),sha)
      await page.getByRole("button",{name:"Keep and open deck",exact:true}).click()
      const link=page.getByRole("link",{name:"Open imported deck",exact:true});await link.waitFor();created.push((await link.getAttribute("href")).split("/").at(-1))
      await link.click();await page.locator('[data-sync-state="saved"]').waitFor()
      return {...workerIdentity,screenshot:await shot("imported-deck")}
    })
    const title="Live verification "+sha.slice(0,12)
    await step("edit-title-and-reload",async()=>{
      await page.getByRole("textbox",{name:"Text s0t0",exact:true}).fill(title)
      await page.locator('[data-sync-state="saved"]').waitFor();await page.reload()
      await expect(page.getByRole("textbox",{name:"Text s0t0",exact:true})).toHaveText(title)
      return {screenshot:await shot("persisted-title")}
    })
    for(const format of ["pptx","pdf"])await step("export-"+format,async()=>{
      await page.getByRole("button",{name:"Export",exact:true}).click();await page.getByLabel("File format",{exact:true}).selectOption(format)
      if(format==="pdf")await page.getByLabel("Export slides",{exact:true}).fill("1")
      const submit=page.getByRole("button",{name:"Export anyway",exact:true});if(await submit.count())await submit.click();else await page.getByRole("button",{name:"Create export",exact:true}).click()
      if(options.runWorker){await expect(page.getByRole("status").filter({hasText:"Export queued"})).toBeVisible();await options.runWorker()}
      const link=page.getByRole("link",{name:"Download "+format.toUpperCase(),exact:true});await link.waitFor({timeout:120000})
      const pending=page.waitForEvent("download");await link.click();const download=await pending
      const file=path.join(output,"export."+format);await download.saveAs(file)
      assert.equal(await download.failure(),null)
      const bytes=await readFile(file)
      if(format==="pptx"){
        const parsed=await importPptx(bytes);assert.ok(parsed.parts.get("ppt/slides/slide1.xml").toString().includes(title))
        const checked=await libreOfficeFastCheck(file,path.join(output,"libreoffice"),process.env.AIRDESIGN_LIBREOFFICE ?? "/home/quan/tmp/tools/libreoffice/soffice-local")
        assert.equal(checked.status,"passed","LibreOffice could not open export")
      }else{
        assert.equal(bytes.subarray(0,5).toString(),"%PDF-")
        const documentTask=getDocument({data:new Uint8Array(bytes),useSystemFonts:false})
        try{const doc=await documentTask.promise;assert.equal(doc.numPages,1);const text=(await (await doc.getPage(1)).getTextContent()).items.map(item=>"str" in item ? item.str : "").join(" ");assert.ok(text.includes(title),"PDF missing persisted title")}finally{await documentTask.destroy()}
      }
      const screenshot=await shot("export-"+format);await page.getByRole("button",{name:"Close export",exact:true}).click()
      return {file:"export."+format,bytes:bytes.length,screenshot}
    })
    await step("trash-and-empty",async()=>{
      await page.goto(studio)
      for(const id of created){const card=page.locator("article").filter({has:page.locator(`a[href="/deck/${id}"]`)});await card.getByRole("button",{name:"Move to Trash",exact:true}).click();await page.getByRole("dialog",{name:"Move deck to Trash?",exact:true}).getByRole("button",{name:"Move to Trash",exact:true}).click();await expect(card).toHaveCount(0)}
      await page.getByRole("button",{name:"Trash",exact:true}).click();await expect(page.locator(".deck-card")).toHaveCount(2);await shot("trash")
      await page.getByRole("button",{name:"Empty Trash",exact:true}).click();await page.getByRole("button",{name:"Delete permanently",exact:true}).click();await expect(page.getByRole("heading",{name:"Trash is empty",exact:true})).toBeVisible()
      return {screenshot:await shot("empty-trash")}
    })
    await step("no-paid-agent-calls",async()=>{assert.deepEqual(paidCalls,[],"unexpected Aira mutation was blocked")})
    receipt.browserErrors=browserErrors
    receipt.status="pass"
  }catch(error){receipt.browserErrors=browserErrors;receipt.status="fail";receipt.failedStep=current;receipt.error=safeError(error);if(page && !["smoke-sign-in","configuration"].includes(current))await shot("failure").catch(()=>undefined)}finally{
    if(receipt.status==="fail" && signedSmoke && created.length){
      try{
        for(const id of created){const response=await context.request.post(studio+`/api/catalog/${id}/trash`,{headers:{origin:studio},data:{},timeout:15000});assert.ok(response.ok(),"failure cleanup could not trash smoke deck")}
        const response=await context.request.get(studio+"/api/catalog?trash=true",{timeout:15000});assert.ok(response.ok())
        const decks=(await response.json()).filter(deck=>created.includes(deck.id)).map(({id,generation})=>({id,generation}))
        const removed=await context.request.delete(studio+"/api/catalog/trash",{headers:{origin:studio},data:{confirm:"empty-trash",decks},timeout:15000});assert.ok(removed.ok(),"failure cleanup could not empty smoke trash")
        receipt.steps.push({name:"failure-cleanup",status:"pass",evidence:{decks:decks.length}})
      }catch(error){receipt.steps.push({name:"failure-cleanup",status:"fail",error:safeError(error)})}
    }
    await browser?.close();receipt.finishedAt=new Date().toISOString();await writeFile(path.join(output,"receipt.json"),JSON.stringify(receipt,null,2)+"\n",{mode:0o600})
  }
  return receipt
}
if(import.meta.url===pathToFileURL(process.argv[1] ?? "").href){
  const {values}=parseArgs({options:{"expect-sha":{type:"string"},"site-url":{type:"string",default:"https://airdesign.app"},"studio-url":{type:"string",default:"https://studio.airdesign.app"},"mcp-url":{type:"string",default:"https://mcp.airdesign.app"},"smoke-email":{type:"string"},"output-dir":{type:"string"},railway:{type:"boolean",default:false},"railway-project":{type:"string"},"railway-environment":{type:"string"}}})
  const sha=values["expect-sha"] ?? "missing-sha",output=path.resolve(values["output-dir"] ?? path.join(os.homedir(),"tmp/airdesign-live-verify",sha+"-"+new Date().toISOString().replaceAll(":","-")))
  const target=railwayTarget(values["railway-project"],values["railway-environment"])
  const receipt=await verifyLive({sha,site:values["site-url"],studio:values["studio-url"],mcp:values["mcp-url"],email:values["smoke-email"],output,signInLink:async()=>{if(values.railway){const result=await promisify(execFile)("railway",railwaySshArguments(target,["node","apps/server/src/smoke/mint-link.ts",values["smoke-email"]]),{timeout:60000,maxBuffer:8192});return result.stdout.trim()}if(process.stdin.isTTY)throw new Error("use --railway or provide a one-use link on stdin");let input="";for await(const chunk of process.stdin){input+=chunk;if(input.length>8192)throw new Error("sign-in-input-too-large")}return input.trim()}})
  if(receipt.status!=="pass"){process.stderr.write(`${receipt.failedStep}: ${receipt.error}\nreceipt: ${output}/receipt.json\n`);process.exitCode=1}else process.stdout.write(`pass: ${output}/receipt.json\n`)
}
