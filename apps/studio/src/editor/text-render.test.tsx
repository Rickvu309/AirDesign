import { expect,it,vi } from "vitest"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { Slide } from "../../../../packages/render/src/index.ts"
import type { Run } from "../../../../packages/deck/src/model.ts"
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

it("canonicalizes browser line-break blocks after a committed local edit is reloaded",async()=>{
  const deck=fixtureDeck(1),host=document.createElement("div"),root=createRoot(host)
  let slide=deck.slides[0]!
  document.body.append(host)
  const commit=(_id:string,runs:Run[])=>{
    slide=structuredClone(slide)
    const text=slide.elements.find(element=>element.kind==="text")!
    if(text.kind!=="text" || !runs[0])throw new Error("text-required")
    text.runs=[runs[0],...runs.slice(1)]
  }
  const render=()=>root.render(<Slide slide={slide} themes={deck.themes} commitText={commit}/>)
  try{
    await act(render)
    const text=host.querySelector('[role="textbox"]')!,block=document.createElement("div")
    block.textContent="Tail";text.append(block)
    await act(async()=>{text.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"insertParagraph"}));render()})
    expect(text.querySelector("div")).not.toBeNull()
    slide=structuredClone(slide)
    await act(render)
    expect(text.querySelector("div,br,p")).toBeNull()
    expect(text.textContent).toContain("\nTail")
  }finally{await act(async()=>root.unmount());host.remove()}
})

it("combines consecutive formatting shortcuts before saved runs rerender",async()=>{
  const deck=fixtureDeck(1),slide=deck.slides[0]!,host=document.createElement("div"),root=createRoot(host),commits:Run[][]=[]
  const element=slide.elements.find(element=>element.kind==="text")!
  if(element.kind!=="text")throw new Error("text-required")
  element.runs[0].bold=true
  document.body.append(host)
  try{
    await act(async()=>root.render(<Slide slide={slide} themes={deck.themes} commitText={(_id,runs)=>commits.push(runs)}/>))
    const text=host.querySelector<HTMLElement>('[role="textbox"]')!
    text.tabIndex=0;text.focus();const range=document.createRange();range.selectNodeContents(text);document.getSelection()?.removeAllRanges();document.getSelection()?.addRange(range)
    await act(async()=>{for(const key of ["b","i","u"]){range.selectNodeContents(text);document.getSelection()?.removeAllRanges();document.getSelection()?.addRange(range);text.dispatchEvent(new KeyboardEvent("keydown",{key,ctrlKey:true,bubbles:true,cancelable:true}))}})
    expect(commits).toHaveLength(3)
    expect(commits[2]?.[0]).toMatchObject({bold:false,italic:true,underline:true})
    expect(text.querySelector("span")?.style).toMatchObject({fontWeight:"400",fontStyle:"italic",textDecoration:"underline"})
  }finally{await act(async()=>root.unmount());host.remove()}
})
