import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect,it,vi } from "vitest"
import { Workspace } from "./workspace.tsx"

vi.mock("../editor/manual-editor.tsx",()=>({ManualEditor:()=>null}))
vi.mock("../import/import-card.tsx",()=>({ImportCard:()=>null}))
vi.mock("./catalog-client.ts",()=>({listDecks:async()=>[{id:"example",title:"Strategy",slides:1,updated:Date.now(),deletedAt:Date.now()-86400000,generation:1}],api:vi.fn(),createDeck:vi.fn(),deckAction:vi.fn()}))

it("offers Recents and All decks with a per-deck Trash countdown",async()=>{
  history.replaceState(null,"","/")
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  try{
    await act(async()=>root.render(<Workspace/>))
    const click=async(label:string)=>act(async()=>[...container.querySelectorAll("button")].find(button=>button.textContent===label)!.click())
    expect(container.querySelector("h1")?.textContent).toBe("Recents")
    await click("All decks")
    expect(container.querySelector("h1")?.textContent).toBe("All decks")
    await click("Trash")
    expect(container.querySelector(".deck-card")?.textContent).toContain("29 days remaining")
    await click("Empty Trash")
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Strategy")
  }finally{await act(async()=>root.unmount());container.remove();history.replaceState(null,"","/")}
})
