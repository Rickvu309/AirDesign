import type {Deck} from "../../../deck/src/model.ts"
import {parseDeck} from "../../../deck/src/parse.ts"
import {parseNativeArchiveV3, type NativeDeck} from "../../../deck/src/text/native-v3.ts"
import type {AssetProvenance} from "../../../files/src/assets/provenance.ts"

export type SavedVersion<D extends Deck | NativeDeck = Deck> = {deck: D; seq: number; source: string | null; title: string; assets?: Record<string, string>; provenance?: Record<string, AssetProvenance>; templates?: Record<string, string>}
export type ExportSnapshot = {snapshotVersion: 2; snapshot: SavedVersion} | {snapshotVersion: 3; snapshot: SavedVersion<NativeDeck>}
export function decodeExportSnapshot(version: unknown, snapshot: SavedVersion<Deck | NativeDeck>): ExportSnapshot {
  if (!Number.isSafeInteger(snapshot.seq) || snapshot.seq < 0 || typeof snapshot.title !== "string" || (snapshot.source !== null && typeof snapshot.source !== "string")) throw new Error("invalid-saved-version")
  if (version === 2) return {snapshotVersion: 2, snapshot: {...snapshot, deck: parseDeck(snapshot.deck)}}
  if (version === 3) return {snapshotVersion: 3, snapshot: {...snapshot, deck: parseNativeArchiveV3({version: 3, deck: snapshot.deck}).deck}}
  throw new Error("unsupported-export-snapshot-version")
}

export function selectExportSlides<T extends {id: string}>(slides: readonly T[], selection: readonly string[]): T[] {
  return selection.length ? selection.map(id => {const slide = slides.find(slide => slide.id === id); if (!slide) throw new Error("invalid-slide-range"); return slide}) : [...slides]
}
