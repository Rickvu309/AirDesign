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
    history.replaceState(null,"","/?browse=all")
    await act(async()=>root.render(<Workspace key="all"/>))
    expect(container.querySelector("h1")?.textContent).toBe("All decks")
    history.replaceState(null,"","/trash")
    await act(async()=>root.render(<Workspace key="trash"/>))
    expect(container.querySelector(".deck-card")?.textContent).toContain("29 days remaining")
    await click("Empty Trash")
    expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe("Delete 1 decks for good?")
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("This can't be undone.")
    expect(document.querySelector('[role="dialog"] .ad-button-danger')?.textContent).toBe("Delete for good")
  }finally{await act(async()=>root.unmount());container.remove();history.replaceState(null,"","/")}
})

it("browses decks before offering import through New deck and switches grid/list",async()=>{
  history.replaceState(null,"","/")
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  try{
    await act(async()=>root.render(<Workspace/>))
    expect(container.querySelector('[aria-label="List view"]')).not.toBeNull()
    await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="List view"]')!.click())
    expect(container.querySelector('.deck-list .deck-card')).not.toBeNull()
    expect(container.textContent).not.toContain("Import PowerPoint")
    await act(async()=>container.querySelector<HTMLElement>("summary")!.click())
    expect(container.querySelector('[aria-label="New deck"]')?.textContent).toContain("Import PowerPoint")
    expect(container.querySelector('[aria-label="New deck"]')?.textContent).toContain("Blank deck")
  }finally{await act(async()=>root.unmount());container.remove()}
})
