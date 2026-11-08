import {parseChangeSet} from "../../deck/src/index.ts"
import { isId } from "../../deck/src/index.ts"
import { commandId, type Command, type ChangeBatch, type Json, type Node } from "./index.ts"
export function decodeCommand<C extends ChangeBatch>(value: unknown, parseChanges: (value: unknown) => C): Command<C> {
  if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string" || !("kind" in value)) throw new Error("invalid-command")
  const id = commandId(value.id)
  switch (value.kind) {
    case "edit":
      if (!("base" in value) || typeof value.base !== "number" || !Number.isSafeInteger(value.base) || value.base < 0 || !("run" in value) || !(value.run === null || typeof value.run === "string") || !("changes" in value)) break
      return { id, kind: "edit", base: value.base, run: value.run, changes: parseChanges(value.changes) }
    case "patch": {
      if (!("target" in value) || !isId(value.target) || !("fields" in value) || !value.fields || typeof value.fields !== "object" || Array.isArray(value.fields) || !("base" in value) || typeof value.base !== "number" || !Number.isSafeInteger(value.base) || value.base < 0 || !("run" in value) || !(value.run === null || typeof value.run === "string")) break
      const fields: Node["fields"] = {}
      for (const [key, field] of Object.entries(value.fields)) { if (!json(field)) throw new Error("invalid-command-field"); fields[key] = structuredClone(field) }
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

function json(value: unknown): value is Json {
  return value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value) || (Array.isArray(value) ? value.every(json) : typeof value === "object" && Object.values(value).every(json))
}
export function decodeLegacyCommandV2(value: unknown): Command {
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 2 || !("command" in value)) throw new Error("invalid-legacy-command-v2")
  return decodeCommand(value.command, parseChangeSet)
}
