import {act} from "react"
import {createRoot} from "react-dom/client"
import {afterEach,expect,it,vi} from "vitest"
import {basics} from "../../../../packages/brand/src/index.ts"
import {execute,initialHistory,type Command,type History} from "../../../../packages/change-log/src/index.ts"
import {fixtureDeck} from "../../../../packages/deck/src/fixture.ts"
import {clipboardSource} from "./editor-model.ts"
import {ManualEditor} from "./manual-editor.tsx"

const mock=vi.hoisted(()=>({value:{} as unknown,toast:vi.fn()}))
vi.mock("./use-deck.ts",()=>({useDeck:()=>mock.value}))
vi.mock("../../../../packages/render/src/fonts.ts",()=>({waitForFonts:()=>Promise.resolve(),fontReport:()=>({missing:[]})}))
vi.mock("../export/export-dialog.tsx",()=>({ExportDialog:()=>null}))
vi.mock("@airdesign/ui",async original=>({...await original<typeof import("@airdesign/ui")>(),toast:{success:mock.toast}}))
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();mock.toast.mockReset()})
async function editor(deck=fixtureDeck(1,2)) {
  vi.stubGlobal("matchMedia",()=>({matches:false,addEventListener:()=>{},removeEventListener:()=>{}}))
  vi.stubGlobal("fetch",()=>Promise.resolve(Response.json({templates:basics,default:basics[0]})))
  vi.stubGlobal("EventSource",class {close(){}})
  let history:History=initialHistory(deck)
  const commands:Command[]=[]
  const sync={get deck(){return history.deck},get seq(){return history.seq},get history(){return history},state:{kind:"saved"},queue:[],historyTarget:(direction:string)=>history.events.findLast(event=>event.active===(direction==="undo"))?.id ?? null,enqueue:async(command:Command)=>{commands.push(command);const result=execute(history,command);expect(result.receipt.kind).toBe("applied");history=result.history}}
  mock.value={sync,entry:{title:"Strategy"},setError:vi.fn()}
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  const render=async()=>{await act(async()=>root.render(<ManualEditor deckId="deck"/>))}
  await render()
  const button=(name:string)=>[...container.querySelectorAll("button")].find(button=>button.getAttribute("aria-label")===name || button.textContent?.trim()===name)!
  const click=async(name:string)=>{expect(button(name)).toBeDefined();await act(async()=>button(name).click());await render()}
  const close=async()=>{await act(async()=>root.unmount());container.remove()}
  return {container,button,click,render,close,sync,commands}
}
it("AD-11 navigates between real slides from the single-slide filmstrip",async()=>{
  const ui=await editor();try{await ui.click("Single slide view");expect(ui.container.querySelectorAll('.editor-filmstrip button')).toHaveLength(2);await ui.click("Go to slide 2");expect(ui.container.querySelector('.editor-slide:not([hidden]) [data-slide]')?.getAttribute("data-slide")).toBe("s1");expect(ui.button("Go to slide 2").getAttribute("aria-current")).toBe("page")}finally{await ui.close()}
})
it("AD-12 and AD-13 add a native shape and styled text through undoable commands",async()=>{
  const ui=await editor();try{
    await ui.click("Shapes");expect(ui.button("Shapes").disabled).toBe(false);await ui.click("Rectangle");expect(ui.sync.deck.slides[0]?.elements.at(-1)).toMatchObject({kind:"shape",geometry:"rectangle"})
    await ui.click("Edit slide text");await ui.click("Add text box");expect(ui.sync.deck.slides[0]?.elements.at(-1)).toMatchObject({kind:"text",runs:[{text:"Add your text",size:20}]})
    await ui.click("Title");expect(ui.sync.deck.slides[0]?.elements.at(-1)).toMatchObject({kind:"text",runs:[{text:"Title",size:40,bold:true}]})
    await act(async()=>document.dispatchEvent(new KeyboardEvent("keydown",{key:"z",ctrlKey:true,bubbles:true})));await ui.render();expect(ui.sync.deck.slides[0]?.elements).toHaveLength(3)
  }finally{await ui.close()}
})
it("AD-15 pastes clipboard slides and the toast undoes only that paste after a later edit",async()=>{
  const ui=await editor();try{
    const event=new Event("paste",{bubbles:true,cancelable:true});Object.defineProperty(event,"clipboardData",{value:{getData:()=>clipboardSource(fixtureDeck(1,2),[fixtureDeck(1,2).slides[0]!.id])}})
    await act(async()=>ui.container.querySelector('.studio-editor')!.dispatchEvent(event));await ui.render();expect(ui.sync.deck.slides).toHaveLength(3)
    expect(mock.toast).toHaveBeenCalledWith("1 slide pasted",expect.objectContaining({action:expect.objectContaining({label:"Undo"})}))
    const paste=ui.commands[0]!.id;await ui.click("+ New slide");expect(ui.sync.deck.slides).toHaveLength(4)
    const options=mock.toast.mock.calls[0]![1] as {action:{onClick:()=>void}}
    await act(async()=>options.action.onClick());await ui.render();expect(ui.commands.at(-1)).toMatchObject({kind:"undo",target:paste});expect(ui.sync.deck.slides).toHaveLength(3)
  }finally{await ui.close()}
})
it("keeps grid previews static and enables text editing in single-slide view",async()=>{
  const ui=await editor();try{
    expect(ui.container.querySelectorAll('[contenteditable="true"]')).toHaveLength(0)
    await ui.click("Single slide view");expect(ui.container.querySelector('.editor-slide:not([hidden]) [contenteditable="true"]')).not.toBeNull()
    await ui.click("Grid view");expect(ui.container.querySelectorAll('[contenteditable="true"]')).toHaveLength(0)
  }finally{await ui.close()}
})
it("opens and closes the change history from the deck menu",async()=>{
  const ui=await editor();try{
    await ui.click("Single slide view");await ui.click("Strategy⌄");await ui.click("Review changes")
    expect(ui.container.querySelector<HTMLDetailsElement>(".editor-changes")?.open).toBe(true)
    await ui.click("Strategy⌄");await ui.click("Review changes");expect(ui.container.querySelector<HTMLDetailsElement>(".editor-changes")?.open).toBe(false)
  }finally{await ui.close()}
})
it("AD-16 preserves keyboard undo and redo after deleting the focused slide",async()=>{
  const ui=await editor();try{
    await ui.click("Slide 1");ui.button("Slide 1").focus();await act(async()=>ui.button("Slide 1").dispatchEvent(new KeyboardEvent("keydown",{key:"Delete",bubbles:true})));await ui.render();expect(ui.sync.deck.slides).toHaveLength(1)
    expect(document.activeElement).toBe(ui.container.querySelector('.studio-editor'))
    await act(async()=>document.activeElement!.dispatchEvent(new KeyboardEvent("keydown",{key:"z",ctrlKey:true,bubbles:true})));await ui.render();expect(ui.sync.deck.slides).toHaveLength(2)
    await act(async()=>document.activeElement!.dispatchEvent(new KeyboardEvent("keydown",{key:"z",ctrlKey:true,shiftKey:true,bubbles:true})));await ui.render();expect(ui.sync.deck.slides).toHaveLength(1)
  }finally{await ui.close()}
})
it("holds New slide to choose one of six undoable native layouts",async()=>{
  const ui=await editor();try{
    vi.useFakeTimers();await act(async()=>{ui.button("+ New slide").dispatchEvent(new MouseEvent("pointerdown",{button:0,bubbles:true}));vi.advanceTimersByTime(450)});await ui.render();expect(ui.container.querySelectorAll('.layout-choice')).toHaveLength(6)
    await ui.click("Two columns");expect(ui.sync.deck.slides).toHaveLength(3);expect(ui.sync.deck.slides.at(-1)?.elements).toHaveLength(3)
  }finally{await ui.close()}
})
it("inserts Chart, Table and Icon as native grouped elements",async()=>{
  const ui=await editor();try{for(const name of ["Chart","Table","Icon"]){await ui.click("Actions");await ui.click(name);expect(ui.sync.deck.slides[0]?.elements.at(-1)).toMatchObject({kind:"group"})}expect(ui.commands).toHaveLength(3)}finally{await ui.close()}
})
it("fits inserted text and grouped tables to an imported slide’s dimensions",async()=>{
  const deck=fixtureDeck(0,1);deck.slides[0]!.size={width:480,height:270}
  const ui=await editor(deck);try{
    await ui.click("Edit slide text");await ui.click("Title");expect(ui.sync.deck.slides[0]?.elements[0]).toMatchObject({box:{x:48,y:60,width:300},runs:[{size:20}]})
    await ui.click("Actions");await ui.click("Table");const table=ui.sync.deck.slides[0]?.elements[1];expect(table).toMatchObject({kind:"group",box:{x:48,y:80,width:150,height:100}});if(table?.kind==="group"){expect(table.children[0]).toMatchObject({box:{width:48,height:22},runs:[{size:9}]});expect(table.children[2]?.box.x).toBe(100)}
  }finally{await ui.close()}
})
it("AD-14 changes selected-slide colors and background through keyboard undo",async()=>{
  const ui=await editor();try{
    await ui.click("Slide 1");await ui.click("Design")
    const color=async(label:string,value:string)=>{const input=ui.container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;expect(input).not.toBeNull();await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,value);input.dispatchEvent(new Event("input",{bubbles:true}))});await ui.render()}
    await color("Slide background","#123456");expect(ui.sync.deck.slides[0]?.background).toBe("#123456");expect(ui.sync.deck.slides[1]?.elements).toHaveLength(1)
    await act(async()=>document.dispatchEvent(new KeyboardEvent("keydown",{key:"z",ctrlKey:true,bubbles:true})));await ui.render();expect(ui.sync.deck.slides[0]?.elements).toHaveLength(1)
    await color("Navy color","#abcdef");expect(ui.sync.deck.slides[0]?.elements[0]).toMatchObject({kind:"text",runs:[{color:"#abcdef"}]});await act(async()=>document.dispatchEvent(new KeyboardEvent("keydown",{key:"z",ctrlKey:true,bubbles:true})));await ui.render();expect(ui.container.querySelector<HTMLInputElement>('input[aria-label="Navy color"]')?.value).toBe("#172333")
  }finally{await ui.close()}
})

it("browses and inserts native flowchart shapes through undoable commands",async()=>{
  const ui=await editor();try{
    await ui.click("Shapes");await ui.click("More shapes");expect(ui.container.textContent).toContain("Flowchart")
    await ui.click("Database");expect(ui.sync.deck.slides[0]?.elements.at(-1)).toMatchObject({kind:"shape",geometry:"flowDatabase"})
    await act(async()=>document.dispatchEvent(new KeyboardEvent("keydown",{key:"z",ctrlKey:true,bubbles:true})));await ui.render();expect(ui.sync.deck.slides[0]?.elements).toHaveLength(1)
  }finally{await ui.close()}
})

it("keeps a surviving slide visible after insertion undo, redo and deletion",async()=>{
  const ui=await editor();try{
    await ui.click("Single slide view");await ui.click("+ New slide");await act(async()=>document.dispatchEvent(new KeyboardEvent("keydown",{key:"z",ctrlKey:true,bubbles:true})));await ui.render();
    expect(ui.container.querySelectorAll('.editor-slide:not([hidden])')).toHaveLength(1)
    expect(ui.container.querySelector('.editor-slide:not([hidden]) [data-slide]')?.getAttribute("data-slide")).toBe("s0")
    await act(async()=>document.dispatchEvent(new KeyboardEvent("keydown",{key:"z",ctrlKey:true,shiftKey:true,bubbles:true})));await ui.render();expect(ui.sync.deck.slides).toHaveLength(3)
    await ui.click("Go to slide 3");await act(async()=>ui.container.querySelector(".studio-editor")!.dispatchEvent(new KeyboardEvent("keydown",{key:"Delete",bubbles:true})));await ui.render()
    expect(ui.sync.deck.slides).toHaveLength(2)
    expect(ui.container.querySelectorAll('.editor-slide:not([hidden])')).toHaveLength(1)
    await act(async()=>document.dispatchEvent(new KeyboardEvent("keydown",{key:"z",ctrlKey:true,bubbles:true})));await ui.render();expect(ui.sync.deck.slides).toHaveLength(3)
  }finally{await ui.close()}
})

it("moves and resizes selected objects through history and exposes Aira attachment scope",async()=>{
  const ui=await editor();try{
    await ui.click("Shapes");await ui.click("Rectangle")
    const element=ui.sync.deck.slides[0]!.elements.at(-1)!,original={...element.box}
    expect(ui.button("Resize selected object")).toBeDefined()
    await act(async()=>ui.container.querySelector(".studio-editor")!.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true})));await ui.render()
    expect(ui.sync.deck.slides[0]!.elements.at(-1)!.box.x).toBe(original.x+1)
    await act(async()=>document.dispatchEvent(new KeyboardEvent("keydown",{key:"z",ctrlKey:true,bubbles:true})));await ui.render()
    expect(ui.sync.deck.slides[0]!.elements.at(-1)!.box).toEqual(original)
    await act(async()=>document.dispatchEvent(new KeyboardEvent("keydown",{key:"z",ctrlKey:true,shiftKey:true,bubbles:true})));await ui.render()
    expect(ui.sync.deck.slides[0]!.elements.at(-1)!.box.x).toBe(original.x+1)
    await act(async()=>ui.button("Resize selected object").dispatchEvent(new MouseEvent("pointerdown",{clientX:0,clientY:0,button:0,bubbles:true})))
    await act(async()=>window.dispatchEvent(new MouseEvent("pointerup",{clientX:40,clientY:30,button:0,bubbles:true})));await ui.render()
    expect(ui.sync.deck.slides[0]!.elements.at(-1)!.box).toMatchObject({width:original.width+40,height:original.height+30})
    expect(ui.commands.at(-1)).toMatchObject({kind:"patch",target:element.id})
    await ui.click("Agent");expect(ui.container.querySelector(".aira-attachments")?.textContent).toContain("Rectangle")
  }finally{await ui.close()}
})

