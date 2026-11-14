import { slideReaders, type CallRefusal } from "@airdesign/catalog"
import type { Register } from "@airdesign/document"
import { decided, ready } from "./agent-elements.js"
import type { Caller, Deck } from "./call.js"

type Built =
  | { readonly ok: true; readonly register: Register; readonly runId: string }
  | { readonly ok: false; readonly refusal: CallRefusal }

export function agentBackground(deck: Deck, caller: Caller, raw: unknown): Built {
  if (caller.actor !== "agent") return { ok: false, refusal: "field" }
  const parsed = slideReaders.set_background(raw)
  if (!parsed.ok) return parsed
  const opened = ready(parsed, deck, parsed.slide, caller.runId)
  if ("refusal" in opened) return { ok: false, refusal: opened.refusal }
  const edit = { slide: "background", id: parsed.slide, color: parsed.color, runId: caller.runId } as const
  return decided(deck.register, opened.file, edit, caller.runId)
}
