import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect,it,vi } from "vitest"
import { basics } from "../../../../packages/brand/src/index.ts"
import { fixtureDeck } from "../../../../packages/deck/src/fixture.ts"
import { TemplatePanel } from "./template-panel.tsx"
vi.mock("../decks/catalog-client.ts",()=>({api:async(path:string)=>path==="/api/assets" ? {assets:[{id:"saved_background",width:1600,height:900}]} : {templates:[...basics],default:basics[0]}}))
it("keeps the template gallery in a picker and returns to the design controls after selection",async()=>{
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  const button=(label:string)=>[...container.querySelectorAll("button")].find(button=>button.getAttribute("aria-label")===label || button.textContent===label)!
  try{
    await act(async()=>root.render(<TemplatePanel deck={fixtureDeck(1)} selection={[]} edit={()=>{}} disabled={false} close={()=>{}}/>))
    expect(container.querySelector('[aria-label="Template picker"]')).toBeNull()
    await act(async()=>button("Choose template").click())
    expect(container.querySelector('[aria-label="Template picker"]')).not.toBeNull()
    await act(async()=>button("Dark slides").click())
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

it("focuses search and restores the trigger after Escape and outside dismissal",async()=>{
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  try{
    await act(async()=>root.render(<TemplatePanel deck={fixtureDeck(1)} selection={[]} edit={()=>{}} disabled={false} close={()=>{}}/>))
    const trigger=container.querySelector<HTMLButtonElement>('[aria-label="Choose template"]')!
    await act(async()=>trigger.click())
    expect(document.activeElement).toBe(container.querySelector('[aria-label="Search templates"]'))
    await act(async()=>document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true})))
    expect(container.querySelector('[aria-label="Template picker"]')).toBeNull();expect(document.activeElement).toBe(trigger)
    await act(async()=>trigger.click());await act(async()=>document.body.dispatchEvent(new Event("pointerdown",{bubbles:true})))
    expect(container.querySelector('[aria-label="Template picker"]')).toBeNull();expect(document.activeElement).toBe(trigger)
  }finally{await act(async()=>root.unmount());container.remove()}
})

it("inserts a saved image as one background change and keeps foreground content",async()=>{
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container),deck=fixtureDeck(1),edit=vi.fn()
 try{
  await act(async()=>root.render(<TemplatePanel deck={deck} selection={[deck.slides[0]!.id]} edit={edit} disabled={false} close={()=>{}}/>))
  const tab=[...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button=>button.textContent==="Image")!
  await act(async()=>tab.click())
  await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="Use background image 1"]')!.click())
  expect(edit).toHaveBeenCalledWith({changes:[expect.objectContaining({kind:"insert",parent:deck.slides[0]!.id,index:0,value:expect.objectContaining({kind:"image",image:expect.objectContaining({asset:"saved_background"})})})]})
 }finally{await act(async()=>root.unmount());container.remove()}
})

it("names the current background color after it changes",async()=>{
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container),deck=fixtureDeck(1);deck.slides[0]!.background="#123456"
 try{await act(async()=>root.render(<TemplatePanel deck={deck} selection={[]} edit={()=>{}} disabled={false} close={()=>{}}/>));expect(container.querySelector(".background-color")?.textContent).toBe("#123456")}finally{await act(async()=>root.unmount());container.remove()}
})

it("names the design panel header after the selected slide without a duplicate title row",async()=>{
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container),deck=fixtureDeck(1,3)
 try{await act(async()=>root.render(<TemplatePanel deck={deck} selection={[deck.slides[2]!.id]} edit={()=>{}} disabled={false} close={()=>{}}/>));expect(container.querySelector(".template-panel>header h2")?.textContent).toBe("Slide 3");expect(container.querySelector(".design-slide-title")).toBeNull()}finally{await act(async()=>root.unmount());container.remove()}
})

it("filters template cards by their look name without version metadata",async()=>{
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
 try{
  await act(async()=>root.render(<TemplatePanel deck={fixtureDeck(1)} selection={[]} edit={()=>{}} disabled={false} close={()=>{}}/>))
  await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="Choose template"]')!.click())
  const cards=[...container.querySelectorAll<HTMLButtonElement>(".template-card")]
  expect(cards.every(card=>!card.textContent?.includes(" · v"))).toBe(true)
  expect(cards.map(card=>card.getAttribute("aria-label"))).toContain("Dark slides")
  const input=container.querySelector<HTMLInputElement>('[aria-label="Search templates"]')!
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,"Dark");input.dispatchEvent(new Event("input",{bubbles:true}))})
  expect(container.querySelectorAll(".template-card")).toHaveLength(1)
  await act(async()=>container.querySelector<HTMLButtonElement>(".template-card")!.click())
  expect(container.querySelector(".template-picker")).toBeNull()
  expect(document.activeElement).toBe(container.querySelector('[aria-label="Choose template"]'))
 }finally{await act(async()=>root.unmount());container.remove()}
})
