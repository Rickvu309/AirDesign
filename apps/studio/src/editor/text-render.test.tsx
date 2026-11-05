import { expect,it,vi } from "vitest"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { Slide } from "../../../../packages/render/src/index.ts"
import { fixtureDeck } from "../../../../packages/deck/src/fixture.ts"

it("retains editable text nodes across unrelated slide updates and applies changed runs",async()=>{
  const deck=fixtureDeck(1),slide=deck.slides[0]!,host=document.createElement("div"),root=createRoot(host)
  document.body.append(host)
  try{
    await act(async()=>root.render(<Slide slide={slide} themes={deck.themes} commitText={()=>{}}/>))
    const text=host.querySelector('[role="textbox"]')!,span=text.firstChild
    const changed=structuredClone(slide);changed.notes="Unrelated notes"
    await act(async()=>root.render(<Slide slide={changed} themes={deck.themes} commitText={()=>{}}/>))
    expect(text.firstChild).toBe(span)
    const element=changed.elements.find(element=>element.kind==="text")!
    if(element.kind!=="text")throw new Error("text-required")
    element.runs[0].text="Updated text"
    await act(async()=>root.render(<Slide slide={structuredClone(changed)} themes={deck.themes} commitText={()=>{}}/>))
    expect(text.textContent).toContain("Updated text")
    expect(text.firstChild).toBe(span)
  }finally{await act(async()=>root.unmount());host.remove()}
})

it("reads selection only for the focused editable text",async()=>{
  const {canonicalChildren}=await import("../../../../packages/render/src/editable-input.ts")
  const deck=fixtureDeck(1),text=deck.slides[0]!.elements.find(element=>element.kind==="text")!
  if(text.kind!=="text")throw new Error("text-required")
  const node=document.createElement("div");node.tabIndex=0;document.body.append(node)
  const selection=vi.spyOn(document,"getSelection")
  try{
    canonicalChildren(node,text.runs)
    expect(selection).not.toHaveBeenCalled()
    node.focus();canonicalChildren(node,text.runs)
    expect(selection).toHaveBeenCalledOnce()
  }finally{selection.mockRestore();node.remove()}
})
