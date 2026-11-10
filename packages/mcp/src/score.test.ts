import { elementId } from "@airdesign/document"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Session, ToolResult } from "./call-tool.js"
import { fixture } from "./fixture.js"
import {
  capture,
  captureAbsentAttempt,
  captureAbsentTask,
  edit,
  landSourceAttempt,
  landSourceTask,
  score,
  staleEditAttempt,
  staleEditTask,
  suite,
  type Task,
} from "./index.js"

const replaced = vi.hoisted(() => ({
  run: null as null | ((name: string, raw: unknown, session: Session) => ToolResult),
}))

vi.mock("./call-tool.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("./call-tool.js")>()
  return {
    ...real,
    callTool: (name: string, raw: unknown, session: Session) => (replaced.run ?? real.callTool)(name, raw, session),
  }
})

afterEach(() => {
  replaced.run = null
})

const title = elementId("258.7")

function titleRows(result: { readonly deck: { readonly register: { readonly elements: Record<string, unknown> } } }) {
  return (result.deck.register.elements[title] as { readonly landed: readonly unknown[] }).landed
}

describe("score", () => {
  it("passes when the edit lands a source string", () => {
    const result = score(landSourceTask, landSourceAttempt)
    expect(result.pass).toBe(true)
    expect(result.reason).toBe("ok")
    expect(titleRows(result)).toEqual([{ actor: "agent", value: "21", visible: true }])
    expect(titleRows({ deck: result.start })).toEqual([])
    expect(result.deck).not.toBe(result.start)
  })

  it("passes an edit whose base is behind the revision", () => {
    const result = score(staleEditTask, staleEditAttempt)
    expect(result.pass).toBe(true)
    expect(result.reason).toBe("ok")
    expect(result.deck).not.toBe(result.start)
    expect(result.deck.revision).toBe(1)
    expect(titleRows(result)).toEqual([{ actor: "agent", value: "22", visible: true }])
    expect(result.start.revision).toBe(0)
  })

  it("passes a capture that leaves the deck and reports no file", () => {
    const result = score(captureAbsentTask, captureAbsentAttempt)
    expect(result.pass).toBe(true)
    expect(result.reason).toBe("ok")
    expect(result.deck).toBe(result.start)
    expect(result.deck.register).toBe(result.start.register)
    expect(captureAbsentAttempt[0]?.tab).toEqual({ presence: "absent" })
  })

  it("fails when a landed value is outside the source", () => {
    const result = score(landSourceTask, [edit("deck", [{ element: "title", value: "22", readAt: 0 }])])
    expect(result.pass).toBe(false)
    expect(result.reason).toBe("landed")
    expect(titleRows(result)).toEqual([{ actor: "agent", value: "22", visible: true }])
  })

  it("fails an attempt over the call budget", () => {
    const result = score(landSourceTask, [...landSourceAttempt, ...landSourceAttempt])
    expect(result.pass).toBe(false)
    expect(result.reason).toBe("calls")
  })

  it("fails an attempt that never called the tool the task needs", () => {
    const result = score(captureAbsentTask, [])
    expect(result.pass).toBe(false)
    expect(result.reason).toBe("tool")
    expect(score(landSourceTask, []).reason).toBe("tool")
  })

  it("fails an attempt that changes an element the task does not name", () => {
    const result = score(landSourceTask, [
      edit("deck", [
        { element: "title", value: "21", readAt: 0 },
        { element: "body", value: "21", readAt: 0 },
      ]),
    ])
    expect(result.pass).toBe(false)
    expect(result.reason).toBe("landed")
  })

  it("fails a capture step that changes the deck", () => {
    replaced.run = (_name, _raw, session) => ({
      ok: true,
      deck: { ...session.deck, revision: session.deck.revision + 1 },
      content: [{ type: "text", text: "Landed revision 1." }],
    })
    const result = score(captureAbsentTask, [capture("deck", { presence: "absent" })])
    expect(result.pass).toBe(false)
    expect(result.reason).toBe("captured")
    expect(result.deck.revision).toBe(1)
  })

  it("fails a capture step that reports a file", () => {
    replaced.run = (_name, _raw, session) => ({
      ok: false,
      refusal: "device",
      deck: session.deck,
      content: [{ type: "text", text: "slide.png" }],
    })
    const result = score(captureAbsentTask, captureAbsentAttempt)
    expect(result.pass).toBe(false)
    expect(result.reason).toBe("captured")
  })

  it("counts only visible rows as landed", () => {
    const task: Task = {
      id: "undone-rows",
      prompt: "Set the title of deck undone to Again.",
      deck: () => fixture("undone", [{ element: "title", agent: ["Gone"], undone: true }]),
      want: { calls: 1, tool: "edit_deck", elements: { title: [] } },
    }
    const result = score(task, [edit("undone", [{ element: "title", value: "Again", readAt: 0 }])])
    expect(result.start.register.elements[title]?.landed).toEqual([{ actor: "agent", value: "Gone", visible: false }])
    expect(result.reason).toBe("ok")
    expect(result.pass).toBe(true)
  })

  it("scores forty tasks", () => {
    expect(suite).toHaveLength(40)
    const ids = suite.map((row) => row.task.id)
    const prompts = suite.map((row) => row.task.prompt)
    expect(new Set(ids).size).toBe(40)
    expect(new Set(prompts).size).toBe(40)
    const starts = suite.map((row) => {
      const deck = row.task.deck()
      return JSON.stringify({ revision: deck.revision, register: deck.register, want: row.task.want })
    })
    expect(new Set(starts).size).toBe(40)
    for (const row of suite) expect(score(row.task, row.reference).pass, row.task.id).toBe(true)
  })
})
