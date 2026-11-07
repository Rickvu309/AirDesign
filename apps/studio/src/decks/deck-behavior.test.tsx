import {act} from "react"
import {createRoot} from "react-dom/client"
import {expect,it,vi} from "vitest"
import {fixtureDeck} from "../../../../packages/deck/src/fixture.ts"
import {Workspace} from "./workspace.tsx"

const state=vi.hoisted(()=>({deleted:false,undo:undefined as undefined|(()=>void),actions:vi.fn()}))
vi.mock("@airdesign/ui",async original=>({...await original<typeof import("@airdesign/ui")>(),toast:vi.fn((_message:string,options:{action?:{onClick:()=>void}})=>{state.undo=options.action?.onClick})}))
vi.mock("../editor/manual-editor.tsx",()=>({ManualEditor:()=>null}))
vi.mock("../import/import-card.tsx",()=>({ImportCard:()=>null}))
vi.mock("./catalog-client.ts",()=>({api:vi.fn(),createDeck:vi.fn(),listDecks:async()=>state.deleted ? [] : [{id:"newer",title:"Zebra",slides:1,updated:2000,created:1000,starred:false,deletedAt:null,generation:0,preview:{slide:fixtureDeck(1).slides[0],themes:[]}},{id:"older",title:"Alpha",slides:1,updated:1000,created:1000,starred:false,deletedAt:null,generation:0,preview:{slide:fixtureDeck(1).slides[0],themes:[]}}],deckAction:async(id:string,action:string,body?:unknown)=>{state.actions(id,action,...(body ? [body] : []));state.deleted=action==="trash"}}))

it("AD-08 keeps All decks in last-edited order and renders native slide contents",async()=>{
  history.replaceState(null,"","/?browse=all")
  const container=document.createElement("div"),root=createRoot(container);document.body.append(container)
  try{await act(async()=>root.render(<Workspace/>));expect([...container.querySelectorAll(".deck-card h2")].map(node=>node.textContent)).toEqual(["Zebra","Alpha"]);expect(container.querySelectorAll("[data-slide]")).toHaveLength(2)}finally{await act(async()=>root.unmount());container.remove();history.replaceState(null,"","/")}
})
it("AD-09 restores the same deck through the moved-to-Trash toast action",async()=>{
  state.deleted=false;state.undo=undefined;state.actions.mockClear()
  const container=document.createElement("div"),root=createRoot(container);document.body.append(container)
  try{
    await act(async()=>root.render(<Workspace/>))
    const menu=container.querySelector<HTMLElement>('.deck-card-actions summary');if(menu)await act(async()=>menu.click())
    await act(async()=>[...container.querySelectorAll("button")].find(node=>node.textContent==="Move to Trash")!.click())
    const confirm=document.querySelector<HTMLButtonElement>('[role="dialog"] .ad-button-danger');if(confirm)await act(async()=>confirm.click())
    expect(state.undo).toBeTypeOf("function")
    await act(async()=>state.undo!())
    expect(state.actions).toHaveBeenLastCalledWith("newer","restore")
    expect(container.querySelector("h2")?.textContent).toBe("Zebra")
  }finally{await act(async()=>root.unmount());container.remove();state.deleted=false}
})

it("submits Rename through Enter or Save once, ignores IME and invalid names, and restores focus",async()=>{
  state.deleted=false;state.actions.mockClear()
  const container=document.createElement("div"),root=createRoot(container);document.body.append(container)
  try{
    await act(async()=>root.render(<Workspace/>))
    const trigger=container.querySelector<HTMLElement>('.deck-card-actions summary')!
    async function open(){await act(async()=>trigger.click());await act(async()=>[...container.querySelectorAll("button")].find(node=>node.textContent==="Rename")!.click())}
    async function name(value:string){const input=document.querySelector<HTMLInputElement>('[aria-label="Deck name"],input')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,value);input.dispatchEvent(new Event("input",{bubbles:true}))});return input}
    await open()
    let input=await name("   ")
    await act(async()=>input.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true})))
    expect(state.actions).not.toHaveBeenCalled()
    await act(async()=>[...document.querySelectorAll("button")].find(node=>node.textContent==="Save name")!.click())
    expect(state.actions).not.toHaveBeenCalled()
    input=await name("A".repeat(201))
    await act(async()=>input.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true})))
    expect(state.actions).not.toHaveBeenCalled()
    input=await name("  Revised title  ")
    await act(async()=>input.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true,isComposing:true})))
    expect(state.actions).not.toHaveBeenCalled()
    await act(async()=>input.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",keyCode:229,bubbles:true})))
    expect(state.actions).not.toHaveBeenCalled()
    await act(async()=>{input.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));input.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}))})
    expect(state.actions.mock.calls).toEqual([["newer","rename",{title:"Revised title"}]])
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    await open();await name("Button title")
    await act(async()=>[...document.querySelectorAll("button")].find(node=>node.textContent==="Save name")!.click())
    expect(state.actions).toHaveBeenLastCalledWith("newer","rename",{title:"Button title"})
  }finally{await act(async()=>root.unmount());container.remove()}
})
