import { afterEach, describe, expect, it, vi } from "vitest"
import type { Session, ToolResult } from "./call-tool.js"
import { fixture } from "./fixture.js"
import {
  edit,
  elements,
  landSourceAttempt,
  landSourceTask,
  score,
  staleEditAttempt,
  staleEditTask,
  suite,
  type Attempt,
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

const title = elements.title

const toolNames = {
  add_slide: "airdesign_add_slide",
  duplicate_slide: "airdesign_duplicate_slide",
  delete_slide: "airdesign_delete_slide",
  move_slide: "airdesign_move_slide",
  set_background: "airdesign_set_background",
  add_text_box: "airdesign_add_text_box",
  delete_element: "airdesign_delete_element",

  edit_deck: edit("deck", []).name,
  read_deck: "airdesign_read_deck",
} as const

function rowOf(id: string) {
  const row = suite.find((item) => item.task.id === id)
  if (row === undefined) throw new Error(id)
  return row
}

function titleRows(result: { readonly deck: { readonly register: { readonly elements: Record<string, unknown> } } }) {
  return (result.deck.register.elements[title] as { readonly landed: readonly unknown[] }).landed
}

describe("score", () => {
  it("passes when the edit lands a source string", () => {
    const result = score(landSourceTask, landSourceAttempt)
    expect(result.pass).toBe(true)
    expect(result.reason).toBe("ok")
    expect(titleRows(result)).toEqual([{ actor: "agent", value: "21", visible: true, runId: "run" }])
    expect(titleRows({ deck: result.start })).toEqual([])
    expect(result.deck).not.toBe(result.start)
  })

  it("passes an edit whose base is behind the revision", () => {
    const result = score(staleEditTask, staleEditAttempt)
    expect(result.pass).toBe(true)
    expect(result.reason).toBe("ok")
    expect(result.deck).not.toBe(result.start)
    expect(result.start.revision).toBe(2)
    expect(result.deck.revision).toBe(3)
    expect(titleRows(result)).toEqual([{ actor: "agent", value: "22", visible: true, runId: "run" }])
  })

  it("fails when a landed value is outside the source", () => {
    const result = score(landSourceTask, [edit("deck", [{ element: "title", value: "22", readAt: 0 }])])
    expect(result.pass).toBe(false)
    expect(result.reason).toBe("landed")
    expect(titleRows(result)).toEqual([{ actor: "agent", value: "22", visible: true, runId: "run" }])
  })

  it("fails an attempt over the call budget", () => {
    const result = score(landSourceTask, [...landSourceAttempt, ...landSourceAttempt])
    expect(result.pass).toBe(false)
    expect(result.reason).toBe("calls")
  })

  it("fails an attempt that never reached the step the task needs", () => {
    expect(score(landSourceTask, []).reason).toBe("tool")
  })

  it("fails an attempt that changes an element the task does not name", () => {
    const task: Task = {
      ...landSourceTask,
      id: "unnamed-body",
      deck: () => fixture("deck", [{ element: "title" }, { element: "body" }]),
    }
    const result = score(task, [
      edit("deck", [
        { element: "title", value: "21", readAt: 0 },
        { element: "body", value: "21", readAt: 0 },
      ]),
    ])
    expect(result.pass).toBe(false)
    expect(result.reason).toBe("touched")
  })

  it("counts only visible rows as landed", () => {
    const task: Task = {
      id: "undone-rows",
      prompt: "Set the title of deck undone to Again.",
      deck: () => fixture("undone", [{ element: "title", agent: ["Gone"], undone: true }]),
      want: { calls: 1, steps: [{ name: "edit_deck", outcome: "ok" }], elements: { title: ["Again"] } },
    }
    const result = score(task, [edit("undone", [{ element: "title", value: "Again", readAt: 2 }])])
    expect(result.start.register.elements[title]?.landed).toEqual([
      { actor: "agent", value: "Gone", visible: false, runId: "run" },
    ])
    expect(result.reason).toBe("ok")
    expect(result.pass).toBe(true)
  })

  it("fails a history that only ends on the last wanted value", () => {
    const row = rowOf("order-words")
    const result = score(row.task, [
      edit("steps", [{ element: "title", value: "Second", readAt: 0 }]),
      edit("steps", [{ element: "title", value: "Second", readAt: 1 }]),
    ])
    expect(result.pass).toBe(false)
    expect(result.reason).toBe("landed")
  })

  it.each([
    [
      "order-words",
      [
        edit("steps", [
          { element: "title", value: "First", readAt: 0 },
          { element: "title", value: "Second", readAt: 0 },
        ]),
      ],
    ],
    [
      "two-calls-one-read",
      [
        edit("reread", [
          { element: "body", value: "First", readAt: 1 },
          { element: "body", value: "Second", readAt: 1 },
        ]),
      ],
    ],
    ["stale-read-resend", [edit("ledger", [{ element: "title", value: "Final", readAt: 2 }])]],
    ["protect-batch-drop", [edit("split", [{ element: "body", value: "Notes", readAt: 0 }])]],
    ["bytes-run-out", [edit("tight", [{ element: "title", value: "Short", readAt: 0 }])]],
    [
      "bytes-run-out",
      [
        edit("tight", [
          { element: "title", value: "Short", readAt: 0 },
          { element: "body", value: "Longer note", readAt: 0 },
        ]),
        edit("tight", [{ element: "title", value: "Short", readAt: 0 }]),
      ],
    ],
    ["value-over-8000-bytes", [edit("bulk", [{ element: "title", value: "é".repeat(4000), readAt: 0 }])]],
  ])("passes a right attempt for %s that skips a call the end state does not need", (id, attempt) => {
    const result = score(rowOf(id).task, attempt)
    expect(result.reason).toBe("ok")
    expect(result.pass).toBe(true)
  })

  it("lets other calls sit between the steps a task requires", () => {
    const task: Task = { ...landSourceTask, want: { ...landSourceTask.want, calls: 2 } }
    const between = edit("deck", [{ element: "title", value: "Skipped", readAt: 5 }])
    const result = score(task, [between, ...landSourceAttempt])
    expect(result.answers.map((answer) => answer.outcome)).toEqual(["stale", "ok"])
    expect(result.reason).toBe("ok")
    expect(result.pass).toBe(true)
  })

  it("returns a score for a null or undefined entry in an attempt", () => {
    const hostile = [null, undefined] as unknown as Attempt
    const row = rowOf("order-words")
    const scored = score(row.task, hostile)
    expect(scored.pass).toBe(false)
    expect(scored.reason).toBe("tool")
    expect(scored.answers.map((answer) => answer.outcome)).toEqual(["thrown", "thrown"])
    const mixed = score(row.task, [...row.reference.slice(0, 1), ...hostile.slice(0, 1)])
    expect(mixed.answers.map((answer) => answer.outcome)).toEqual(["ok", "thrown"])
  })

  it("lets an agent read by answering with no call", () => {
    expect(score(rowOf("ask-read").task, []).pass).toBe(true)
  })

  it("returns a score for an edit aimed at an element with no body", () => {
    const row = rowOf("elements-run-out")
    const aimed = {
      name: toolNames.edit_deck,
      raw: { deck: "crowded", base: 0, changes: [{ value: "x", node: "7.99", readAt: 0 }] },
    }
    const scored = score(row.task, [aimed])
    expect(scored.pass).toBe(false)
    expect(scored.reason).toBe("tool")
    expect(scored.answers).toEqual([{ name: toolNames.edit_deck, outcome: "thrown" }])
  })

  it("does not let an empty call stand in for a step", () => {
    for (const row of suite) {
      const tools = new Set(row.task.want.steps.map((step) => step.name))
      for (const tool of tools) {
        const result = score(row.task, [{ name: toolNames[tool], raw: {} }])
        expect(result.pass, `${row.task.id} ${tool}`).toBe(false)
      }
    }
  })

  it("scores every task", () => {
    expect(suite).toHaveLength(49)
    const ids = suite.map((row) => row.task.id)
    const prompts = suite.map((row) => row.task.prompt)
    expect(new Set(ids).size).toBe(49)
    expect(new Set(prompts).size).toBe(49)
    const starts = suite.map((row) => {
      const deck = row.task.deck()
      return JSON.stringify({
        revision: deck.revision,
        register: deck.register,
        want: row.task.want,
      })
    })
    expect(new Set(starts).size).toBe(49)
    for (const row of suite) expect(score(row.task, row.reference).pass, row.task.id).toBe(true)
  })
})
