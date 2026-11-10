import { catalog, projectTools } from "@airdesign/catalog"
import type { ScoreTask } from "./score.js"

export type SuiteExpect = "pass" | "fail"

export type SuiteTask = ScoreTask & {
  readonly id: string
  readonly expect: SuiteExpect
}

const projected = projectTools(catalog)

function toolName(op: string): string {
  const name = projected.find((tool) => tool.op === op)?.name
  if (name === undefined) throw new Error(op)
  return name
}

const editName = toolName("edit_deck")
const captureName = toolName("capture_slide")
const deckId = "deck"

function editTask(id: string, expect: SuiteExpect, base: number, value: string, landed: readonly string[]): SuiteTask {
  return {
    id,
    expect,
    landed,
    steps: [{ name: editName, raw: { deck: deckId, base, changes: [{ value }] } }],
  }
}

function captureTask(id: string): SuiteTask {
  return {
    id,
    expect: "pass",
    landed: [],
    steps: [{ name: captureName, raw: { deck: deckId }, tab: { presence: "absent" } }],
  }
}

const landing = [
  "task-01",
  "task-02",
  "task-03",
  "task-04",
  "task-05",
  "task-06",
  "task-07",
  "task-08",
  "task-09",
  "task-10",
  "task-11",
  "task-12",
  "task-13",
  "task-14",
  "task-15",
  "task-16",
] as const

const stale = ["task-17", "task-18", "task-19", "task-20", "task-21", "task-22", "task-23", "task-24"] as const

const absent = ["task-25", "task-26", "task-27", "task-28", "task-29", "task-30", "task-31", "task-32"] as const

const miss = ["task-33", "task-34", "task-35", "task-36", "task-37", "task-38", "task-39", "task-40"] as const

export const suite: readonly SuiteTask[] = [
  ...landing.map((id, index) => {
    const value = String(index + 1)
    return editTask(id, "pass", 0, value, [value])
  }),
  ...stale.map((id) => editTask(id, "pass", 1, "99", [])),
  ...absent.map((id) => captureTask(id)),
  ...miss.map((id) => editTask(id, "fail", 0, "22", ["21"])),
]
