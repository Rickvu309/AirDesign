import { describe, expect, it } from "vitest"

import { evalDeck, named, slides } from "./testing/eval-deck.js"
import { type Task, edit, read, score } from "./testing/score.js"
import { suite } from "./testing/suite.js"

const aim = `${slides.opening}.title`
const task: Task = {
  id: "one",
  prompt: "Set the title.",
  deck: evalDeck,
  want: {
    calls: 1,
    steps: [{ name: "execute", outcome: "ok" }],
    touches: [named.title],
    landed: () => true,
  },
}
const set = (target: string) => [edit([{ op: "update", target, text: "A" }])]

describe("score", () => {
  it("passes an attempt that makes the calls the task wants and changes only what it names", async () => {
    const result = await score(task, set(aim))
    expect(result).toMatchObject({ pass: true, reason: "ok", answers: [{ outcome: "ok" }] })
  })

  it("fails an attempt with more calls than the task allows, before it calls anything", async () => {
    const result = await score(task, [read(), ...set(aim)])
    expect(result).toMatchObject({ pass: false, reason: "calls", answers: [] })
  })

  it("fails an attempt whose answers are not the steps the task wants", async () => {
    const result = await score(task, [edit([{ op: "update", target: "z:9", text: "A" }])])
    expect(result).toMatchObject({ pass: false, reason: "tool", answers: [{ outcome: "dead" }] })
  })

  it("fails an attempt that changes a layer the task does not name", async () => {
    expect(await score(task, set(named.note))).toMatchObject({ pass: false, reason: "touched" })
  })

  it("fails an attempt whose result is not what the task wants", async () => {
    const wants: Task = { ...task, want: { ...task.want, landed: () => false } }
    expect(await score(wants, set(aim))).toMatchObject({ pass: false, reason: "landed" })
  })

  it("scores a call that throws as thrown, and goes on", async () => {
    const two: Task = { ...task, want: { ...task.want, calls: 2 } }
    const broken = {
      get deck(): string {
        throw new Error("no")
      },
    }
    const result = await score(two, [{ name: "airdesign_execute", raw: broken }, ...set(aim)])
    expect(result.answers[0]).toEqual({ name: "airdesign_execute", outcome: "thrown" })
  })

  it("keeps every task's id once", () => {
    const ids = suite.map((row) => row.task.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("builds the board deck brief in four calls, under the fifteen the brief allows", async () => {
    const row = suite.find((each) => each.task.id === "board-brief")!
    expect(row.reference).toHaveLength(4)
    expect(row.task.want.calls).toBeLessThan(15)
    expect(await score(row.task, row.reference)).toMatchObject({ pass: true })
  })
})
