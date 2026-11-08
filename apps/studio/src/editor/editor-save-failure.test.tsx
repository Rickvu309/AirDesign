import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect,it,vi } from "vitest"
import { fixtureDeck } from "../../../../packages/deck/src/fixture.ts"
import { initialHistory } from "../../../../packages/change-log/src/index.ts"
import { ManualEditor } from "./manual-editor.tsx"

const failure=vi.hoisted(()=>({message:"deadlock detected: private database detail",retry:vi.fn()}))
vi.mock("./use-deck.ts",()=>({useDeck:()=>({sync:{deck:fixtureDeck(1,2),seq:0,state:{kind:"pending"},history:initialHistory(fixtureDeck(1,2)),queue:[],historyTarget:()=>null},entry:{title:"Strategy"},setError:()=>{},error:failure.message,reconnect:failure.retry})}))
vi.mock("../../../../packages/render/src/fonts.ts",async original=>({...await original<typeof import("../../../../packages/render/src/fonts.ts")>(),waitForFonts:()=>Promise.resolve(),fontReport:()=>({missing:[]})}))
vi.mock("../export/export-dialog.tsx",()=>({ExportDialog:()=>null}))

it("shows reviewed copy and a retry action for a persistent database failure",async()=>{
  vi.stubGlobal("matchMedia",()=>({matches:false,addEventListener:()=>{},removeEventListener:()=>{}}))
  vi.stubGlobal("EventSource",class {onmessage=null;onerror=null;close(){}})
  const container=document.createElement("div");document.body.append(container)
  const root=createRoot(container)
  try{
    await act(async()=>root.render(<ManualEditor deckId="example"/>))
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Unable to save your changes. Your edits are kept on this device. Try again.")
    expect(container.querySelector(".editor-status:not([hidden])")?.textContent).toContain("Unable to save changes")
    expect(container.textContent).not.toContain("deadlock")
    expect(container.textContent).not.toContain("private database detail")
    const retry=[...container.querySelectorAll("button")].find(button=>button.textContent==="Try again")
    expect(retry).toBeDefined()
    await act(async()=>retry!.click())
    expect(failure.retry).toHaveBeenCalledOnce()
  }finally{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()}
})
