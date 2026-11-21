import type { AgentChange } from "@airdesign/catalog"
import { openingElement, readTextValue, slideKind, type Register } from "@airdesign/document"
import { looksLikeJson, notTextValue } from "./text-from.js"

export type FormProblem = { readonly code: "field"; readonly detail: string }

function sentText(register: Register, change: AgentChange): string | undefined {
  if ("op" in change) {
    if (change.op !== "set" && change.op !== "add") return undefined
    const value = "text" in change ? change.text?.value : undefined
    return typeof value === "string" ? value : undefined
  }
  if (change.property === "box" || slideKind(change.node) !== null) return undefined
  return openingElement(register, change.node)?.kind === "shape" ? change.value : undefined
}

export function formProblem(register: Register, changes: readonly AgentChange[]): FormProblem | undefined {
  for (const [at, change] of changes.entries()) {
    const value = sentText(register, change)
    if (value === undefined || !looksLikeJson(value) || readTextValue(value) !== null) continue
    return { code: "field", detail: `Change ${String(at + 1)}: ${notTextValue}` }
  }
  return undefined
}
