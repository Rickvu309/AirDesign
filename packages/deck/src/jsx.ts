import type {Deck} from "./model.ts"
import {parseNativeArchiveV3, type NativeDeck} from "./text/native-v3.ts"
export type DeckJsxAdapter<T, D extends Deck | NativeDeck = NativeDeck> = {toJsx: (deck: D) => T; fromJsx: (value: T) => unknown}
export function toJsx<T, D extends Deck | NativeDeck>(deck: D, adapter: DeckJsxAdapter<T, D>): T {return adapter.toJsx(deck)}
export function fromJsx<T>(value: T, adapter: DeckJsxAdapter<T>): NativeDeck {return parseNativeArchiveV3({version: 3, deck: adapter.fromJsx(value)}).deck}
