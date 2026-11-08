import {act} from "react"
import {createRoot} from "react-dom/client"
import {expect,it,vi} from "vitest"
import {fixtureDeck} from "../../../../packages/deck/src/fixture.ts"
import {EditorTools,type EditorTool} from "./editor-tools.tsx"

async function mount(tool:EditorTool){const container=document.createElement("div");document.body.append(container);const root=createRoot(container),insert=vi.fn(),close=vi.fn();await act(async()=>root.render(<EditorTools tool={tool} deck={fixtureDeck(1)} insert={insert} close={close} addSlide={()=>{}}/>));return {container,insert,close,button:(name:string)=>[...container.querySelectorAll<HTMLButtonElement>("button")].find(button=>button.getAttribute("aria-label")===name||button.textContent===name)!,unmount:async()=>{await act(async()=>root.unmount());container.remove()}}}
it("offers the nine quick shapes in design order and inserts native geometry",async()=>{
 const view=await mount("shapes")
 try{
  expect([...view.container.querySelectorAll(".shape-choices:not(.shape-lines)>button")].map(button=>button.getAttribute("aria-label"))).toEqual(["Rectangle","Circle","Diamond","Triangle","Star","Plus","Left arrow","Right arrow","Callout"])
  expect(view.button("Line").querySelector("svg")).not.toBeNull();expect(view.button("Arrow").querySelector("svg")).not.toBeNull()
  await act(async()=>view.button("Star").click());expect(view.insert).toHaveBeenCalledWith(expect.objectContaining({kind:"shape",geometry:"star",support:{kind:"native"}}))
  await act(async()=>view.button("More shapes").click());expect(view.button("Back from Shapes")).toBeDefined()
  await act(async()=>view.button("Back from Shapes").click());expect(view.container.querySelector("aside")?.getAttribute("data-expanded")).toBe("false")
 }finally{await view.unmount()}
})
it("previews exact text sizes while keeping native text and action insertion",async()=>{
 const text=await mount("text")
 try{
  expect([...text.container.querySelectorAll<HTMLElement>(".text-style")].map(element=>element.style.fontSize)).toEqual(["30px","22px","18px","15px","15px","14px","13px","12px"])
  await act(async()=>text.button("Title").click());expect(text.insert).toHaveBeenCalledWith(expect.objectContaining({kind:"text",runs:[expect.objectContaining({text:"Title",size:40})]}))
  await act(async()=>text.button("Back from Text").click());expect(text.close).toHaveBeenCalled()
 }finally{await text.unmount()}
 const actions=await mount("actions")
 try{
  for(const name of ["Chart","Table","Icon","Remove background","Boost resolution"])expect(actions.button(name).querySelector("svg")).not.toBeNull()
  expect(actions.button("Remove background").disabled).toBe(true);expect(actions.button("Boost resolution").disabled).toBe(true)
  expect(actions.container.textContent).not.toContain("↵")
  await act(async()=>actions.button("Chart").click());expect(actions.insert).toHaveBeenCalledWith(expect.objectContaining({kind:"group",children:expect.arrayContaining([expect.objectContaining({kind:"shape",geometry:"rectangle"})])}));expect(actions.close).toHaveBeenCalled()
 }finally{await actions.unmount()}
})
