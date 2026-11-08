import type {TextProtocol} from "../../../../packages/rpc/src/text/protocol.ts"
import {z} from "zod"
import type {History, Principal, ExecutionIdentity} from "../../../../packages/change-log/src/index.ts"
import type {Deck} from "../../../../packages/deck/src/index.ts"
import type {NativeDeck} from "../../../../packages/deck/src/text/native-v3.ts"
import {parseCommand} from "../../../../packages/rpc/src/parse-command.ts"
import type {HistoryStore} from "./history-store.ts"
import type {ParagraphHistoryStore} from "./paragraph-history-store.ts"

const receipt = z.discriminatedUnion("kind", [
  z.object({kind: z.literal("applied"), id: z.string(), seq: z.number().int().nonnegative()}),
  z.object({kind: z.literal("refused"), id: z.string(), seq: z.number().int().nonnegative(), code: z.string()}),
])
export async function activeHistory(history: HistoryStore, paragraphs?: ParagraphHistoryStore) {
  const state = await paragraphs?.protocol()
  if (state?.kind === "paused") throw new Error("editing-paused")
  const native = state?.protocol === "paragraph-body-v3" ? paragraphs : undefined
  const protocol: TextProtocol = native ? "paragraph-body-v3" : "legacy-text-v2"
  return {
    protocol,
    agents: native?.agents ?? history.agents,
    async read(principal: Principal, deck: string): Promise<History<Deck | NativeDeck>> {
      return native ? native.read(principal, deck) : (await history.read(principal, deck)).contributions.history
    },
    async commit(principal: Principal, deck: string, command: unknown, identity: ExecutionIdentity = {kind: "person"}, hostedBase?: number) {
      if (native) return receipt.parse(JSON.parse((await native.commit(principal, deck, {version: 3, command}, identity, hostedBase === undefined ? undefined : {kind: "hosted"})).receiptBytes))
      return history.commit(principal, deck, parseCommand(command), identity, undefined, hostedBase)
    },
  }
}
