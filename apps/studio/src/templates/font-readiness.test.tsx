import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect,it,vi } from "vitest"
import { FontReadiness } from "./font-readiness.tsx"
it("shows cold font waiting until the pinned faces are ready and records its duration",async()=>{
  let finish:()=>void=()=>{}
  const ready=new Promise<void>(resolve=>{finish=resolve})
  vi.stubGlobal("document",Object.assign(document,{fonts:{load:async()=>[{}],ready,check:()=>true}}))
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  try{
    await act(async()=>root.render(<FontReadiness/>))
    expect(container.querySelector('[data-font-state="loading"]')?.textContent).toBe("Loading deck fonts…")
    expect(container.querySelector("p")?.hidden).toBe(false)
    await act(async()=>finish())
    expect(container.querySelector('[data-font-state="ready"]')).not.toBeNull()
    expect(Number(container.querySelector("p")?.dataset.fontWaitMs)).toBeGreaterThanOrEqual(0)
    expect(container.querySelector("p")?.hidden).toBe(true)
  }finally{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()}
})
