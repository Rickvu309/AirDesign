import {act} from "react"
import {createRoot} from "react-dom/client"
import {expect,it,vi} from "vitest"
import {createAccessClient} from "@airdesign/access/client"
import {AccountPanel} from "./account-panel.tsx"

it("shows the supported language and new-deck slide size with accessible labels",async()=>{
  vi.stubGlobal("fetch",async()=>Response.json({status:"signed-in",personId:"owner",displayName:"Rick",email:"rick@example.com"}))
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  try{
    await act(async()=>root.render(<AccountPanel client={createAccessClient("")}/>))
    expect(container.querySelector('label[for="account-language"]')?.textContent).toBe("Language")
    expect(container.querySelector<HTMLSelectElement>("#account-language")?.value).toBe("en")
    expect(container.querySelector('label[for="account-slide-size"]')?.textContent).toBe("Slide size")
    expect(container.querySelector<HTMLSelectElement>("#account-slide-size")?.value).toBe("16:9")
    expect(container.textContent).toContain("For new decks")
    expect(container.textContent).toContain("Rick, rick@example.com")
  }finally{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()}
})

it("keeps profile updates available from the compact profile card",async()=>{
  const updates:unknown[]=[]
  vi.stubGlobal("fetch",async(url:string,init?:RequestInit)=>{if(init?.method==="POST"){updates.push({url,body:JSON.parse(String(init.body))});return Response.json({status:"ok",personId:"owner",displayName:"Rick"})}return Response.json({status:"signed-in",personId:"owner",displayName:"Rick",email:"rick@example.com"})})
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  try{
    await act(async()=>root.render(<AccountPanel client={createAccessClient("")}/>))
    expect(container.querySelector("form")).toBeNull()
    const action0=[...container.querySelectorAll("button")].find(button=>button.textContent==="Edit")
    if(!action0)throw new Error("missing-edit-action")
    await act(async()=>action0.click())
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe("Rick")
    const action1=[...container.querySelectorAll("button")].find(button=>button.textContent==="Save name")
    if(!action1)throw new Error("missing-save-name-action")
    await act(async()=>action1.click())
    expect(updates).toEqual([{url:"/api/people/owner/profile",body:{displayName:"Rick"}}])
    expect(container.textContent).toContain("Name saved.")
    expect(container.querySelector("form")).toBeNull()
    expect(container.textContent).toContain("Rick, rick@example.com")
  }finally{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()}
})
