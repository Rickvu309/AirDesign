import {it,expect} from "vitest"
import {commandId} from "../../../../packages/change-log/src/index.ts"
import {randomBytes} from "node:crypto"
import sharp from "sharp"
import {mcpFixture,toolValue} from "./fixture.ts"
import {fixtureDeck} from "../../../../packages/deck/src/fixture.ts"
import {validateImage} from "../../../../packages/files/src/assets/validate.ts"
it("starts explicit requests after person edits and restricts undo to the originating connection",async()=>{
  const f=await mcpFixture()
  try{
    const owner=await f.signIn("epochs@example.com"),a=await f.authorize(owner.cookie),b=await f.authorize(owner.cookie)
    await f.history.create(owner,fixtureDeck(1))
    const edit=async(requestId:string,base:number,notes:string)=>toolValue(await a.client.callTool({name:"apply_changes",arguments:{deckId:"deck",requestId,base,changes:[{kind:"set",target:"s0",value:{...(await f.history.read(owner,"deck")).deck.slides[0],notes}}]}}))
    const first=await edit("first",0,"remote")
    expect(first.kind).toBe("applied")
    const oldRun=(await f.history.read(owner,"deck")).contributions.history.runs[0]!.id
    await f.json("/api/decks/deck/commands",{id:"person",kind:"patch",base:1,run:null,target:"s0",fields:{notes:"person"}},owner.cookie)
    const personSlide=(await f.history.read(owner,"deck")).deck.slides[0]!
    expect(await f.history.commit(owner,"deck",{id:commandId("old_late"),kind:"patch",base:2,run:oldRun,target:personSlide.id,fields:{notes:"old overwrite"}},{kind:"run",run:oldRun})).toMatchObject({kind:"refused",code:"person-protected"})
    expect((await edit("second",2,"new explicit request")).kind).toBe("applied")
    expect((await b.client.callTool({name:"undo_change",arguments:{deckId:"deck",base:3,changeId:first.changeId,requestId:"steal"}})).isError).toBe(true)
    const second=(await f.history.read(owner,"deck")).contributions.history.events.at(-1)
    expect(toolValue(await a.client.callTool({name:"undo_change",arguments:{deckId:"deck",base:3,changeId:second?.id,requestId:"undo"}})).kind).toBe("applied")
    const final=await f.history.read(owner,"deck")
    expect(final.deck.slides[0]?.notes).toBe("person")
    expect(final.contributions.history.runs.map(run=>run.epoch)).toEqual([0,2,3])
    expect(new Set(final.contributions.history.runs.map(run=>run.id)).size).toBe(3)
  }finally{await f.close()}
},60000)
it("allows theme-only changes at exhaustion but refuses disguised content edits",async()=>{
  const f=await mcpFixture()
  try{
    const owner=await f.signIn("themes@example.com"),a=await f.authorize(owner.cookie),deck=fixtureDeck(1)
    await f.history.create(owner,deck)
    await f.history.usage.reserve(owner.personId,{id:"fill",actor:"user-agent",request:"fill",units:10000})
    const themed={...deck,themes:deck.themes.map(theme=>({...theme,background:"#123456"}))}
    expect(toolValue(await a.client.callTool({name:"apply_changes",arguments:{deckId:"deck",base:0,requestId:"theme",changes:[{kind:"set",target:"deck",value:themed}]}})).kind).toBe("applied")
    expect((await f.history.usage.status(owner.personId)).used).toBe(10000)
    const mixed={...themed,slides:themed.slides.map(slide=>({...slide,notes:"charged"}))}
    expect(toolValue(await a.client.callTool({name:"apply_changes",arguments:{deckId:"deck",base:1,requestId:"mixed",changes:[{kind:"set",target:"deck",value:mixed}]}})).kind).toBe("out-of-usage")
  }finally{await f.close()}
},60000)
it("returns JSX complete nodes with paging and oversized continuation",async()=>{
  const f=await mcpFixture()
  try{
    const owner=await f.signIn("jsx@example.com"),a=await f.authorize(owner.cookie),deck=fixtureDeck(4)
    const text=deck.slides[0]?.elements[0];if(text?.kind!=="text")throw new Error("text-required")
    text.runs[0]!.text="雪<>&".repeat(10000)
    await f.history.create(owner,deck)
    const args={deckId:"deck",slideId:"s0",format:"jsx",limit:1}
    const first=toolValue(await a.client.callTool({name:"get_slide",arguments:args}))
    expect(first.items[0].resource).toContain("airdesign://snapshots/")
    expect(first.nextCursor).toBeTruthy()
    const second=toolValue(await a.client.callTool({name:"get_slide",arguments:{...args,cursor:first.nextCursor}}))
    expect(second.items[0].jsx).toContain("<")
    expect(Buffer.byteLength(JSON.stringify(second))).toBeLessThan(19500)
    expect((await a.client.readResource({uri:first.items[0].resource})).contents.length).toBeGreaterThan(0)
  }finally{await f.close()}
},60000)
it("bounds high entropy capture and exposes only owned expiring full resolution",async()=>{
  const f=await mcpFixture()
  try{
    const owner=await f.signIn("capture@example.com"),a=await f.authorize(owner.cookie),deck=fixtureDeck(1)
    const image=await validateImage(await sharp(randomBytes(960*540*3),{raw:{width:960,height:540,channels:3}}).png().toBuffer())
    await f.history.images.adopt(owner,image,{kind:"upload",source:"Personal upload",license:"User supplied"})
    const element=deck.slides[0]!.elements[0]!
    deck.slides[0]!.elements=[{...element,kind:"image",box:{x:0,y:0,width:960,height:540},image:{asset:image.hash,crop:{x:0,y:0,width:1,height:1},focal:{x:0.5,y:0.5},mask:"rectangle",alt:"noise"}}]
    await f.history.create(owner,deck)
    const result=await a.client.callTool({name:"capture_slide",arguments:{deckId:"deck",slideId:"s0",savedVersion:0,width:960}})
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(500000)
    const meta=toolValue(result)
    expect(meta.resource).toContain("airdesign://captures/")
    expect((await a.client.readResource({uri:meta.resource})).contents.length).toBeGreaterThan(0)
    const other=await f.signIn("capture-other@example.com"),b=await f.authorize(other.cookie)
    await expect(b.client.readResource({uri:meta.resource})).rejects.toThrow()
    f.advance(16*60000)
    await expect(a.client.readResource({uri:meta.resource})).rejects.toThrow()
  }finally{await f.close()}
},60000)
it("pages newest financial events without losing equal-time entries",async()=>{
  const f=await mcpFixture()
  try{
    const owner=await f.signIn("events@example.com")
    for(let i=0;i<105;i++)await f.history.usage.grantFixture(owner.personId,`grant-${i}`,1,"paid")
    f.advance(1)
    await f.history.usage.grantFixture(owner.personId,"newest",1,"paid")
    const first=await (await f.json("/api/usage/history",undefined,owner.cookie)).json()
    expect(first.items[0].id).toBe("grant:newest")
    const second=await (await f.json(`/api/usage/history?cursor=${encodeURIComponent(first.nextCursor)}`,undefined,owner.cookie)).json()
    expect(new Set([...first.items,...second.items].map(item=>item.id)).size).toBe(106)
    expect(second.nextCursor).toBe(null)
  }finally{await f.close()}
},60000)
