import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect,it,vi } from "vitest"
import { basics } from "../../../../packages/brand/src/index.ts"
import { fixtureDeck } from "../../../../packages/deck/src/fixture.ts"
import { TemplatePanel } from "./template-panel.tsx"
vi.mock("../decks/catalog-client.ts",()=>({api:async()=>({templates:[...basics],default:basics[0]})}))
it("keeps the template gallery in a picker and returns to the design controls after selection",async()=>{
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  const button=(label:string)=>[...container.querySelectorAll("button")].find(button=>button.textContent===label)!
  try{
    await act(async()=>root.render(<TemplatePanel deck={fixtureDeck(1)} selection={[]} edit={()=>{}} disabled={false} close={()=>{}}/>))
    expect(container.querySelector('[aria-label="Template picker"]')).toBeNull()
    await act(async()=>button("Choose template").click())
    expect(container.querySelector('[aria-label="Template picker"]')).not.toBeNull()
    await act(async()=>button("Slide titleDark slides · v1").click())
    expect(container.querySelector('[aria-label="Template picker"]')).toBeNull()
    expect(container.querySelector('[aria-label="Design panel"]')?.textContent).toContain("Dark slides · v1")
  }finally{await act(async()=>root.unmount());container.remove()}
})
it("uses a native deck color for Mist instead of duplicating the white background",async()=>{
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  const deck=fixtureDeck(2)
  try{
    await act(async()=>root.render(<TemplatePanel deck={deck} selection={[]} edit={()=>{}} disabled={false} close={()=>{}}/>))
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Mist color"]')?.value).toBe("#b4ccea")
    expect(container.querySelector<HTMLInputElement>('input[aria-label="White color"]')?.value).toBe("#ffffff")
  }finally{await act(async()=>root.unmount());container.remove()}
})
