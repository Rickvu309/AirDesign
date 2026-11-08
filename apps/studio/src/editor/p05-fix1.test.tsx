import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect,it,vi } from "vitest"
import { fixtureDeck } from "../../../../packages/deck/src/fixture.ts"
import { initialHistory } from "../../../../packages/change-log/src/index.ts"
import { ManualEditor } from "./manual-editor.tsx"
import { StudioShell } from "../shell/studio-shell.tsx"

vi.mock("./use-deck.ts",()=>({useDeck:()=>({sync:{deck:fixtureDeck(1,2),seq:0,state:{kind:"saved"},history:initialHistory(fixtureDeck(1,2)),queue:[],historyTarget:()=>null},entry:{title:"Strategy"},setError:()=>{}})}))
vi.mock("../../../../packages/render/src/fonts.ts",async original=>({...await original<typeof import("../../../../packages/render/src/fonts.ts")>(),waitForFonts:()=>Promise.resolve(),fontReport:()=>({missing:[]})}))
vi.mock("../export/export-dialog.tsx",()=>({ExportDialog:()=>null}))

it("uses the floating editor shell, switches views and exposes contextual actions",async()=>{
  vi.stubGlobal("EventSource",class{close(){}})
  vi.stubGlobal("matchMedia",()=>({matches:false,addEventListener:()=>{},removeEventListener:()=>{}}))
  const unexpectedFetch=vi.fn(()=>Promise.reject(new Error("unexpected-network-request")));vi.stubGlobal("fetch",unexpectedFetch)
  history.replaceState(null,"","/deck/example")
  const container=document.createElement("div");document.body.append(container)
  const root=createRoot(container)
  try{
    await act(async()=>root.render(<StudioShell starredDecks={[]} search="" onSearch={() => undefined} intentLabel="" showIntent={false} onSignOut={()=>{}}><ManualEditor deckId="example"/></StudioShell>))
    expect(container.querySelector(".ad-topbar")).toBeNull()
    expect(container.querySelector('.editor-dock[aria-label="Design tools"]')).not.toBeNull()
    expect(container.querySelector(".editor-section h2")?.textContent).toBe("Slides")
    expect(container.querySelector(".editor-menu")).toBeNull()
    const button=(name:string)=>[...container.querySelectorAll("button")].find(value=>value.getAttribute("aria-label")===name || value.textContent===name)!
    expect(button("Agent").disabled).toBe(false)
    expect(container.querySelectorAll(".editor-panel-switch button>svg")).toHaveLength(2)
    await act(async()=>button("Single slide view").click())
    expect(container.querySelectorAll(".editor-slide:not([hidden])")).toHaveLength(1)
    await act(async()=>button("Grid view").click())
    expect(container.querySelectorAll(".editor-slide:not([hidden])")).toHaveLength(2)
    await act(async()=>container.querySelector<HTMLButtonElement>(".deck-name")!.click())
    for(const label of ["Undo","Redo","Move earlier","Move later","Delete slides","Paste slides"])expect(button(label)).toBeDefined()
    await act(async()=>button("Paste slides").click())
    expect(container.querySelector(".editor-menu")).toBeNull()
    await act(async()=>container.querySelector(".editor-slide")!.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true})))
    expect(container.querySelector('[aria-label="Slide actions"]')).not.toBeNull()
    expect(unexpectedFetch).not.toHaveBeenCalled()
  }finally{await act(async()=>root.unmount());container.remove();history.replaceState(null,"","/");vi.unstubAllGlobals()}
})
