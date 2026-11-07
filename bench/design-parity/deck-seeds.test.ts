import {expect,it} from "vitest"
import type {Deck} from "../../packages/deck/src/model.ts"

async function catalogSeed(code:string,seed="recents"){
  const capture=await import(new URL("./capture.mjs",import.meta.url).href)
  let now=0
  const requests:{path:string;body:unknown;at:number}[]=[]
  await capture.seed({fixture:{now:()=>now,advance:(delta:number)=>{now+=delta},signIn:async()=>({personId:"owner"})},request:async(_owner:unknown,path:string,body:unknown)=>{requests.push({path,body,at:now});return {}}},{code,seed,route:"/"})
  return requests
}

it("seeds distinct named covers, three starred decks and independent created and edited dates",async()=>{
  const requests=await catalogSeed("S31.02"),created=requests.filter(request=>request.path==="/api/decks"),renamed=requests.filter(request=>request.path.endsWith("/rename"))
  const titles=["Project Atlas","Q3 Investor Update","FY26 Operating Plan","Pricing Strategy Review","Board Pack, October","Germany Market Sizing"]
  expect(created.map(request=>(request.body as Deck).slides[0]!.elements.filter(element=>element.kind==="text").flatMap(element=>element.runs.map(run=>run.text)).join(" "))).toEqual(titles)
  expect(created.map(request=>new Date(request.at).toISOString().slice(0,10))).toEqual(["2026-10-30","2026-10-21","2026-09-12","2026-09-03","2026-08-28","2026-08-04"])
  expect(renamed.map(request=>(Date.parse("2026-11-06T03:00:00Z")-request.at)/86400000)).toEqual([0,1/12,1,7,21,30])
  expect(requests.filter(request=>request.path.endsWith("/star")).map(request=>request.body)).toEqual([{starred:true},{starred:true},{starred:true}])
  expect(requests.filter(request=>request.path.endsWith("/star")).map(request=>renamed.find(rename=>rename.path.replace("/rename","/star")===request.path)?.body)).toEqual(titles.slice(0,3).map(title=>({title})))
})

it("keeps live starred decks in Trash and reserves one grid slot for each import card",async()=>{
  const trash=await catalogSeed("S33.01","trash-with-items")
  expect(trash.filter(request=>request.path==="/api/decks")).toHaveLength(6)
  expect(trash.filter(request=>request.path.endsWith("/star"))).toHaveLength(3)
  expect(trash.filter(request=>request.path.endsWith("/trash"))).toHaveLength(3)
  const deleted=trash.filter(request=>request.path.endsWith("/trash"))
  for(const request of trash.filter(request=>request.path.endsWith("/star")))expect(deleted.map(row=>row.path)).not.toContain(request.path.replace("/star","/trash"))
  for(const request of deleted){
    const deck=trash.find(created=>created.path==="/api/decks"&&(created.body as Deck).id===request.path.split("/")[3])!
    expect(deck.at).toBeLessThan(request.at)
  }
  for(const code of ["S32.02","S32.03"]){
    const requests=await catalogSeed(code)
    expect(requests.filter(request=>request.path==="/api/decks")).toHaveLength(5)
    expect(requests.filter(request=>request.path.endsWith("/rename")).map(request=>request.body)).not.toContainEqual({title:"Project Atlas"})
  }
})

it("preserves the editor fixture content, current timestamps and unstarred state",async()=>{
  const requests=await catalogSeed("S41.01","deck-open")
  expect(requests.filter(request=>request.path==="/api/decks").map(request=>request.at)).toEqual([Date.parse("2026-11-06T03:00:00Z")])
  const deck=requests.find(request=>request.path==="/api/decks")!.body as Deck
  expect(deck.slides[0]!.notes).toBe("")
  expect(deck.slides[0]!.elements.filter(element=>element.kind==="text").flatMap(element=>element.runs.map(run=>run.text))).toEqual(["Q3 Investor Update"])
  expect(requests.filter(request=>request.path.endsWith("/star"))).toEqual([])
})
