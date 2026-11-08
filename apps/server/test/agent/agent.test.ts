import {claudeAdapter,type SdkQuery} from "../../../../packages/agent/src/sdk-adapter.ts"
import {expect,it,vi} from "vitest"
import {fixtureDeck} from "../../../../packages/deck/src/fixture.ts"
import {commandId} from "../../../../packages/change-log/src/index.ts"
import {localAdapter} from "../../../../packages/agent/src/local-adapter.ts"
import {agentSdkPin,type AgentAdapter} from "../../../../packages/agent/src/harness.ts"
import {mcpFixture,toolValue} from "../mcp/fixture.ts"
import {deferred,eventStream} from "./stream.ts"
import {brandedRuns,fontDeck} from "./font-fixture.ts"
it("applies the pinned font to selected text, meters Aira, rejects foreign or invalid scope atomically and undoes without losing later human work",async()=>{
  const fixture=await mcpFixture()
  try{
    const owner=await fixture.signIn("aira-owner@example.com"),other=await fixture.signIn("aira-other@example.com")
    expect(agentSdkPin).toBe("0.2.31")
    const deck=fontDeck()
    await fixture.json("/api/decks",deck,owner.cookie)
    expect((await fixture.json("/api/aira?deck=deck",{action:"send",text:"forged"},other.cookie)).status).toBe(400)
    const stream=await eventStream(fixture.origin+"/api/aira/events?deck=deck",owner.cookie)
    try{
      const initial=await stream.next();expect(initial.run).toBeNull()
      const started=await (await fixture.json("/api/aira?deck=deck",{action:"send",text:"Selected content",selection:["s0e0"]},owner.cookie)).json()
      let final=await stream.next();while(final.run?.kind!=="complete"&&final.run?.kind!=="failed")final=await stream.next()
      expect(final.run.kind).toBe("complete");expect(final.run.id).toBe(started.id)
      expect(final.run.request).toBe("Selected content")
      expect(final.remote).toEqual([])
      expect(final.run.events.filter((event:{name:string})=>event.name==="apply_changes")).toMatchObject([{scope:"s0"}])
      let saved=await fixture.history.read({personId:owner.personId},"deck")
      expect(saved.deck.slides[0]?.elements).toEqual([{...deck.slides[0]!.elements[0],runs:brandedRuns},...deck.slides[0]!.elements.slice(1)])
      expect(saved.deck.slides[0]?.notes).toBe(deck.slides[0]!.notes)
      expect(saved.deck.slides[1]).toEqual(deck.slides[1])
      expect((await fixture.history.usage.status(owner.personId)).used).toBe(3)
      const human=await fixture.history.commit({personId:owner.personId},"deck",{id:commandId("human_after"),kind:"patch",target:saved.deck.slides[0]!.elements[0]!.id,fields:{runs:[{text:"Keep my words",bold:true,font:"Geist",size:40,color:"#172333"}]},base:saved.seq,run:null})
      if(human.kind!=="applied")throw new Error(JSON.stringify(human))
      const undone=await (await fixture.json("/api/aira?deck=deck",{action:"undo"},owner.cookie)).json()
      expect(undone.kind).toBe("applied");expect(undone.kept).toContain("s0e0")
      saved=await fixture.history.read({personId:owner.personId},"deck");expect(saved.deck.slides[0]?.elements[0]).toMatchObject({runs:[{text:"Keep my words"}]})
      const used=(await fixture.history.usage.status(owner.personId)).used
      const beforeInvalid=await fixture.history.read({personId:owner.personId},"deck")
      await fixture.json("/api/aira?deck=deck",{action:"send",text:"Must not change",selection:["s1e0","missing"]},owner.cookie)
      final=await stream.next();while(final.run?.kind!=="failed")final=await stream.next()
      expect(final.run.events.at(-1).text).toContain("selection-not-in-deck")
      expect((await fixture.history.usage.status(owner.personId)).used).toBe(used)
      expect((await fixture.history.read({personId:owner.personId},"deck")).deck).toEqual({...beforeInvalid.deck,version:expect.any(Number)})
    }finally{await stream.close()}
  }finally{await fixture.close()}
})
it("joins a second tab, protects human edits, retains commits on failure, resumes once and stops when disabled while remote access stays available",async()=>{
  const entered=deferred(),release=deferred();let attempts=0
  const adapter:AgentAdapter=async function*(context,call,signal){
    attempts++
    let writes=0
    for await(const event of localAdapter(context,call,signal)){
      yield event
      if(event.kind==="tool"&&event.name==="apply_changes"&&++writes===1&&attempts===1){entered.resolve();await release.promise;throw new Error("fixture-interrupted")}
    }
  }
  const fixture=await mcpFixture({agentAdapter:adapter})
  try{
    const owner=await fixture.signIn("aira-steer@example.com"),deck=fontDeck();await fixture.json("/api/decks",deck,owner.cookie)
    const remote=await fixture.authorize(owner.cookie)
    const stream=await eventStream(fixture.origin+"/api/aira/events?deck=deck",owner.cookie)
    try{
      await stream.next()
      const started=await (await fixture.json("/api/aira?deck=deck",{action:"send",text:"Initial request",selection:[]},owner.cookie)).json()
      await entered.promise
      const joined=await (await fixture.json("/api/aira?deck=deck",{action:"send",text:"Steer remaining slides",selection:[]},owner.cookie)).json()
      expect(joined).toMatchObject({id:started.id,joined:true})
      release.resolve()
      let value=await stream.next();while(value.run?.kind!=="failed")value=await stream.next()
      expect(value.run.events.at(-1).text).toContain("Changes so far stay")
      const updated=await fixture.history.read({personId:owner.personId},"deck")
      expect(updated.deck.slides[0]).toMatchObject({notes:deck.slides[0]!.notes,elements:[{runs:brandedRuns},deck.slides[0]!.elements[1],{runs:[{text:"Keep supporting detail",font:"Geist"}]}]})
      expect(updated.deck.slides[1]).toEqual(deck.slides[1])
      expect(value.run.request).toBe("Steer remaining slides")
      expect((await fixture.history.usage.status(owner.personId)).used).toBe(3)
      await fixture.json("/api/aira?deck=deck",{action:"resume"},owner.cookie)
      value=await stream.next();while(value.run?.kind!=="complete")value=await stream.next()
      expect(value.run.id).toBe(started.id)
      expect(value.run.events.filter((event:{name:string})=>event.name==="apply_changes")).toHaveLength(2)
      expect((await fixture.history.usage.status(owner.personId)).used).toBe(6)
      const saved=await fixture.history.read({personId:owner.personId},"deck")
      expect(saved.deck.slides[0]).toEqual(updated.deck.slides[0])
      expect(saved.deck.slides[1]).toMatchObject({notes:deck.slides[1]!.notes,elements:[{runs:brandedRuns},deck.slides[1]!.elements[1],{runs:[{text:"Keep supporting detail",font:"Geist"}]}]})
      expect(value.run.request).toBe("Steer remaining slides")
      await fixture.json("/api/aira/configure",{enabled:false},owner.cookie)
      expect((await fixture.json("/api/aira?deck=deck",{action:"send",text:"Nope"},owner.cookie)).status).toBe(400)
      const read=toolValue(await remote.client.callTool({name:"get_deck",arguments:{deckId:"deck"}}));expect(read.items).toHaveLength(2)
      const write=await remote.client.callTool({name:"apply_changes",arguments:{deckId:"deck",base:saved.seq,requestId:"remote_notes",changes:[{kind:"set",target:"s1",value:{...saved.deck.slides[1],notes:"Remote contribution"}}]}})
      expect(write.isError).not.toBe(true)
      value=await stream.next();while(!value.remote.some((event:{run:string})=>event.run!==started.id))value=await stream.next()
      expect(value.remote.length).toBeGreaterThan(0)
      expect((await fixture.history.usage.status(owner.personId)).used).toBe(7)
    }finally{release.resolve();await stream.close()}
  }finally{await fixture.close()}
})
it("cancels the active run without later commits and creates an editable first slide",async()=>{
  const entered=deferred(),adapter:AgentAdapter=async function*(context,call,signal){
    for await(const event of localAdapter(context,call,signal)){yield event;if(event.kind==="tool"&&event.name==="apply_changes"){entered.resolve();await new Promise<void>(resolve=>{if(signal.aborted)resolve();else signal.addEventListener("abort",()=>resolve(),{once:true})})}}
  }
  const fixture=await mcpFixture({agentAdapter:adapter})
  try{
    const owner=await fixture.signIn("aira-stop@example.com"),deck=fixtureDeck(2,0)
    await fixture.json("/api/decks",deck,owner.cookie)
    await fixture.json("/api/aira?deck=deck",{action:"send",text:"An executive overview",selection:[]},owner.cookie)
    await entered.promise
    const stopped=await (await fixture.json("/api/aira?deck=deck",{action:"stop"},owner.cookie)).json();expect(stopped.kind).toBe("stopped")
    const saved=await fixture.history.read({personId:owner.personId},"deck");expect(saved.deck.slides).toHaveLength(1);expect(saved.deck.slides[0]).toMatchObject({notes:"",elements:[{kind:"text",runs:[{text:"New presentation",font:"Geist"}]}]})
    expect((await fixture.history.usage.status(owner.personId)).used).toBe(3)
    expect((await (await fixture.json("/api/aira?deck=deck",undefined,owner.cookie)).json()).run).toMatchObject({kind:"stopped",request:"An executive overview"})
    expect((await fixture.history.read({personId:owner.personId},"deck")).seq).toBe(saved.seq)
    const title=saved.deck.slides[0]!.elements[0]!
    const edited=await fixture.history.commit({personId:owner.personId},"deck",{id:commandId("edit_stopped_title"),kind:"patch",target:title.id,fields:{runs:[{text:"An executive overview",bold:true,font:"Geist",size:40,color:"#111827"}]},base:saved.seq,run:null})
    expect(edited.kind).toBe("applied")
    expect((await fixture.history.read({personId:owner.personId},"deck")).deck.slides[0]?.elements[0]).toMatchObject({runs:[{text:"An executive overview"}]})
  }finally{await fixture.close()}
})
it("does not report refused commits as completed and resumes the saved request after weekly usage returns",async()=>{
  const fixture=await mcpFixture()
  try{
    const owner=await fixture.signIn("aira-exhausted@example.com"),deck=fontDeck(1);await fixture.json("/api/decks",deck,owner.cookie)
    await fixture.history.usage.reserve(owner.personId,{id:"fill",actor:"user-agent",request:"fill",units:10000})
    const stream=await eventStream(fixture.origin+"/api/aira/events?deck=deck",owner.cookie)
    try{
      await stream.next();await fixture.json("/api/aira?deck=deck",{action:"send",text:"Saved after limit"},owner.cookie)
      let value=await stream.next();while(value.run?.kind!=="limited")value=await stream.next()
      expect(value.run.events.filter((event:{name?:string})=>event.name==="apply_changes")).toHaveLength(0)
      expect((await fixture.history.read({personId:owner.personId},"deck")).deck).toEqual({...deck,version:expect.any(Number)})
      expect(value.run.request).toBe("Saved after limit")
      expect(await fixture.history.agents.latest(owner.personId,"deck")).toMatchObject({id:value.run.id,kind:"limited",request:"Saved after limit",completed:[]})
      const run=value.run.id;fixture.advance(7*86400000)
      await fixture.json("/api/aira?deck=deck",{action:"resume"},owner.cookie)
      value=await stream.next();while(value.run?.kind!=="complete")value=await stream.next()
      expect(value.run.id).toBe(run);expect(value.run.events.filter((event:{name?:string})=>event.name==="apply_changes")).toHaveLength(1)
      const updated=await fixture.history.read({personId:owner.personId},"deck")
      expect(updated.deck.slides[0]).toMatchObject({notes:deck.slides[0]!.notes,elements:[{runs:brandedRuns},deck.slides[0]!.elements[1],{runs:[{text:"Keep supporting detail",font:"Geist"}]}]})
      expect(value.run.request).toBe("Saved after limit")
      expect((await fixture.history.usage.status(owner.personId)).used).toBe(3)
    }finally{await stream.close()}
  }finally{await fixture.close()}
})

it("bounds displayed activity while durable progress resumes without repeating an accepted scope",async()=>{
  let attempts=0
  const adapter:AgentAdapter=async function*(context,call,signal){
    attempts++
    for(let index=0;index<205;index++)yield {kind:"message",text:`Progress ${index}`}
    for await(const event of localAdapter(context,call,signal)){
      yield event
      if(attempts===1&&event.kind==="tool"&&event.name==="apply_changes")throw new Error("interrupted-after-overflow")
    }
  }
  const fixture=await mcpFixture({agentAdapter:adapter})
  try{
    const owner=await fixture.signIn("aira-bounded@example.com");await fixture.json("/api/decks",fixtureDeck(2,2),owner.cookie)
    const source=await eventStream(fixture.origin+"/api/aira/events?deck=deck",owner.cookie)
    try{
      await source.next();await fixture.json("/api/aira?deck=deck",{action:"send",text:"Resume bounded activity"},owner.cookie)
      let value=await source.next();while(value.run?.kind!=="failed")value=await source.next()
      expect((await fixture.history.usage.status(owner.personId)).used).toBe(3)
      expect(value.run.events).toHaveLength(200)
      await fixture.json("/api/aira?deck=deck",{action:"resume"},owner.cookie)
      value=await source.next();while(value.run?.kind==="working")value=await source.next()
      expect(value.run.kind).toBe("complete")
      expect(value.run.events).toHaveLength(200)
      expect(new Set(value.run.events.map((event:{id:number})=>event.id)).size).toBe(200)
      expect(value.run.completed).toEqual(["s0","s1"])
      expect((await fixture.history.usage.status(owner.personId)).used).toBe(6)
    }finally{await source.close()}
  }finally{await fixture.close()}
})

it("disables configured Aira honestly without credentials and refuses drafting",async()=>{
  vi.stubEnv("AIRDESIGN_CLAUDE_KEY","");vi.stubEnv("ANTHROPIC_API_KEY","")
  const fixture=await mcpFixture({agentAdapter:"configured"})
  try{
    const owner=await fixture.signIn("aira-no-key@example.com");await fixture.json("/api/decks",fixtureDeck(2,2),owner.cookie)
    const snapshot=await (await fixture.json("/api/aira?deck=deck",undefined,owner.cookie)).json()
    expect(snapshot).toMatchObject({enabled:false,run:null,unavailable:expect.stringContaining("Claude API key")})
    const response=await fixture.json("/api/aira?deck=deck",{action:"send",text:"Must not draft",selection:[]},owner.cookie)
    expect(response.status).toBe(400)
    expect((await fixture.history.read({personId:owner.personId},"deck")).seq).toBe(0)
    expect((await fixture.history.usage.status(owner.personId)).used).toBe(0)
  }finally{await fixture.close();vi.unstubAllEnvs()}
})

it("joins steering from another tab into the active Claude SDK stream",async()=>{
 const entered=deferred(),steered=deferred()
 let received=""
 const query:SdkQuery=async function*({prompt}){
  yield* []
  if(typeof prompt==="string")throw new Error("stream-required")
  const input=prompt[Symbol.asyncIterator]()
  await input.next();entered.resolve()
  const next=await input.next();received=String(next.value.message.content);steered.resolve()
  await input.return?.()
 }
 const fixture=await mcpFixture({agentAdapter:claudeAdapter({key:"test-only",model:"test-only",query})})
 try{
  const owner=await fixture.signIn("sdk-steering@example.com")
  await fixture.json("/api/decks",fixtureDeck(1,1),owner.cookie)
  const started=await (await fixture.json("/api/aira?deck=deck",{action:"send",text:"Initial"},owner.cookie)).json()
  await entered.promise
  const joined=await (await fixture.json("/api/aira?deck=deck",{action:"send",text:"Use the revised direction"},owner.cookie)).json()
  await steered.promise
  expect(joined).toMatchObject({id:started.id,joined:true})
  expect(received).toBe("Use the revised direction")
 }finally{await fixture.close()}
})
