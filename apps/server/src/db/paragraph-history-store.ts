import pg from "pg"
import {isDeepStrictEqual} from "node:util"
import type {CatalogSql} from "../../../../packages/catalog/src/index.ts"
import {commandId, executionMatches, projectHistory, type History, type Principal, type ExecutionIdentity} from "../../../../packages/change-log/src/index.ts"
import {executeNative, nativeHistoryModel} from "../../../../packages/change-log/src/text/native-model.ts"
import {legacyRequestPayloadV2, legacyThemeOnlyV2} from "../../../../packages/change-log/src/text/legacy-request-v2.ts"
import {parseNativeArchiveV3, type NativeDeck} from "../../../../packages/deck/src/text/native-v3.ts"
import {parseNativeCommandV3} from "../../../../packages/rpc/src/parse-command.ts"
import {usageLedger} from "../../../../packages/usage/src/ledger.ts"
import {lockRetainedAccount} from "../account/deletion-store.ts"
import {completeHistory} from "./paragraph-history-rows.ts"
import {currentProjection, rebuildHistoryIndex} from "./history-index.ts"
import {nativeParagraphCapability, paragraphAdmission} from "./paragraph-protocol.ts"

export type ParagraphCommandRequest = {version: 2 | 3; command: unknown; preparation?: string}
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
  return {
    close: () => pool.end(),
    read: (principal: Principal, deck: string) => transaction(async tx => validateHistory(tx, deck, await owned(tx, principal, deck))),
    commit: (principal: Principal, deck: string, request: ParagraphCommandRequest, identity: ExecutionIdentity = {kind: "person"}) => transaction(async tx => {
      const state = await owned(tx, principal, deck)
      if (!request.command || typeof request.command !== "object" || !("id" in request.command) || typeof request.command.id !== "string") throw new Error("invalid-command")
      const id = commandId(request.command.id)
      const payload = legacyRequestPayloadV2(request.command, identity, request.preparation)
      const prior = (await tx.query<{payload: string; receiptBytes: string; version: 2 | 3}>("SELECT payload,receipt::text AS \"receiptBytes\",history_version AS version FROM editing_receipt WHERE deck=$1 AND id=$2", [deck, id])).rows[0]
      if (prior) {
        if (prior.payload !== payload) throw new Error("request-id-payload-mismatch")
        return {version: prior.version, receiptBytes: prior.receiptBytes}
      }
      if (request.version !== 3 || request.preparation !== undefined) throw new Error("legacy-command-reconciliation-required")
      const command = parseNativeCommandV3(request)
      if (!executionMatches(command, identity)) throw new Error("execution-identity-mismatch")
      const history = await validateHistory(tx, deck, state)
      let result = executeNative(history, command, identity)
      await nativeParagraphCapability(tx)
      if (result.receipt.kind === "applied") {
        if (!legacyThemeOnlyV2(history.deck, result.history.deck) && identity.kind === "run" && (command.kind === "edit" || command.kind === "patch" || command.kind === "undo-change")) {
          const ledger = usageLedger(work => work(tx), clock)
          const admission = await ledger.reserve(principal.personId, {id: `${deck}:${id}`, actor: identity.actor ?? "user-agent", request: JSON.stringify(command), units: 1})
          if (admission.kind === "out-of-usage") result = {history, receipt: {id: command.id, seq: history.seq, kind: "refused", code: "out-of-usage", command}}
          else await ledger.settle(principal.personId, admission.reservation, "finished")
        }
      }
      if (result.receipt.kind === "applied") {
        for (const node of nativeHistoryModel.nodes(result.history.deck)) if (node.fields.kind === "image") {
          const image = node.fields.image
          if (!image || typeof image !== "object" || Array.isArray(image) || typeof image.asset !== "string") throw new Error("invalid-image")
          if (!(await tx.query("SELECT hash FROM image_asset WHERE owner=$1 AND hash=$2", [principal.personId, image.asset])).rows.length) throw new Error("asset-not-found")
        }
        for (const slide of result.history.deck.slides) if (slide.layout && !(await tx.query("SELECT sha FROM template_source WHERE owner=$1 AND id=$2 AND version=$3", [principal.personId, slide.layout.template, slide.layout.version])).rows.length) throw new Error("template-source-not-found")
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
