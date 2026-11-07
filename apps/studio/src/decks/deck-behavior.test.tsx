import {act} from "react"
import {createRoot} from "react-dom/client"
import {expect,it,vi} from "vitest"
import {fixtureDeck} from "../../../../packages/deck/src/fixture.ts"
import {Workspace} from "./workspace.tsx"

const state=vi.hoisted(()=>({deleted:false,undo:undefined as undefined|(()=>void),actions:vi.fn()}))
vi.mock("@airdesign/ui",async original=>({...await original<typeof import("@airdesign/ui")>(),toast:vi.fn((_message:string,options:{action?:{onClick:()=>void}})=>{state.undo=options.action?.onClick})}))
vi.mock("../editor/manual-editor.tsx",()=>({ManualEditor:()=>null}))
vi.mock("../import/import-card.tsx",()=>({ImportCard:()=>null}))
vi.mock("./catalog-client.ts",()=>({api:vi.fn(),createDeck:vi.fn(),listDecks:async()=>state.deleted ? [] : [{id:"newer",title:"Zebra",slides:1,updated:2000,created:1000,starred:false,deletedAt:null,generation:0,preview:{slide:fixtureDeck(1).slides[0],themes:[]}},{id:"older",title:"Alpha",slides:1,updated:1000,created:1000,starred:false,deletedAt:null,generation:0,preview:{slide:fixtureDeck(1).slides[0],themes:[]}}],deckAction:async(id:string,action:string)=>{state.actions(id,action);state.deleted=action==="trash"}}))

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
