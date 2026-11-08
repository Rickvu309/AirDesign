import type {CommandId, History} from "../../../change-log/src/index.ts"
import {parseNativeArchiveV3, type NativeDeck} from "../../../deck/src/text/native-v3.ts"
import {parseHistoryContributions} from "../snapshot-history.ts"

export type ParagraphSnapshot = {version: 3; protocol: "paragraph-body-v3"; deck: NativeDeck; seq: number; contributions: {history: History<NativeDeck>; applied: CommandId[]}}
export function parseParagraphSnapshot(value: unknown): ParagraphSnapshot {
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 3 || !("protocol" in value) || value.protocol !== "paragraph-body-v3" || !("deck" in value) || !("seq" in value) || typeof value.seq !== "number" || !Number.isSafeInteger(value.seq) || value.seq < 0 || !("contributions" in value)) throw new Error("invalid-paragraph-snapshot")
  const decode = (deck: unknown) => parseNativeArchiveV3({version: 3, deck}).deck
  const deck = decode(value.deck)
  return {version: 3, protocol: "paragraph-body-v3", deck, seq: value.seq, contributions: parseHistoryContributions(value.contributions, deck, value.seq, decode)}
}
