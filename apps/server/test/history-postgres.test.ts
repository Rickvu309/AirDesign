import { it, expect } from "vitest"
import { randomBytes } from "node:crypto"
import pg from "pg"
import { createHistoryStore } from "../src/db/history-store.ts"
import { commandId, type Command } from "../../../packages/change-log/src/index.ts"
import { fixtureDeck, fixtureElement } from "../../../packages/deck/src/fixture.ts"
import { id } from "../../../packages/deck/src/index.ts"
it("orders two real Postgres connections and concurrent run undo without duplicates", async () => {
  const database = `airdesign_p04_${randomBytes(6).toString("hex")}`
  const host=process.env.AIRDESIGN_PG_HOST ?? "/home/quan/.local/pg/sock", user=process.env.AIRDESIGN_PG_USER ?? "quan"
  const admin = new pg.Client({host,user,database:"postgres"})
  await admin.connect()
  await admin.query(`CREATE DATABASE ${database}`)
  const driver = {kind:"postgres",url:`postgresql://${user}@/${database}?host=${host}`} as const
  const first = await createHistoryStore(driver), second = await createHistoryStore(driver)
  const owner = {personId:"owner"}
  try {
    const deck = fixtureDeck(2)
    await first.create(owner,deck)
    await first.commit(owner,deck.id,{id:commandId("start"),kind:"start-run",run:"run"})
    const slide = deck.slides[0]
    if (!slide) throw new Error("fixture-slide")
    const command: Command = {id:commandId("edit"),kind:"edit",base:1,run:"run",changes:{changes:[{kind:"set",target:slide.id,value:{...slide,notes:"two-connections"}}]}}
    const [a,b] = await Promise.all([first.commit(owner,deck.id,structuredClone(command)),second.commit(owner,deck.id,structuredClone(command))])
    expect(a).toEqual(b)
    expect((await first.read(owner,deck.id)).seq).toBe(2)
    const results = await Promise.all([first.commit(owner,deck.id,{id:commandId("undo-a"),kind:"undo-run",run:"run"}),second.commit(owner,deck.id,{id:commandId("undo-b"),kind:"undo-run",run:"run"})])
    expect(results.map(r=>r.kind).sort()).toEqual(["applied","refused"])
    expect((await second.read(owner,deck.id)).deck.slides[0]?.notes).toBe(slide.notes)
    expect((await second.replay(owner,deck.id,0)).events.map(e=>e.seq)).toEqual([1,2,3])
    const adoption={...fixtureDeck(5,2),id:id("adoption")}
    await first.create(owner,adoption)
    await first.commit(owner,adoption.id,{id:commandId("start_adoption"),kind:"start-run",run:"adoption"})
    await first.commit(owner,adoption.id,{id:commandId("insert_adoption"),kind:"edit",run:"adoption",base:1,changes:{changes:[{kind:"insert",parent:id("s0"),index:0,value:{...fixtureElement(0),id:id("adopted")}},{kind:"insert",parent:id("s0"),index:1,value:{...fixtureElement(1),id:id("untouched")}}]}})
    await second.commit(owner,adoption.id,{id:commandId("move_adoption"),kind:"edit",run:null,base:2,changes:{changes:[{kind:"move",target:id("adopted"),parent:id("s1"),index:0}]}})
    expect(await first.commit(owner,adoption.id,{id:commandId("undo_adoption"),kind:"undo-run",run:"adoption"})).toMatchObject({kind:"applied"})
    const adopted=(await second.read(owner,adoption.id)).deck
    expect(adopted.slides[1]?.elements[0]?.id).toBe("adopted")
    expect(adopted.slides.flatMap(slide=>slide.elements).some(element=>element.id==="untouched")).toBe(false)
    const movement={...fixtureDeck(5,2),id:id("movement")}
    await first.create(owner,movement)
    await first.commit(owner,movement.id,{id:commandId("start_move"),kind:"start-run",run:"move"})
    await first.commit(owner,movement.id,{id:commandId("agent_move"),kind:"edit",run:"move",base:1,changes:{changes:[{kind:"move",target:id("s0e1"),parent:id("s1"),index:0}]}})
    await second.commit(owner,movement.id,{id:commandId("person_move"),kind:"edit",run:null,base:2,changes:{changes:[{kind:"move",target:id("s0e1"),parent:id("s0"),index:4}]}})
    await first.commit(owner,movement.id,{id:commandId("undo_move"),kind:"undo-run",run:"move"})
    expect((await second.read(owner,movement.id)).deck.slides[0]?.elements[4]?.id).toBe("s0e1")
    const bounded={...fixtureDeck(2),id:id("bounded")}
    await first.create(owner,bounded)
    for(let index=0;index<120;index++) expect(await first.commit(owner,bounded.id,{id:commandId(`edit_${index}`),kind:"patch",run:null,base:0,target:id("s0"),fields:{notes:`value ${index}`}})).toMatchObject({kind:"applied",seq:index+1})
    expect((await second.replay(owner,bounded.id,0)).events).toHaveLength(100)
    expect((await second.replay(owner,bounded.id,100)).events).toHaveLength(20)
    expect(await second.commit(owner,bounded.id,{id:commandId("undo_latest"),kind:"undo",target:commandId("edit_119")})).toMatchObject({kind:"applied"})
    expect((await second.read(owner,bounded.id)).deck.slides[0]?.notes).toBe("value 118")
    expect(await first.commit(owner,bounded.id,{id:commandId("undo_early"),kind:"undo",target:commandId("edit_0")})).toMatchObject({kind:"applied"})
    expect((await first.read(owner,bounded.id)).deck.slides[0]?.notes).toBe("value 118")
  } finally {
    await first.close(); await second.close()
    await admin.query(`DROP DATABASE ${database} WITH (FORCE)`)
    await admin.end()
  }
})
