import {it,expect} from "vitest"
import {createElement} from "react"
import {renderToStaticMarkup} from "react-dom/server"
import {Window} from "happy-dom"
import {Slide} from "../src/slide.tsx"
import {canonicalChildren} from "../src/editable-input.ts"
import {editableRuns} from "../src/editable-runs.ts"
import {fixtureDeck} from "../../deck/src/fixture.ts"
import type {Run} from "../../deck/src/model.ts"

const runs: [Run,...Run[]]=[{text:"Sans",font:"Liberation Sans",size:24,color:"#123456",bold:true},{text:" Serif",font:"Liberation Serif",size:18,color:"#654321",bold:false,italic:true,underline:true}]
it("readonly rendering preserves supplied font families with pinned fallback",()=>{
  const slide=fixtureDeck(1).slides[0]
  if(!slide)throw new Error("slide-required")
  const element=slide.elements[0]
  if(!element||element.kind!=="text")throw new Error("text-required")
  element.runs=structuredClone(runs)
  const html=renderToStaticMarkup(createElement(Slide,{slide}))
  expect(html).toContain("font-family:&quot;Liberation Sans&quot;, Geist")
  expect(html).toContain("font-family:&quot;Liberation Serif&quot;, Geist")
  expect(html).toContain("font-style:italic")
  expect(html).toContain("Using system fonts when available, with pinned Geist as fallback.")
})
it("editable creation, reconciliation and input preserve per-run fonts and other styles",()=>{
  const window=new Window(),original=Object.getOwnPropertyDescriptor(globalThis,"document")
  Object.defineProperty(globalThis,"document",{configurable:true,value:window.document})
  try {
    const node=document.createElement("div")
    document.body.append(node)
    canonicalChildren(node,structuredClone(runs))
    expect([...node.children].map(span=>span.getAttribute("style"))).toEqual([expect.stringContaining('font-family: "Liberation Sans", Geist'),expect.stringContaining('font-family: "Liberation Serif", Geist')])
    const first=node.firstChild?.firstChild
    if(!first)throw new Error("text-required")
    first.textContent="Edited Sans"
    expect(editableRuns(node,runs)).toEqual([{...runs[0],text:"Edited Sans"},runs[1]])
    const [firstRun,...rest]=runs
    const updated: [Run,...Run[]]=[{...firstRun,font:"Geist"},...rest.map(run=>({...run,font:"Geist"}))]
    canonicalChildren(node,updated)
    expect([...node.children].every(span=>span.getAttribute("style")?.includes("font-family: Geist"))).toBe(true)
    expect(editableRuns(node,updated)).toEqual(updated)
  } finally {
    if(original)Object.defineProperty(globalThis,"document",original)
    else Reflect.deleteProperty(globalThis,"document")
    window.happyDOM.abort()
  }
})
