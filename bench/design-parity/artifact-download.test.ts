import {createServer} from "node:http"
import {once} from "node:events"
import {chromium} from "playwright"
import {expect,it} from "vitest"
import {assertArtifactDownload} from "./capture.mjs"
import {writeSavedPptx} from "../../packages/pptx/src/export-deck.ts"
import {fixtureDeck} from "../../packages/deck/src/fixture.ts"

it("downloads relative and absolute artifacts at the actual browser port and rejects missing, HTTP and corrupt results",async()=>{
 const expected=await writeSavedPptx(fixtureDeck(1,6),0,null,{})
 const server=createServer((request,response)=>{
  if(request.url==="/"){response.setHeader("content-type","text/html");response.end('<a download href="/artifact">Download PPTX</a>');return}
  if(request.url==="/unavailable"){response.statusCode=503;response.end("unavailable");return}
  response.setHeader("content-type","application/vnd.openxmlformats-officedocument.presentationml.presentation")
  response.setHeader("content-disposition",'attachment; filename="Actual saved deck.pptx"')
  response.end(request.url==="/corrupt" ? Buffer.from("corrupt") : expected)
 })
 server.listen(0,"127.0.0.1");await once(server,"listening")
 const address=server.address();if(!address||typeof address==="string")throw new Error("missing-http-port")
 const origin=`http://127.0.0.1:${address.port}`,browser=await chromium.launch()
 try{
  const page=await browser.newPage();page.setDefaultTimeout(1000);await page.goto(origin)
  await expect(page.request.get("/artifact")).rejects.toThrow("Invalid URL")
  for(const href of ["/artifact",origin+"/artifact"]){
   await page.locator("a").evaluate((element,href)=>element.setAttribute("href",href),href)
   const proof=await assertArtifactDownload(page,expected)
   expect(proof.url).toBe(origin+"/artifact");expect(proof.bytes).toBe(expected.length)
   expect(proof.sha256).toBe(proof.expectedSha256);expect(proof.suggestedFilename).toBe("Actual saved deck.pptx")
  }
  for(const [href,error] of [["/unavailable","artifact-http-failed"],["/corrupt","artifact-content-mismatch"]]){
   if(!href||!error)throw new Error("missing-negative-case")
   await page.locator("a").evaluate((element,href)=>element.setAttribute("href",href),href)
   await expect(assertArtifactDownload(page,expected)).rejects.toThrow(error)
  }
  await page.evaluate(()=>{const toast=document.createElement("div");toast.setAttribute("data-sonner-toast","");toast.textContent="Actual saved deck.pptx downloaded";document.body.append(toast)})
  await page.locator("a").evaluate(element=>{element.setAttribute("role","link");element.removeAttribute("href")})
  await expect(assertArtifactDownload(page,expected)).rejects.toThrow("missing-artifact-url")
  await page.locator("a").evaluate(element=>element.remove())
  await expect(assertArtifactDownload(page,expected)).rejects.toThrow()
 }finally{await browser.close();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
})
