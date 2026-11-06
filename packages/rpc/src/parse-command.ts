import { isId } from "../../deck/src/index.ts"
import { commandId, type Command } from "../../change-log/src/index.ts"
import { parseChangeSet } from "../../deck/src/index.ts"
export function parseCommand(value: unknown): Command {
  if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string" || !("kind" in value)) throw new Error("invalid-command")
  const id = commandId(value.id)
  switch (value.kind) {
    case "edit":
      if (!("base" in value) || typeof value.base !== "number" || !Number.isSafeInteger(value.base) || value.base < 0 || !("run" in value) || !(value.run === null || typeof value.run === "string") || !("changes" in value)) break
      return { id, kind: "edit", base: value.base, run: value.run, changes: parseChangeSet(value.changes) }
    case "patch": {
      if (!("target" in value) || !isId(value.target) || !("fields" in value) || !value.fields || typeof value.fields !== "object" || Array.isArray(value.fields) || !("base" in value) || typeof value.base !== "number" || !Number.isSafeInteger(value.base) || value.base < 0 || !("run" in value) || !(value.run === null || typeof value.run === "string")) break
      const fields = JSON.parse(JSON.stringify(value.fields)) as import("../../change-log/src/index.ts").Node["fields"]
      return { id, kind: "patch", target: value.target, fields, base: value.base, run: value.run }
    }
    case "start-run": case "close-run": case "undo-run":
      if (!("run" in value) || typeof value.run !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(value.run)) break
      return { id, kind: value.kind, run: value.run }
    case "undo-change":
      if (!("target" in value) || typeof value.target!=="string" || !("base" in value) || typeof value.base!=="number" || !Number.isSafeInteger(value.base) || value.base<0 || !("run" in value) || typeof value.run!=="string")break
      return {id,kind:"undo-change",target:commandId(value.target),base:value.base,run:value.run}
    case "undo": case "redo":
      if (!("target" in value) || typeof value.target !== "string") break
      return { id, kind: value.kind, target: commandId(value.target) }
  }
  throw new Error("invalid-command")
}
