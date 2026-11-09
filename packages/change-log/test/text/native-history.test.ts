import {describe, expect, it} from "vitest"
import {fixtureDeck} from "../../../deck/src/fixture.ts"
import {id} from "../../../deck/src/model.ts"
import type {NativeChangeSet} from "../../../deck/src/text/operations.ts"
import {parseNativeArchiveV3, type NativeDeck, type NativeText} from "../../../deck/src/text/native-v3.ts"
import {parseDeck} from "../../../deck/src/parse.ts"
import {commandId, diffNodes, initialHistory, projectHistory, type Command, type History} from "../../src/index.ts"
import {executeNative, nativeHistoryModel} from "../../src/text/native-model.ts"
import {transduceLegacyHistory} from "../../src/text/history-transducer.ts"

function fixture(): History<NativeDeck> { return transduceLegacyHistory({version: 2, history: initialHistory(fixtureDeck(2)), immutable: {version: 2, events: [], receipts: []}}).history }
function text(history: History<NativeDeck>): NativeText {
  const element = history.deck.slides[0]?.elements[0]
  if (element?.kind !== "text") throw new Error("fixture-text")
  return element
}
function must(history: History<NativeDeck>, command: Command<NativeChangeSet>): History<NativeDeck> {
  const identity = "run" in command && command.run !== null && (command.kind === "edit" || command.kind === "patch") ? {kind: "run", run: command.run} as const : {kind: "person"} as const
  const result = executeNative(history,command,identity)
  expect(result.receipt).toMatchObject({kind: "applied"})
  return result.history
}
function split(history: History<NativeDeck>): History<NativeDeck> {
  const element = text(history), paragraph = element.body.paragraphs[0]
  return must(history,{id: commandId("split"), kind: "edit", base: history.seq, run: null, changes: {changes: [{kind: "insert", parent: element.id, index: 2, value: {...paragraph, id: id("second")}}]}})
}
describe("native topology through the ordered history executor", () => {
  it("isolates paragraph properties and refuses the same stale property", () => {
    let history = split(fixture())
    history = must(history,{id: commandId("start"), kind: "start-run", run: "agent"})
    const base = history.seq, paragraph = text(history).body.paragraphs[0]
    history = must(history,{id: commandId("first"), kind: "patch", target: paragraph.id, fields: {alignment: "center"}, base, run: "agent"})
    history = must(history,{id: commandId("second-edit"), kind: "patch", target: id("second"), fields: {alignment: "right"}, base, run: "agent"})
    const result = executeNative(history,{id: commandId("stale"), kind: "patch", target: paragraph.id, fields: {alignment: "left"}, base, run: "agent"},{kind: "run", run: "agent"})
    expect(result.receipt).toMatchObject({kind: "refused", code: "stale-base"})
    expect(executeNative(history,{id:commandId("person-stale"),kind:"patch",target:paragraph.id,fields:{alignment:"justify"},base,run:null}).receipt).toMatchObject({kind:"refused",code:"stale-base"})
    expect(text(history).body.paragraphs.map(paragraph => paragraph.alignment)).toEqual(["center","right"])
    expect(projectHistory(history,nativeHistoryModel)).toEqual(history.deck)
    expect(() => parseDeck(history.deck)).toThrow()
  })
  it("expands enclosing replacement and refuses stale children atomically", () => {
    let history = split(fixture())
    history = must(history,{id: commandId("start"), kind: "start-run", run: "agent"})
    const base = history.seq, stale = structuredClone(history.deck), paragraph = text(history).body.paragraphs[0]
    history = must(history,{id: commandId("person"), kind: "patch", target: paragraph.id, fields: {alignment: "center"}, base, run: null})
    const result = executeNative(history,{id: commandId("replace"), kind: "edit", base, run: "agent", changes: {changes: [{kind: "set", target: stale.id, value: stale}]}},{kind: "run",run: "agent"})
    expect(result.receipt).toMatchObject({kind: "refused", code: "stale-base"})
    expect(result.history).toBe(history)
    const element = text(history)
    expect(executeNative(history,{id: commandId("empty"),kind: "edit",base: history.seq,run:null,changes:{changes:element.body.paragraphs.map(paragraph=>({kind:"remove",target:paragraph.id}))}}).receipt).toMatchObject({kind:"refused",code:"invalid-data"})
    expect(executeNative(history,{id:commandId("frame"),kind:"edit",base:history.seq,run:null,changes:{changes:[{kind:"set",target:element.id,value:{...element,body:{...element.body,frame:{...element.body.frame,id:id("otherframe")}}}}]}}).receipt.kind).toBe("refused")
  })
  it("merges and reorders in one valid final topology and retains lifetime ids", () => {
    let history = split(fixture())
    const paragraph = text(history).body.paragraphs[0]
    history = must(history,{id:commandId("reorder"),kind:"edit",base:history.seq,run:null,changes:{changes:[{kind:"move",target:id("second"),parent:text(history).id,index:1}]}})
    expect(text(history).body.paragraphs.map(paragraph=>paragraph.id)).toEqual(["second",paragraph.id])
    history = must(history,{id:commandId("merge"),kind:"edit",base:history.seq,run:null,changes:{changes:[{kind:"remove",target:id("second")},{kind:"set",target:paragraph.id,value:{...paragraph,alignment:"justify"}}]}})
    expect(text(history).body.paragraphs).toHaveLength(1)
    history = must(history,{id:commandId("undo"),kind:"undo",target:commandId("merge")})
    expect(text(history).body.paragraphs.map(paragraph=>paragraph.id)).toEqual(["second",paragraph.id])
    history = must(history,{id:commandId("redo"),kind:"redo",target:commandId("merge")})
    expect(text(history).body.paragraphs[0].alignment).toBe("justify")
    expect(history.usedIds).toContain("second")
    expect(executeNative(history,{id:commandId("reuse"),kind:"edit",base:history.seq,run:null,changes:{changes:[{kind:"insert",parent:text(history).id,index:2,value:{...paragraph,id:id("second")}}]}}).receipt).toMatchObject({kind:"refused",code:"node-id-reused"})
    const replacement={...paragraph,id:id("new-only")}
    history=must(history,{id:commandId("replace-only"),kind:"edit",base:history.seq,run:null,changes:{changes:[{kind:"remove",target:paragraph.id},{kind:"insert",parent:text(history).id,index:1,value:replacement}]}})
    expect(text(history).body.paragraphs.map(value=>value.id)).toEqual(["new-only"])
  })
  it("resurrects an adopted trailing paragraph with its frame and valid sibling order", () => {
    let history = fixture()
    history = must(history,{id:commandId("start"),kind:"start-run",run:"agent"})
    const original = text(history), paragraph = original.body.paragraphs[0]
    const inserted = {...original,id:id("inserted"),body:{frame:{...original.body.frame,id:id("insertedframe")},paragraphs:[{...paragraph,id:id("insertedfirst")},{...paragraph,id:id("insertedlast")}] satisfies [typeof paragraph,...typeof paragraph[]]}}
    history = must(history,{id:commandId("insert"),kind:"edit",base:history.seq,run:"agent",changes:{changes:[{kind:"insert",parent:id("s0"),index:1,value:inserted}]}})
    history = must(history,{id:commandId("adopt"),kind:"patch",base:history.seq,run:null,target:id("insertedlast"),fields:{alignment:"center"}})
    history = must(history,{id:commandId("undo"),kind:"undo-run",run:"agent"})
    const adopted=history.deck.slides[0]?.elements[1]
    expect(adopted).toMatchObject({kind:"text",body:{frame:{id:"insertedframe"},paragraphs:[{id:"insertedlast",alignment:"center"}]}})
    expect(projectHistory(history,nativeHistoryModel)).toEqual(history.deck)
  })
  it("refuses changing internal node kinds or moving them between bodies through parent replacement", () => {
    const history=split(fixture()), original=text(history), paragraph=original.body.paragraphs[0]
    const deck=structuredClone(history.deck), slide=deck.slides[0]
    if(!slide)throw new Error("fixture-slide")
    const replacement: NativeText={...original,id:id("second-text"),body:{frame:{...original.body.frame,id:id("second-frame")},paragraphs:[{...paragraph,id:id("second-paragraph")}]} }
    slide.elements.push(replacement)
    const added=must(history,{id:commandId("add-body"),kind:"edit",base:history.seq,run:null,changes:{changes:[{kind:"set",target:deck.id,value:deck}]}})
    const moved=structuredClone(added.deck), first=moved.slides[0]?.elements[0], last=moved.slides[0]?.elements.at(-1)
    if(first?.kind!=="text" || last?.kind!=="text")throw new Error("fixture-bodies")
    const trailing=first.body.paragraphs.pop()
    if(!trailing)throw new Error("fixture-paragraph")
    last.body.paragraphs.push(trailing)
    expect(executeNative(added,{id:commandId("move-child"),kind:"edit",base:added.seq,run:null,changes:{changes:[{kind:"set",target:moved.id,value:moved}]}}).receipt.kind).toBe("refused")
  })
  it("keeps later person text while undoing a run and protects it from the old run", () => {
    let history = split(fixture())
    history = must(history,{id:commandId("start"),kind:"start-run",run:"agent"})
    const paragraph = text(history).body.paragraphs[0]
    history = must(history,{id:commandId("agent"),kind:"patch",base:history.seq,run:"agent",target:paragraph.id,fields:{alignment:"center"}})
    history = must(history,{id:commandId("person"),kind:"patch",base:history.seq,run:null,target:paragraph.id,fields:{runs:[{kind:"text",text:"person",style:paragraph.endStyle}]}})
    expect(executeNative(history,{id:commandId("protected"),kind:"patch",base:history.seq,run:"agent",target:paragraph.id,fields:{alignment:"right"}},{kind:"run",run:"agent"}).receipt).toMatchObject({kind:"refused",code:"person-protected"})
    history = must(history,{id:commandId("undo"),kind:"undo-run",run:"agent"})
    expect(text(history).body.paragraphs[0]).toMatchObject({alignment:"left",runs:[{text:"person"}]})
    expect(projectHistory(history,nativeHistoryModel)).toEqual(history.deck)
  })
})

it("ignores JSONB object ordering while preserving array and property changes", () => {
  const before = {id: id("node"), parent: null, order: 0, fields: {style: {font: "Arial", color: "black"}, runs: [{text: "one"}, {text: "two"}]}}
  const reordered = {...before, fields: {runs: [{text: "one"}, {text: "two"}], style: {color: "black", font: "Arial"}}}
  expect(diffNodes([before], [reordered])).toEqual([])
  expect(diffNodes([before], [{...reordered, fields: {...reordered.fields, runs: [{text: "two"}, {text: "one"}]}}])[0]?.keys).toEqual(["runs"])
  expect(diffNodes([before], [{...reordered, fields: {runs: reordered.fields.runs}}])[0]?.keys).toEqual(["style"])
})

it("persists no-fill through history replay, undo, redo and JSON reopen", () => {
  let history = fixture()
  const paragraph = text(history).body.paragraphs[0], before = structuredClone(paragraph), next = structuredClone(paragraph)
  next.runs[0]!.style.color = null
  next.endStyle.color = null
  history = must(history, {id: commandId("paint"), kind: "edit", base: history.seq, run: null, changes: {changes: [{kind: "set", target: paragraph.id, value: next}]}})
  expect(text(history).body.paragraphs[0]).toEqual(next)
  expect(projectHistory(history, nativeHistoryModel)).toEqual(history.deck)
  history = must(history, {id: commandId("undo-paint"), kind: "undo", target: commandId("paint")})
  expect(text(history).body.paragraphs[0]).toEqual(before)
  history = must(history, {id: commandId("redo-paint"), kind: "redo", target: commandId("paint")})
  const reopened: History<NativeDeck> = JSON.parse(JSON.stringify(history))
  expect(text(reopened).body.paragraphs[0]).toEqual(next)
  expect(projectHistory(reopened, nativeHistoryModel)).toEqual(reopened.deck)
})

it.each([null, 1, 0.625])("preserves saved autofit %s through native paint history, undo, redo and validated reopen", fontScale => {
  let history = fixture()
  const element = text(history), frame = {...element.body.frame, autofit: {kind: "shrink", fontScale, lineReduction: null} satisfies NativeText["body"]["frame"]["autofit"]}
  history = must(history, {id: commandId("saved-fit"), kind: "edit", base: history.seq, run: null, changes: {changes: [{kind: "set", target: frame.id, value: frame}]}})
  const paragraph = text(history).body.paragraphs[0], painted = {...paragraph, endStyle: {...paragraph.endStyle, color: "#abcdef"}}
  history = must(history, {id: commandId("fit-paint"), kind: "edit", base: history.seq, run: null, changes: {changes: [{kind: "set", target: paragraph.id, value: painted}]}})
  expect(text(history).body.frame).toEqual(frame)
  history = must(history, {id: commandId("undo-fit-paint"), kind: "undo", target: commandId("fit-paint")})
  expect(text(history).body.paragraphs[0]).toEqual(paragraph)
  expect(text(history).body.frame).toEqual(frame)
  history = must(history, {id: commandId("redo-fit-paint"), kind: "redo", target: commandId("fit-paint")})
  const reopened: History<NativeDeck> = JSON.parse(JSON.stringify(history))
  expect(parseNativeArchiveV3({version: 3, deck: reopened.deck}).deck).toEqual(history.deck)
  expect(text(reopened).body.frame).toEqual(frame)
  expect(text(reopened).body.paragraphs[0]).toEqual(painted)
  expect(projectHistory(reopened, nativeHistoryModel)).toEqual(reopened.deck)
})
