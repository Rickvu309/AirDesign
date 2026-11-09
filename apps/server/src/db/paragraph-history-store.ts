import {assertNativeSourceTextEdits} from "../../../../packages/pptx/src/text/source-edits.ts"
import {UnsupportedTextFormat} from "../../../../packages/pptx/src/text/cascade.ts"
import {templateSources} from "../templates/source-store.ts"
import type {NativeChangeSet} from "../../../../packages/deck/src/text/operations.ts"
import {decodeStoredCatalogSource} from "../../../../packages/catalog/src/text/seed.ts"
import pg from "pg"
import {randomUUID} from "node:crypto"
import {accountDeletionStore} from "../account/deletion-store.ts"
import {exportStore} from "../decks/export-store.ts"
import {imageStore} from "../images/store.ts"
import {toolSnapshots} from "../../../../packages/tools/src/snapshots.ts"
import {agentStore} from "../agent/store.ts"
import type {ParagraphSnapshot} from "../../../../packages/rpc/src/text/snapshot.ts"
import {isDeepStrictEqual} from "node:util"
import {catalogWithModel, type CatalogSql} from "../../../../packages/catalog/src/index.ts"
import {commandId, executionMatches, projectHistory, type History, type Principal, type ExecutionIdentity} from "../../../../packages/change-log/src/index.ts"
import {executeNative, initialNativeHistory, nativeHistoryModel} from "../../../../packages/change-log/src/text/native-model.ts"
import {legacyRequestPayloadV2, legacyThemeOnlyV2} from "../../../../packages/change-log/src/text/legacy-request-v2.ts"
import {parseNativeArchiveV3, type NativeDeck} from "../../../../packages/deck/src/text/native-v3.ts"
import {parseNativeCommandV3} from "../../../../packages/rpc/src/parse-command.ts"
import {usageLedger} from "../../../../packages/usage/src/ledger.ts"
import {lockRetainedAccount} from "../account/deletion-store.ts"
import {completeHistory} from "./paragraph-history-rows.ts"
import {currentProjection, rebuildHistoryIndex} from "./history-index.ts"
import {nativeParagraphCapability, paragraphAdmission, paragraphProtocol} from "./paragraph-protocol.ts"

import type {ParagraphCommandRequest} from "../../../../packages/rpc/src/text/command-request.ts"
export type {ParagraphCommandRequest} from "../../../../packages/rpc/src/text/command-request.ts"
export function createParagraphHistoryStore(url: string, clock = Date.now) {
  const pool = new pg.Pool({connectionString: url, max: 4})
  async function transaction<T>(work: (tx: CatalogSql) => Promise<T>) {
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const result = await work(client)
      await client.query("COMMIT")
      return result
    } catch (error) { await client.query("ROLLBACK"); throw error }
    finally { client.release() }
  }
  async function owned(tx: CatalogSql, principal: Principal, deck: string) {
    await lockRetainedAccount(tx, principal.personId)
    const row = (await tx.query<{state: History<NativeDeck>; deleted: boolean}>("SELECT state,deleted FROM editing_deck WHERE id=$1 AND owner=$2 FOR UPDATE", [deck, principal.personId])).rows[0]
    if (!row) throw new Error("deck-not-found")
    if (row.deleted) throw new Error("deck-deleted")
    await paragraphAdmission(tx, "paragraph-body-v3")
    return row.state
  }
  async function validateHistory(tx: CatalogSql, deck: string, state: History<NativeDeck>) {
    parseNativeArchiveV3({version: 3, deck: state.initial})
    parseNativeArchiveV3({version: 3, deck: state.deck})
    const history = await completeHistory(tx, deck, state)
    if (!isDeepStrictEqual(projectHistory(history, nativeHistoryModel), history.deck)) throw new Error("native-persisted-projection-mismatch")
    const metadata = (await tx.query("SELECT metadata FROM editing_paragraph WHERE deck=$1 AND version=3", [deck])).rows[0]
    if (!metadata) throw new Error("native-history-metadata-missing")
    return history
  }
  async function validateResources(tx: CatalogSql, principal: Principal, deck: NativeDeck) {
    for (const node of nativeHistoryModel.nodes(deck)) if (node.fields.kind === "image") {
      const image = node.fields.image
      if (!image || typeof image !== "object" || Array.isArray(image) || typeof image.asset !== "string") throw new Error("invalid-image")
      if (!(await tx.query("SELECT hash FROM image_asset WHERE owner=$1 AND hash=$2", [principal.personId, image.asset])).rows.length) throw new Error("asset-not-found")
    }
    for (const slide of deck.slides) if (slide.layout && !(await tx.query("SELECT sha FROM template_source WHERE owner=$1 AND id=$2 AND version=$3", [principal.personId, slide.layout.template, slide.layout.version])).rows.length) throw new Error("template-source-not-found")
  }
  function requestId(request: ParagraphCommandRequest) {
    if (!request.command || typeof request.command !== "object" || !("id" in request.command) || typeof request.command.id !== "string") throw new Error("invalid-command")
    return commandId(request.command.id)
  }
  async function receipt(tx: CatalogSql, deck: string, request: ParagraphCommandRequest, identity: ExecutionIdentity, preparation?: string) {
    const id = requestId(request)
    const payload = legacyRequestPayloadV2(request.command, identity, (preparation ?? ("preparation" in request ? request.preparation : undefined)))
    const prior = (await tx.query<{payload: string; receiptBytes: string; version: 2 | 3}>("SELECT payload,receipt::text AS \"receiptBytes\",history_version AS version FROM editing_receipt WHERE deck=$1 AND id=$2", [deck, id])).rows[0]
    if (prior) {
      if (prior.payload !== payload) throw new Error("request-id-payload-mismatch")
      return {version: prior.version, receiptBytes: prior.receiptBytes}
    }
    return null
  }
  const nativeTransaction = <T>(work: (tx: CatalogSql) => Promise<T>) => transaction(async tx => {
    await tx.query("LOCK TABLE editing_deck IN ROW EXCLUSIVE MODE")
    await paragraphAdmission(tx, "paragraph-body-v3")
    await nativeParagraphCapability(tx)
    return work(tx)
  })
  return {
    protocol: () => transaction(paragraphProtocol),
    retry: (principal: Principal, deck: string, request: ParagraphCommandRequest, identity: ExecutionIdentity = {kind: "person"}) => transaction(async tx => {
      await owned(tx, principal, deck)
      return receipt(tx, deck, request, identity)
    }),
    catalog: catalogWithModel(nativeTransaction, clock, {
      initial: input => initialNativeHistory(parseNativeArchiveV3({version: 3, deck: input}).deck),
      initialize: async (tx, principal, history) => {
        await validateResources(tx, principal, history.deck)
        await rebuildHistoryIndex(tx, history.deck.id, history)
        await tx.query("INSERT INTO editing_paragraph(deck,version,metadata) VALUES($1,3,$2)", [history.deck.id, JSON.stringify({lifetimes: [], prefixes: [], convertedSeq: 0})])
      },
      read: validateHistory,
      projection: currentProjection,
      requestSource: decodeStoredCatalogSource,
      textPath: '$.deck.slides[*].elements.** ? (@.kind == "text").body.paragraphs[*].runs[*].text'
    }),
    exports: exportStore(nativeTransaction, clock, "paragraph-body-v3"),
    deletions: accountDeletionStore(nativeTransaction, clock),
    images: imageStore(nativeTransaction),
    templateSources: templateSources(nativeTransaction),
    snapshots: toolSnapshots(nativeTransaction, clock, "paragraph-body-v3"),
    agents: agentStore(nativeTransaction, clock),
    create: (principal: Principal, deck: NativeDeck) => nativeTransaction(async tx => {
      await lockRetainedAccount(tx, principal.personId)
      const history = initialNativeHistory({...deck, version: 0})
      await validateResources(tx, principal, deck)
      await tx.query("INSERT INTO editing_deck(id,owner,state,updated_at,created_at) VALUES($1,$2,$3,$4,$4)", [deck.id, principal.personId, JSON.stringify(currentProjection(history)), clock()])
      await tx.query("INSERT INTO editing_paragraph(deck,version,metadata) VALUES($1,3,$2)", [deck.id, JSON.stringify({lifetimes: [], prefixes: [], convertedSeq: 0})])
      return {deck: history.deck, seq: 0}
    }),
    delete: (principal: Principal, deck: string) => transaction(async tx => {
      await owned(tx, principal, deck)
      await nativeParagraphCapability(tx)
      await tx.query("UPDATE editing_deck SET deleted=true,deleted_at=$2 WHERE id=$1", [deck, clock()])
    }),
    issueRunToken: (principal: Principal, deck: string, run: string) => transaction(async tx => {
      await owned(tx, principal, deck)
      if (!(await tx.query("SELECT id FROM editing_run WHERE deck=$1 AND id=$2", [deck, run])).rows.length) throw new Error("run-not-found")
      await nativeParagraphCapability(tx)
      const token = randomUUID()
      await tx.query("INSERT INTO editing_run_credential(token,deck,run) VALUES($1,$2,$3)", [token, deck, run])
      return token
    }),
    runIdentity: (principal: Principal, deck: string, token: string): Promise<ExecutionIdentity> => transaction(async tx => {
      await owned(tx, principal, deck)
      const row = (await tx.query<{run: string}>("SELECT run FROM editing_run_credential WHERE token=$1 AND deck=$2", [token, deck])).rows[0]
      if (!row) throw new Error("invalid-run-credential")
      return {kind: "run", run: row.run}
    }),
    snapshot: (principal: Principal, deck: string): Promise<ParagraphSnapshot> => transaction(async tx => {
      const history = await validateHistory(tx, deck, await owned(tx, principal, deck))
      const receipts = await tx.query<{id: string}>("SELECT id FROM editing_receipt WHERE deck=$1 AND receipt->>'kind'='applied' ORDER BY id", [deck])
      return {version: 3, protocol: "paragraph-body-v3", deck: history.deck, seq: history.seq, contributions: {history, applied: receipts.rows.map(row => commandId(row.id))}}
    }),
    replay: (principal: Principal, deck: string, after: number) => transaction(async tx => {
      const state = await owned(tx, principal, deck)
      if (!Number.isSafeInteger(after) || after < 0 || after > state.seq) throw new Error("invalid-sequence")
      const events = await tx.query<{seq: number; version: 2 | 3; commandBytes: string; receiptBytes: string}>("SELECT seq,history_version AS version,command::text AS \"commandBytes\",receipt::text AS \"receiptBytes\" FROM editing_event WHERE deck=$1 AND seq>$2 ORDER BY seq LIMIT 100", [deck, after])
      return {protocol: "paragraph-body-v3", head: state.seq, events: events.rows}
    }),
    close: () => pool.end(),
    read: (principal: Principal, deck: string) => transaction(async tx => validateHistory(tx, deck, await owned(tx, principal, deck))),
    commit: (principal: Principal, deck: string, request: ParagraphCommandRequest, identity: ExecutionIdentity = {kind: "person"}, admission?: {kind: "hosted"} | {kind: "prepared"; key: string; changes: (deck: NativeDeck) => NativeChangeSet}) => transaction(async tx => {
      const state = await owned(tx, principal, deck)
      const preparation = admission?.kind === "prepared" ? admission : undefined
      const prior = await receipt(tx, deck, request, identity, preparation?.key)
      if (prior) return prior
      const id = requestId(request)
      const payload = legacyRequestPayloadV2(request.command, identity, preparation?.key ?? ("preparation" in request ? request.preparation : undefined))
      if (request.version !== 3 || ("preparation" in request ? request.preparation : undefined) !== undefined) throw new Error("legacy-command-reconciliation-required")
      let command = parseNativeCommandV3(request)
      if (!executionMatches(command, identity)) throw new Error("execution-identity-mismatch")
      const history = await validateHistory(tx, deck, state)
      if (preparation) {
        if (command.kind !== "edit" || identity.kind !== "person") throw new Error("person-edit-required")
        command = {...command, base: history.seq, changes: preparation.changes(history.deck)}
      }
      if (admission?.kind === "hosted" && identity.kind === "run" && !history.runs.some(run => run.id === identity.run)) history.runs.push({id: identity.run, epoch: history.seq, kind: "open"})
      let result = executeNative(history, command, identity)
      await nativeParagraphCapability(tx)
      if (result.receipt.kind === "applied") {
        const source = (await tx.query<{bytes: Buffer}>("SELECT bytes FROM catalog_source WHERE deck=$1", [deck])).rows[0]
        if (source) try {await assertNativeSourceTextEdits(source.bytes, result.history.deck)} catch (error) {
          if (!(error instanceof UnsupportedTextFormat)) throw error
          result = {history, receipt: {id: command.id, seq: history.seq, kind: "refused", code: error.message, command}}
        }
      }
      if (result.receipt.kind === "applied") {
        if (!legacyThemeOnlyV2(history.deck, result.history.deck) && identity.kind === "run" && (command.kind === "edit" || command.kind === "patch" || command.kind === "undo-change")) {
          const ledger = usageLedger(work => work(tx), clock)
          const admission = await ledger.reserve(principal.personId, {id: `${deck}:${id}`, actor: identity.actor ?? "user-agent", request: JSON.stringify(command), units: 1})
          if (admission.kind === "out-of-usage") result = {history, receipt: {id: command.id, seq: history.seq, kind: "refused", code: "out-of-usage", command}}
          else await ledger.settle(principal.personId, admission.reservation, "finished")
        }
      }
      if (result.receipt.kind === "applied") {
        await validateResources(tx, principal, result.history.deck)
        await rebuildHistoryIndex(tx, deck, result.history)
        await tx.query("INSERT INTO editing_event(deck,seq,command,receipt,history_version) VALUES($1,$2,$3,$4,3)", [deck, result.history.seq, JSON.stringify(command), JSON.stringify(result.receipt)])
        await tx.query("UPDATE editing_deck SET state=$2,updated_at=$3 WHERE id=$1", [deck, JSON.stringify(currentProjection(result.history)), clock()])
      }
      await tx.query("INSERT INTO editing_receipt(deck,id,payload,receipt,history_version) VALUES($1,$2,$3,$4,3)", [deck, id, payload, JSON.stringify(result.receipt)])
      const saved = (await tx.query<{receiptBytes: string}>("SELECT receipt::text AS \"receiptBytes\" FROM editing_receipt WHERE deck=$1 AND id=$2", [deck, id])).rows[0]
      if (!saved) throw new Error("missing-command-receipt")
      return {version: 3, receiptBytes: saved.receiptBytes}
    })
  }
}

export type ParagraphHistoryStore = ReturnType<typeof createParagraphHistoryStore>
