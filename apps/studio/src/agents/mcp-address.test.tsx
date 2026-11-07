import {act} from "react"
import {createRoot} from "react-dom/client"
import {expect,it,vi} from "vitest"
import {AgentsPanel} from "./agents-panel.tsx"

it("keeps the MCP address selectable when clipboard access is refused",async()=>{
  vi.stubGlobal("fetch",async(url:string)=>Response.json(url.endsWith("configure") ? {enabled:true} : []))
  vi.spyOn(navigator.clipboard,"writeText").mockRejectedValue(new Error("clipboard-refused"))
  const container=document.createElement("div"),root=createRoot(container);document.body.append(container)
  try{
    await act(async()=>root.render(<AgentsPanel/>))
    await act(async()=>[...container.querySelectorAll("button")].find(button=>button.textContent==="Copy")!.click())
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Unable to copy the address. Select and copy it from the field.")
    expect(container.querySelector<HTMLInputElement>("#mcp-address")?.value).toBe("https://mcp.airdesign.app/mcp")
  }finally{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals()}
})
