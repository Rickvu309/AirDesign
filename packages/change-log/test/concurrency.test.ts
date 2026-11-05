import { describe, it, expect } from "vitest"
import { commandId, execute, initialHistory, type Command, type History } from "../src/index.ts"
import { fixtureDeck, fixtureElement } from "../../deck/src/fixture.ts"
import { id } from "../../deck/src/index.ts"

const cid = commandId
function edit(request: string, history: History, text: string, run: string | null = null): Extract<Command, { kind: "edit" }> {
  const slide = history.deck.slides[0]
  if (!slide) throw new Error("fixture-slide")
  return { id: cid(request), kind: "edit", base: history.seq, run, changes: { changes: [{ kind: "set", target: slide.id, value: { ...slide, notes: text } }] } }
}
function must(history: History, command: Command): History {
  const result = execute(history, command)
  expect(result.receipt).toMatchObject({ kind: "applied" })
  return result.history
}
describe("ordered durable history", () => {
  it("protects person values from an old epoch and permits a new explicit run", () => {
    let h = initialHistory(fixtureDeck(2))
    h = must(h, { id: cid("start"), kind: "start-run", run: "old" })
    h = must(h, edit("person", h, "mine"))
    expect(execute(h, edit("late",h,"old", "old")).receipt).toMatchObject({ kind: "refused", code: "person-protected" })
    h = must(h, { id: cid("new"), kind: "start-run", run: "new" })
    h = must(h, edit("new-edit",h,"allowed", "new"))
    expect(h.deck.slides[0]?.notes).toBe("allowed")
    h = must(h,{ id: cid("close"), kind: "close-run", run: "new" })
    expect(execute(h,edit("closed",h,"late","new")).receipt).toMatchObject({ kind: "refused", code: "run-closed" })
  })
  it("undo rebuilds structure while adopting a person-edited run child", () => {
    let h = initialHistory(fixtureDeck(2))
    h = must(h, { id: cid("start"), kind: "start-run", run: "run" })
    h = must(h,{ id: cid("insert"), kind: "edit", base:h.seq,run:"run",changes:{changes:[{kind:"insert",parent:id("s0"),index:0,value:{...fixtureElement(1),id:id("child")}}]} })
    const child = h.deck.slides[0]?.elements.find(n => n.id === "child")
    if (!child || child.kind !== "shape") throw new Error("fixture-child")
    h = must(h,{id:cid("adopt"),kind:"edit",base:h.seq,run:null,changes:{changes:[{kind:"set",target:child.id,value:{...child,fill:"#ff0000"}},{kind:"move",target:child.id,parent:id("s0"),index:2}]}})
    h = must(h,{id:cid("undo-run"),kind:"undo-run",run:"run"})
    expect(h.deck.slides[0]?.elements.find(n=>n.id==="child")).toMatchObject({id:"child",fill:"#ff0000"})
    expect(h.deck.slides[0]?.elements[2]?.id).toBe("child")
  })
  it("individual undo preserves independent agent values and redo is invalidated by overlap", () => {
    let h = initialHistory(fixtureDeck(2))
    h = must(h, edit("person",h,"mine"))
    h = must(h,{ id:cid("start"),kind:"start-run",run:"agent" })
    const element = h.deck.slides[0]?.elements[1]
    if (!element || element.kind !== "shape") throw new Error("fixture-shape")
    h = must(h,{id:cid("agent"),kind:"edit",run:"agent",base:h.seq,changes:{changes:[{kind:"set",target:element.id,value:{...element,fill:"#ff0000"}}]}})
    h = must(h,{id:cid("undo"),kind:"undo",target:cid("person")})
    expect(h.deck.slides[0]?.notes).toBe("Canonical render fixture")
    expect(h.deck.slides[0]?.elements[1]).toMatchObject({fill:"#ff0000"})
    h = must(h,edit("later",h,"later"))
    expect(execute(h,{id:cid("redo"),kind:"redo",target:cid("person")}).receipt).toMatchObject({kind:"refused",code:"redo-invalidated"})
  })

  it("rejects stale agent batches atomically, deleted targets and reused node identities", () => {
    let h = initialHistory(fixtureDeck(2))
    h = must(h,{id:cid("start"),kind:"start-run",run:"agent"})
    h = must(h,edit("person",h,"mine"))
    const refused = execute(h,{...edit("stale",h,"overwrite","agent"),base:0})
    expect(refused.receipt).toMatchObject({kind:"refused",code:"stale-base"})
    expect(refused.history).toEqual(h)
    h = must(h,{id:cid("remove"),kind:"edit",run:null,base:h.seq,changes:{changes:[{kind:"remove",target:id("s0e1")}]}})
    expect(execute(h,{id:cid("late"),kind:"patch",run:null,base:0,target:id("s0e1"),fields:{fill:"#ff0000"}}).receipt).toMatchObject({kind:"refused",code:"invalid-reference"})
    expect(execute(h,{id:cid("reuse"),kind:"edit",run:null,base:h.seq,changes:{changes:[{kind:"insert",parent:id("s0"),index:0,value:{...fixtureElement(1),id:id("s0e1")}}]}}).receipt).toMatchObject({kind:"refused",code:"node-id-reused"})
  })
  it("patches independent fields over stale person bases in arrival order", () => {
    let h = initialHistory(fixtureDeck(2))
    h = must(h,{id:cid("notes"),kind:"patch",target:id("s0"),fields:{notes:"offline"},base:0,run:null})
    h = must(h,{id:cid("size"),kind:"patch",target:id("s0"),fields:{size:{width:800,height:600}},base:0,run:null})
    expect(h.deck.slides[0]).toMatchObject({notes:"offline",size:{width:800,height:600}})
    h = must(h,{id:cid("undo"),kind:"undo",target:cid("notes")})
    expect(h.deck.slides[0]).toMatchObject({notes:"Canonical render fixture",size:{width:800,height:600}})
  })

})
