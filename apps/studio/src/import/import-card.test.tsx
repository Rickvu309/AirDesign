import {act} from "react"
import {createRoot} from "react-dom/client"
import {expect,it,vi} from "vitest"
import {ImportCard} from "./import-card.tsx"

it("restores an importing card and offers plain failure recovery with diagnostics behind Details",async()=>{
  localStorage.clear();localStorage.setItem(JSON.stringify(["import","owner"]),"import_example")
  let failed=false
  vi.stubGlobal("fetch",vi.fn(async(url:string)=>({ok:true,json:async()=>url==="/api/account" ? {status:"signed-in",personId:"owner"} : {id:"import_example",kind:failed ? "failed" : "running",reason:"zip-central-directory-missing"}})))
  const container=document.createElement("div");document.body.append(container);let root=createRoot(container)
  try{
    await act(async()=>root.render(<ImportCard finished={async()=>{}}/>))
    expect(container.querySelector("h2")?.textContent).toBe("Importing PowerPoint")
    await act(async()=>root.unmount());root=createRoot(container);failed=true
    await act(async()=>root.render(<ImportCard finished={async()=>{}}/>))
    expect(container.querySelector("h2")?.textContent).toBe("Unable to import this file")
    expect(container.querySelector('[role="status"]')?.textContent).not.toContain("zip-")
    const details=container.querySelector("details")!
    expect(details.open).toBe(false)
    expect(details.textContent).toContain("zip-central-directory-missing")
    expect([...container.querySelectorAll("button")].some(button=>button.textContent==="Choose another file")).toBe(true)
    await act(async()=>[...container.querySelectorAll("button")].find(button=>button.textContent==="Remove")!.click())
    expect(container.querySelector(".import-card")).toBeNull()
    expect(localStorage.getItem(JSON.stringify(["import","owner"]))).toBeNull()
  }finally{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();localStorage.clear()}
})

it("AD-10 opens the retained imported deck after keeping it",async()=>{
  localStorage.clear();localStorage.setItem(JSON.stringify(["import","owner"]),"import_ready")
  const openDeck=vi.fn(),finished=vi.fn(async()=>{})
  vi.stubGlobal("fetch",vi.fn(async(url:string)=>({ok:true,json:async()=>url==="/api/account" ? {status:"signed-in",personId:"owner"} : url==="/api/catalog/import" ? {entry:{id:"retained"}} : {id:"import_ready",kind:"ready",report:{capabilities:[]}}})))
  const container=document.createElement("div"),root=createRoot(container);document.body.append(container)
  try{await act(async()=>root.render(<ImportCard finished={finished} openDeck={openDeck}/>));await act(async()=>[...container.querySelectorAll("button")].find(node=>node.textContent==="Keep and open deck")!.click());expect(openDeck).toHaveBeenCalledWith("retained");expect(finished).toHaveBeenCalledOnce()}finally{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();localStorage.clear()}
})
