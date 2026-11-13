import { bytesOf } from "@airdesign/document"
import { readTurn, type ModelMessage, type ToolAnswer } from "@airdesign/catalog"
import {
  airaChat,
  airaStep,
  type AiraChat,
  type AiraEnd,
  type AiraExchange,
  type AiraStep,
  type ToolState,
} from "@/aira-loop"

export type SavedChat = {
  readonly id: string
  readonly deck: string
  readonly title: string
  readonly asked: string
  readonly started: number
  readonly updated: number
  readonly history: readonly ModelMessage[]
  readonly answers: readonly ToolAnswer[]
  readonly exchanges: readonly AiraExchange[]
}

export type SaveQueue = { readonly writing: boolean; readonly next: readonly SavedChat[] }

export type SaveEvent = { readonly type: "changed"; readonly chat: SavedChat } | { readonly type: "written" }

export const chatsKept = 20
export const chatBytes = 262_144
export const leftOut = "Left out to save space on this device."
export const closedAnswer = "The page closed before this call finished. Read the deck before you rely on it."

const titleLength = 120
const ends: ReadonlySet<string> = new Set<AiraEnd>([
  "working",
  "done",
  "stopped",
  "failed",
  "out-of-usage",
  "signed-out",
  "country",
  "off",
  "malformed",
  "undone",
])
const toolStates: ReadonlySet<string> = new Set(["working", "done", "refused", "stopped"])

function sizeOf(value: unknown): number {
  return bytesOf(JSON.stringify(value))
}

export function chatTitle(asked: string): string {
  const line = asked.trim().split("\n")[0] ?? ""
  const end = /[.!?](?=\s|$)/u.exec(line)
  const sentence = (end === null ? line : line.slice(0, end.index + 1)).replace(/\s+/gu, " ").trim()
  const space = sentence.lastIndexOf(" ", titleLength)
  const cut = sentence.length <= titleLength ? sentence : sentence.slice(0, space > 0 ? space : titleLength)
  const title = cut.replace(/[\s.,;:!?…\-–—]+$/u, "")
  return title === "" ? line.slice(0, titleLength) : title
}

function withoutResults(message: ModelMessage): ModelMessage {
  if (message.role !== "user" || !Array.isArray(message.content)) return message
  return {
    ...message,
    content: message.content.map((block) => (block.type === "tool_result" ? { ...block, content: leftOut } : block)),
  }
}

function fitted(chat: SavedChat): SavedChat {
  if (sizeOf(chat) <= chatBytes) return chat
  let history = [...chat.history]
  for (const [index, message] of history.entries()) {
    history[index] = withoutResults(message)
    if (sizeOf({ ...chat, history }) <= chatBytes) return { ...chat, history }
  }
  history = []
  let exchanges = [...chat.exchanges]
  while (exchanges.length > 1 && sizeOf({ ...chat, history, answers: [], exchanges }) > chatBytes) {
    exchanges = exchanges.slice(1)
  }
  return { ...chat, history, answers: [], exchanges }
}

export function savedChat(
  chat: AiraChat,
  at: { readonly id: string; readonly started: number; readonly updated: number },
): SavedChat {
  const asked = chat.exchanges[0]?.asked ?? ""
  return fitted({
    id: at.id,
    deck: chat.deck,
    title: chatTitle(asked),
    asked,
    started: at.started,
    updated: at.updated,
    history: chat.history,
    answers: chat.answers,
    exchanges: chat.exchanges,
  })
}

function openCalls(chat: AiraChat): readonly ToolAnswer[] {
  const last = chat.history.at(-1)
  if (last?.role !== "assistant" || !Array.isArray(last.content)) return []
  const answered = new Set(chat.answers.map((answer) => answer.tool_use_id))
  return last.content.flatMap((block): ToolAnswer[] =>
    block.type === "tool_use" && !answered.has(block.id)
      ? [{ type: "tool_result", tool_use_id: block.id, content: closedAnswer, is_error: true }]
      : [],
  )
}

export function restoredChat(saved: SavedChat): AiraChat {
  const chat: AiraChat = {
    ...airaChat(saved.deck),
    history: saved.history,
    answers: saved.answers,
    exchanges: saved.exchanges,
  }
  const settled = { ...chat, answers: [...chat.answers, ...openCalls(chat)] }
  return chat.exchanges.at(-1)?.end === "working" ? airaStep(settled, { type: "end", end: "stopped" }) : settled
}

export function newestOfEach(chats: readonly SavedChat[]): readonly SavedChat[] {
  const newest = new Map<string, SavedChat>()
  for (const chat of chats) {
    const known = newest.get(chat.id)
    if (known === undefined || chat.updated > known.updated) newest.set(chat.id, chat)
  }
  return [...newest.values()]
}

export function droppedChats(chats: readonly SavedChat[], open: string): readonly string[] {
  const others = [...chats].filter((chat) => chat.id !== open).sort((one, two) => two.updated - one.updated)
  return others.slice(chatsKept - 1).map((chat) => chat.id)
}

export function saveStep(
  queue: SaveQueue,
  event: SaveEvent,
): { readonly queue: SaveQueue; readonly write: SavedChat | null } {
  if (event.type === "changed") {
    if (!queue.writing) return { queue: { writing: true, next: [] }, write: event.chat }
    const next = [...queue.next.filter((chat) => chat.id !== event.chat.id), event.chat]
    return { queue: { writing: true, next }, write: null }
  }
  const [first, ...rest] = queue.next
  if (first !== undefined) return { queue: { writing: true, next: rest }, write: first }
  return { queue: { writing: false, next: [] }, write: null }
}

function fieldsOf(raw: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined
}

function readStep(raw: unknown): AiraStep | undefined {
  const step = fieldsOf(raw)
  if (step === undefined) return undefined
  if ((step.kind === "text" || step.kind === "added") && typeof step.text === "string") {
    return { kind: step.kind, text: step.text }
  }
  if (
    step.kind === "tool" &&
    typeof step.id === "string" &&
    typeof step.name === "string" &&
    typeof step.state === "string" &&
    toolStates.has(step.state)
  ) {
    return { kind: "tool", id: step.id, name: step.name, state: step.state as ToolState }
  }
  return undefined
}

function readExchange(raw: unknown): AiraExchange | undefined {
  const exchange = fieldsOf(raw)
  if (exchange === undefined || typeof exchange.asked !== "string" || !Array.isArray(exchange.steps)) return undefined
  if (typeof exchange.end !== "string" || !ends.has(exchange.end) || !Array.isArray(exchange.runs)) return undefined
  const steps = exchange.steps.map(readStep)
  const runs = exchange.runs.filter((run): run is string => typeof run === "string")
  if (steps.some((step) => step === undefined) || runs.length !== exchange.runs.length) return undefined
  const read: AiraExchange = { asked: exchange.asked, steps: steps as AiraStep[], end: exchange.end as AiraEnd, runs }
  return exchange.undoRefused === true ? { ...read, undoRefused: true } : read
}

function readModel(
  deck: string,
  history: unknown,
  answers: unknown,
): { readonly history: readonly ModelMessage[]; readonly answers: readonly ToolAnswer[] } {
  const none = { history: [], answers: [] }
  if (!Array.isArray(history) || !Array.isArray(answers)) return none
  if (history.length === 0) return none
  const probe = {
    role: "user",
    content: answers.length === 0 ? "probe" : [...answers, { type: "text", text: "probe" }],
  }
  const read = readTurn({ deck, messages: [...history, probe] })
  if (!read.ok) return none
  const last = read.messages.at(-1)
  const kept = Array.isArray(last?.content)
    ? last.content.flatMap((block) => (block.type === "tool_result" ? [block] : []))
    : []
  return { history: read.messages.slice(0, -1), answers: kept }
}

export function readSavedChat(raw: unknown, deck: string): SavedChat | undefined {
  const chat = fieldsOf(raw)
  if (chat === undefined || chat.deck !== deck || typeof chat.id !== "string" || chat.id === "") return undefined
  if (typeof chat.title !== "string" || typeof chat.asked !== "string") return undefined
  if (typeof chat.started !== "number" || typeof chat.updated !== "number" || !Array.isArray(chat.exchanges)) {
    return undefined
  }
  const exchanges = chat.exchanges.map(readExchange)
  if (exchanges.length === 0 || exchanges.some((exchange) => exchange === undefined)) return undefined
  return {
    id: chat.id,
    deck,
    title: chatTitle(chat.asked),
    asked: chat.asked,
    started: chat.started,
    updated: chat.updated,
    ...readModel(deck, chat.history, chat.answers),
    exchanges: exchanges as AiraExchange[],
  }
}
