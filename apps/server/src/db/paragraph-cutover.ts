import type pg from "pg"
import {isDeepStrictEqual} from "node:util"
import type {History} from "../../../../packages/change-log/src/index.ts"
import {currentProjection, rebuildHistoryIndex} from "./history-index.ts"
import {legacyHistoryArchive} from "./paragraph-history-rows.ts"
import {convertParagraphArchives} from "./paragraph-conversion.ts"
import {reconcileParagraphFrozenState} from "./paragraph-frozen-state.ts"
import {lockParagraphRelations, nativeParagraphCapability} from "./paragraph-protocol.ts"

export type ParagraphCutoverPause = {kind: "paused"; drafts: "retained-or-visibly-refused"; oldReaders: "retired"}
export type ParagraphCutoverOptions = {pause: ParagraphCutoverPause; lockBudgetMs: number; conversionBudgetMs: number; signal?: AbortSignal}
export async function cutoverParagraphHistory(client: pg.Client, options: ParagraphCutoverOptions) {
  if (options.pause.kind !== "paused" || options.pause.drafts !== "retained-or-visibly-refused" || options.pause.oldReaders !== "retired") throw new Error("paragraph-pause-required")
  if (!Number.isSafeInteger(options.lockBudgetMs) || options.lockBudgetMs < 1) throw new Error("invalid-lock-budget")
  options.signal?.throwIfAborted()
  const started = performance.now()
  await client.query("BEGIN")
  try {
    await client.query("SELECT set_config('lock_timeout',$1,true)", [`${options.lockBudgetMs}ms`])
    const locked = await lockParagraphRelations(client)
    options.signal?.throwIfAborted()
    const marker = (await client.query<{protocol: string}>("SELECT protocol FROM editing_protocol WHERE singleton FOR UPDATE")).rows[0]
    if (!marker) throw new Error("paragraph-protocol-missing")
    if (marker.protocol === "paragraph-body-v3") {
      await client.query("COMMIT")
      return {kind: "already-native", decks: 0, conversionMs: 0, lockMs: performance.now() - locked, wholeMs: performance.now() - started}
    }
    if (marker.protocol !== "legacy-text-v2") throw new Error("editing-protocol-mismatch")
    const rows = await client.query<{id: string; state: History}>("SELECT id,state FROM editing_deck ORDER BY id")
    const archives = []
    for (const row of rows.rows) archives.push(await legacyHistoryArchive(client, row.id, row.state))
    const converted = await convertParagraphArchives(archives, options.conversionBudgetMs, options.signal)
    options.signal?.throwIfAborted()
    await nativeParagraphCapability(client)
    await reconcileParagraphFrozenState(client)
    for (const archive of converted.archives) {
      options.signal?.throwIfAborted()
      const deck = archive.history.deck.id
      await rebuildHistoryIndex(client, deck, archive.history)
      await client.query("UPDATE editing_deck SET state=$2 WHERE id=$1", [deck, JSON.stringify(currentProjection(archive.history))])
      await client.query("INSERT INTO editing_paragraph(deck,version,metadata) VALUES($1,3,$2)", [deck, JSON.stringify({lifetimes: archive.lifetimes, prefixes: archive.prefixes, convertedSeq: archive.history.seq})])
      const receipts = await client.query<{id: string; payload: string; receiptBytes: string}>("SELECT id,payload,receipt::text AS \"receiptBytes\" FROM editing_receipt WHERE deck=$1 ORDER BY id", [deck])
      const events = await client.query<{seq: number; commandBytes: string; receiptBytes: string}>("SELECT seq,command::text AS \"commandBytes\",receipt::text AS \"receiptBytes\" FROM editing_event WHERE deck=$1 ORDER BY seq", [deck])
      if (!isDeepStrictEqual(receipts.rows, archive.immutable.receipts) || !isDeepStrictEqual(events.rows, archive.immutable.events.map(({identity, ...row}) => {void identity; return row}))) throw new Error("paragraph-immutable-archive-changed")
    }
    await client.query("UPDATE schema_version SET version=3 WHERE name='history'")
    await client.query("UPDATE editing_protocol SET protocol='paragraph-body-v3' WHERE singleton")
    options.signal?.throwIfAborted()
    await client.query("COMMIT")
    return {kind: "converted", decks: converted.archives.length, conversionMs: converted.conversionMs, lockMs: performance.now() - locked, wholeMs: performance.now() - started}
  } catch (error) { await client.query("ROLLBACK"); throw error }
}
