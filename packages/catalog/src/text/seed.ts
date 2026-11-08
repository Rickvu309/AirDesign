import {parseDeck} from "../../../deck/src/parse.ts"
import {isNativeDeck, parseNativeArchiveV3, type NativeDeck} from "../../../deck/src/text/native-v3.ts"
import {initialHistory} from "../../../change-log/src/index.ts"
import {transduceLegacyHistory} from "../../../change-log/src/text/history-transducer.ts"

export function decodeLegacyCatalogDeckV2(input: unknown): NativeDeck {
  const deck=parseDeck(input)
  return transduceLegacyHistory({version: 2, history: initialHistory({...deck,version:0}), immutable: {version: 2, events: [], receipts: []}}).history.deck
}
export function decodeCatalogImportV3(report: Record<string, unknown>): NativeDeck {
  if (report.deckVersion === 3) return parseNativeArchiveV3({version: 3, deck: report.deck}).deck
  if (report.deckVersion === undefined || report.deckVersion === 2) return decodeLegacyCatalogDeckV2(report.deck)
  throw new Error("unsupported-catalog-import-version")
}
export function decodeStoredCatalogSource(input: unknown): NativeDeck | null {
  if (input === null) return null
  return isNativeDeck(input) ? parseNativeArchiveV3({version: 3, deck: input}).deck : decodeLegacyCatalogDeckV2(input)
}
