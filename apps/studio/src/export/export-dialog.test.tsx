import {act} from "react"
import {createRoot} from "react-dom/client"
import {expect,it,vi} from "vitest"
import {fixtureDeck} from "../../../../packages/deck/src/fixture.ts"
import {id} from "../../../../packages/deck/src/model.ts"
import {Toaster,toast} from "@airdesign/ui"
import {ExportDialog} from "./export-dialog.tsx"

it("explains a killed export and keeps its typed diagnostic behind Details",async()=>{
 const diagnostic=JSON.stringify({kind:"limit",limit:"wall-clock",signal:"SIGKILL"})
 vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,json:async()=>[{id:"failed-export",kind:"failed",format:"pdf",attempts:1,diagnostics:[diagnostic],reason:diagnostic,failure:{kind:"limit",limit:"wall-clock",signal:"SIGKILL"}}]})))
 const container=document.createElement("div");document.body.append(container)
 const root=createRoot(container)
 try{
  await act(async()=>root.render(<ExportDialog deck={fixtureDeck(1)} seq={0} open={false} close={()=>{}} fix={()=>{}} disabled={false}/>))
  expect(container.querySelector('[role="status"]')?.textContent).toBe("Unable to export. Your deck is unchanged. The export reached its time limit. Try again.")
  expect(container.querySelector("details")?.open).toBe(false)
  expect(container.querySelector("details")?.textContent).toContain("SIGKILL")
  expect([...container.querySelectorAll("button")].some(button=>button.textContent==="Retry export")).toBe(true)
 }finally{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()}
})

it("offers the designed export options and a safe retry after a worker failure",async()=>{
  const deck=fixtureDeck(0,1),close=vi.fn(),container=document.createElement("div"),root=createRoot(container)
  document.body.append(container)
  let failed=false
  vi.stubGlobal("fetch",async(_url:string,input?:RequestInit)=>input?.method==="POST" ? new Response("",{status:503}) : Response.json(failed ? [{id:"export",deck:deck.id,format:"pptx",attempts:1,options:{format:"pptx",slides:[],timing:"now",expectedSeq:0,allowIssues:false},diagnostics:[],kind:"failed",failure:{kind:"application",code:"worker-error"},reason:"private-worker-diagnostic"}] : []))
  try{
    await act(async()=>root.render(<><Toaster/><ExportDialog deck={deck} seq={0} open close={close} fix={()=>{}} disabled={false}/></>))
    expect(container.querySelector<HTMLSelectElement>('[aria-label="File format"]')?.selectedOptions[0]?.text).toBe("PowerPoint")
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Export slides"]')?.selectedOptions[0]?.text).toBe("All slides")
    expect([...container.querySelectorAll("button")].some(button=>button.textContent==="Export")).toBe(true)
    const format=container.querySelector<HTMLSelectElement>('[aria-label="File format"]')
    if(!format)throw new Error("missing-format-control")
    await act(async()=>{format.value="pdf";format.dispatchEvent(new Event("change",{bubbles:true}))})
    expect(container.querySelector<HTMLSelectElement>('[aria-label="PDF quality"]')?.selectedOptions[0]?.text).toBe("Standard")
    failed=true
    await act(async()=>root.render(<><Toaster/><ExportDialog deck={{...deck,id:id("second")}} seq={0} open close={close} fix={()=>{}} disabled={false}/></>))
    await act(async()=>new Promise(resolve=>setTimeout(resolve,50)))
    expect(document.body.textContent).toContain("Unable to export. Your deck is unchanged.")
    expect(document.body.textContent).not.toContain("private-worker-diagnostic")
    expect([...document.querySelectorAll("button")].some(button=>button.textContent==="Try again")).toBe(true)
    expect(close).toHaveBeenCalled()
    const retry=[...document.querySelectorAll("button")].find(button=>button.textContent==="Try again")
    if(!retry)throw new Error("missing-retry-control")
    await act(async()=>retry.click())
    expect(document.body.textContent).toContain("Unable to retry this export. Open Export to try again.")
  }finally{toast.dismiss();await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()}
})
