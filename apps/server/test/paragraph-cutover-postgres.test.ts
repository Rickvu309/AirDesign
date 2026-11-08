import {randomBytes, createHash} from "node:crypto"
import {readFile} from "node:fs/promises"
import pg from "pg"
import {expect, it, vi} from "vitest"
import {fixtureDeck, fixtureElement} from "../../../packages/deck/src/fixture.ts"
import {id} from "../../../packages/deck/src/model.ts"
import {parseDeck} from "../../../packages/deck/src/parse.ts"
import type {NativeDeck, NativeText} from "../../../packages/deck/src/text/native-v3.ts"
import type {NativeChangeSet} from "../../../packages/deck/src/text/operations.ts"
import {commandId, projectHistory, type Command, type History, type ExecutionIdentity} from "../../../packages/change-log/src/index.ts"
import {nativeHistoryModel} from "../../../packages/change-log/src/text/native-model.ts"
import {rebuildHistoryHeads} from "../../../packages/change-log/src/text/history-heads.ts"
import {createHistoryStore, type HistoryStore} from "./fixtures/paragraph-v2/history-store.ts"
import {createParagraphHistoryStore} from "../src/db/paragraph-history-store.ts"
import {prepareParagraphCutover, paragraphLockTables} from "../src/db/paragraph-protocol.ts"
import {cutoverParagraphHistory, type ParagraphCutoverOptions} from "../src/db/paragraph-cutover.ts"

const owner = {personId: "owner"}
const options: ParagraphCutoverOptions = {pause: {kind: "paused", drafts: "retained-or-visibly-refused", oldReaders: "retired"}, lockBudgetMs: 1000, conversionBudgetMs: 30_000}
function barrier() {
  let release = () => {}
  const promise = new Promise<void>(resolve => {release = resolve})
  return {promise, release}
}
async function database(work: (sql: pg.Client, url: string, old: HistoryStore) => Promise<void>) {
  const host = process.env.AIRDESIGN_PG_HOST ?? "/home/quan/.local/pg/sock", user = process.env.AIRDESIGN_PG_USER ?? "quan"
  const admin = new pg.Client({host, user, database: "postgres"})
  await admin.connect()
  const name = `paragraph_${randomBytes(8).toString("hex")}`
  await admin.query(`CREATE DATABASE ${name}`)
  const url = `postgresql://${user}@/${name}?host=${host}`
  const sql = new pg.Client({connectionString: url})
  let old: HistoryStore | undefined
  try {
    await sql.connect()
    old = await createHistoryStore({kind: "postgres", url})
    await work(sql, url, old)
  } finally {
    vi.restoreAllMocks()
    await sql.query("ROLLBACK")
    await sql.end()
    await old?.close()
    await admin.query(`DROP DATABASE ${name}`)
    await admin.end()
  }
}
async function snapshot(sql: pg.Client) {
  const result: Record<string, unknown> = {}
  for (const table of [...paragraphLockTables, "schema_version"]) result[table] = (await sql.query(`SELECT to_jsonb(t)::text AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows
  return result
}
async function immutable(sql: pg.Client) {
  return {events: (await sql.query("SELECT deck,seq,command::text,receipt::text,history_version FROM editing_event ORDER BY deck,seq")).rows, receipts: (await sql.query("SELECT deck,id,payload,receipt::text,history_version FROM editing_receipt ORDER BY deck,id")).rows}
}
async function legacyFixture(old: HistoryStore, count = 4) {
  const deck = fixtureDeck(count), text = deck.slides[0]?.elements[0]
  if (text?.kind !== "text") throw new Error("fixture-text")
  await old.create(owner, deck)
  async function send(command: Command, identity?: ExecutionIdentity) {
    const receipt = await old.commit(owner, deck.id, command, identity)
    expect(receipt.kind).toBe("applied")
    return receipt
  }
  await send({id: commandId("start"), kind: "start-run", run: "agent"})
  const command: Command = {id: commandId("agent-text"), kind: "patch", target: text.id, fields: {runs: [{...text.runs[0], text: "agent\n\n"}]}, base: 1, run: "agent"}
  await send(command, {kind: "run", run: "agent"})
  await send({id: commandId("person-box"), kind: "patch", target: text.id, fields: {box: {...text.box, x: 31}}, base: 2, run: null})
  const child = {...text, id: id("nested")}, shape = fixtureElement(1)
  const {kind, runs, ...base} = text
  void kind; void runs
  await send({id: commandId("nested-group"), kind: "edit", base: 3, run: "agent", changes: {changes: [{kind: "insert", parent: id("s0"), index: 1, value: {...base, id: id("outer"), kind: "group", children: [{...base, id: id("inner"), kind: "group", children: [child]}]}}]}}, {kind: "run", run: "agent"})
  await send({id: commandId("adopt-nested"), kind: "patch", base: 4, run: null, target: child.id, fields: {box: {...child.box, y: 72}}})
  const replacement = structuredClone((await old.read(owner, deck.id)).deck)
  if (!replacement.slides[0]) throw new Error("fixture-slide")
  replacement.slides[0].elements[0] = {...shape, id: text.id}
  await send({id: commandId("kind-close"), kind: "edit", base: 5, run: null, changes: {changes: [{kind: "set", target: deck.id, value: replacement}]}})
  await send({id: commandId("resurrect"), kind: "undo", target: commandId("kind-close")})
  await send({id: commandId("close"), kind: "close-run", run: "agent"})
  await send({id: commandId("undo-agent"), kind: "undo-run", run: "agent"})
  const refusal: Command = {id: commandId("legacy-refused"), kind: "patch", target: id("missing"), fields: {runs: text.runs}, base: 9, run: null}
  expect((await old.commit(owner, deck.id, refusal)).kind).toBe("refused")
  return {deck, command, refusal}
}
function text(history: History<NativeDeck>): NativeText {
  const value = history.deck.slides[0]?.elements[0]
  if (value?.kind !== "text") throw new Error("native-text")
  return value
}

it("uses the unchanged actual pre-native store and keeps startup and preparation legacy", async () => {
  const source = await readFile(new URL("../src/db/history-store.ts", import.meta.url), "utf8")
  const original = await readFile(new URL("./fixtures/paragraph-legacy-store.sha256", import.meta.url), "utf8")
  expect(createHash("sha256").update(source).digest("hex")).toBe(original.trim())
  const manifest: Record<string, {fixture: string; fixtureSha256: string}> = JSON.parse(await readFile(new URL("./fixtures/paragraph-v2/manifest.json", import.meta.url), "utf8"))
  for (const entry of Object.values(manifest)) expect(createHash("sha256").update(await readFile(entry.fixture)).digest("hex")).toBe(entry.fixtureSha256)
  await database(async (sql, url, old) => {
    await old.create(owner, fixtureDeck(2))
    expect((await sql.query("SELECT to_regclass('editing_protocol') AS table")).rows[0]?.table).toBeNull()
    await prepareParagraphCutover(sql)
    await prepareParagraphCutover(sql)
    expect((await old.read(owner, "deck")).deck).toEqual(fixtureDeck(2))
    const native = createParagraphHistoryStore(url)
    try {await expect(native.read(owner, "deck")).rejects.toThrow("editing-protocol-mismatch")}
    finally {await native.close()}
    expect((await sql.query("SELECT protocol FROM editing_protocol")).rows).toEqual([{protocol: "legacy-text-v2"}])
    await old.delete(owner, "deck")
    expect(await cutoverParagraphHistory(sql, options)).toMatchObject({kind: "converted", decks: 1})
    const stored = (await sql.query<{state: History<NativeDeck>; deleted: boolean}>("SELECT state,deleted FROM editing_deck WHERE id='deck'")).rows[0]
    if (!stored) throw new Error("missing-deleted-deck")
    expect(stored.deleted).toBe(true)
    expect(text(stored.state).body.paragraphs).toHaveLength(1)
    expect((await sql.query("SELECT version FROM editing_paragraph WHERE deck='deck'")).rows).toEqual([{version: 3}])
    const reopened = createParagraphHistoryStore(url)
    try {await expect(reopened.read(owner, "deck")).rejects.toThrow("deck-deleted")}
    finally {await reopened.close()}
  })
}, 30_000)

it("persists complete native history, indexes, lifetime reservations, retries and later person protection", async () => {
  await database(async (sql, url, old) => {
    const fixture = await legacyFixture(old)
    await prepareParagraphCutover(sql)
    const before = await immutable(sql), legacy = await old.read(owner, "deck")
    const timing = await cutoverParagraphHistory(sql, options)
    expect(timing).toMatchObject({kind: "converted", decks: 1})
    expect(await immutable(sql)).toEqual(before)
    const persisted = await snapshot(sql)
    expect(await cutoverParagraphHistory(sql, options)).toMatchObject({kind: "already-native"})
    expect(await snapshot(sql)).toEqual(persisted)
    const native = createParagraphHistoryStore(url)
    try {
      let history = await native.read(owner, "deck")
      expect(history.seq).toBe(legacy.seq)
      expect(history.runs).toEqual(legacy.contributions.history.runs)
      expect(history.events.map(event => [event.id, event.active, event.toggledAt, event.actor, event.run])).toEqual(legacy.contributions.history.events.map(event => [event.id, event.active, event.toggledAt, event.actor, event.run]))
      expect(projectHistory(history, nativeHistoryModel)).toEqual(history.deck)
      const heads = rebuildHistoryHeads(history)
      expect((await sql.query("SELECT node,key,event,seq,active FROM editing_property ORDER BY node,key,event")).rows).toEqual(heads.properties.map(({actor, ...row}) => {void actor; return row}).sort((a,b) => a.node.localeCompare(b.node) || a.key.localeCompare(b.key) || a.event.localeCompare(b.event)))
      const metadata = (await sql.query<{metadata: {lifetimes: {frame: string; paragraph: string}[]; prefixes: unknown[]}}>("SELECT metadata FROM editing_paragraph")).rows[0]?.metadata
      expect(metadata?.prefixes).toHaveLength(history.seq + 1)
      expect(history.usedIds).toEqual(expect.arrayContaining(metadata?.lifetimes.flatMap(value => [value.frame, value.paragraph]) ?? []))
      expect(new Set(history.usedIds).size).toBe(history.usedIds.length)
      const retried = await native.commit(owner, "deck", {version: 2, command: fixture.command}, {kind: "run", run: "agent"})
      expect(retried).toMatchObject({version: 2})
      expect(retried.receiptBytes).toBe((await sql.query<{receipt: string}>("SELECT receipt::text FROM editing_receipt WHERE id='agent-text'")).rows[0]?.receipt)
      expect(await native.commit(owner, "deck", {version: 2, command: fixture.refusal})).toMatchObject({version: 2})
      await expect(native.commit(owner, "deck", {version: 2, command: {...fixture.refusal, fields: {runs: []}}})).rejects.toThrow("request-id-payload-mismatch")
      await expect(native.commit(owner, "deck", {version: 2, command: {...fixture.refusal, id: "new-legacy"}})).rejects.toThrow("reconciliation")
      await expect(native.read({personId: "intruder"}, "deck")).rejects.toThrow("deck-not-found")
      await expect(native.commit({personId: "intruder"}, "deck", {version: 2, command: fixture.refusal})).rejects.toThrow("deck-not-found")
      const paragraph = text(history).body.paragraphs[0]
      async function send(command: Command<NativeChangeSet>, identity?: ExecutionIdentity) {
        const receipt = await native.commit(owner, "deck", {version: 3, command}, identity)
        expect(JSON.parse(receipt.receiptBytes)).toEqual({kind: "applied", id: command.id, seq: history.seq + 1})
        history = await native.read(owner, "deck")
      }
      await send({id: commandId("split"), kind: "edit", base: history.seq, run: null, changes: {changes: [{kind: "insert", parent: text(history).id, index: 2, value: {...paragraph, id: id("second-paragraph")}}]}})
      const base = history.seq
      await send({id: commandId("person-first"), kind: "patch", target: paragraph.id, base, run: null, fields: {alignment: "center"}})
      await send({id: commandId("person-second"), kind: "patch", target: id("second-paragraph"), base, run: null, fields: {alignment: "right"}})
      const stale = await native.commit(owner, "deck", {version: 3, command: {id: "stale", kind: "patch", target: paragraph.id, base, run: null, fields: {alignment: "left"}}})
      expect(JSON.parse(stale.receiptBytes)).toMatchObject({kind: "refused", code: "stale-base"})
      const closed = await native.commit(owner, "deck", {version: 3, command: {id: "redo-closed-run", kind: "redo", target: "agent-text"}})
      expect(JSON.parse(closed.receiptBytes)).toMatchObject({kind: "refused", code: "run-closed"})
      await send({id: commandId("native-start"), kind: "start-run", run: "later"})
      await send({id: commandId("native-agent-text"), kind: "patch", target: paragraph.id, base: history.seq, run: "later", fields: {runs: [{kind: "text", text: "native agent", style: paragraph.endStyle}]}}, {kind: "run", run: "later"})
      await send({id: commandId("undo-native"), kind: "undo", target: commandId("native-agent-text")})
      await send({id: commandId("redo-native"), kind: "redo", target: commandId("native-agent-text")})
      await send({id: commandId("person-text"), kind: "patch", target: paragraph.id, base: history.seq, run: null, fields: {runs: [{kind: "text", text: "protected", style: paragraph.endStyle}]}})
      await send({id: commandId("undo-agent-text"), kind: "undo", target: commandId("native-agent-text")})
      expect(text(history).body.paragraphs[0].runs).toMatchObject([{text: "protected"}])
      await sql.query("UPDATE usage_account SET state=jsonb_set(state,'{used}','10000') WHERE owner='owner'")
      const theme = history.deck.themes[0]
      if (!theme) throw new Error("fixture-theme")
      await send({id: commandId("theme-without-charge"), kind: "edit", base: history.seq, run: "later", changes: {changes: [{kind: "set", target: history.deck.id, value: {...history.deck, themes: [{...theme, font: "Arial"}]}}]}}, {kind: "run", run: "later"})
      const exhaustedCommand = {id: commandId("exhausted"), kind: "patch", base: history.seq, run: "later", target: id("second-paragraph"), fields: {alignment: "left"}} satisfies Command<NativeChangeSet>
      const exhausted = await native.commit(owner, "deck", {version: 3, command: exhaustedCommand}, {kind: "run", run: "later"})
      expect(JSON.parse(exhausted.receiptBytes)).toMatchObject({kind: "refused", code: "out-of-usage"})
      expect(await native.commit(owner, "deck", {version: 3, command: exhaustedCommand}, {kind: "run", run: "later"})).toEqual(exhausted)
      expect((await native.read(owner, "deck")).seq).toBe(history.seq)
      expect(await immutable(sql)).toMatchObject({events: expect.arrayContaining(before.events), receipts: expect.arrayContaining(before.receipts)})
    } finally {await native.close()}
    const reopened = createParagraphHistoryStore(url)
    try {expect(text(await reopened.read(owner, "deck")).body.paragraphs.map(value => value.alignment)).toEqual(["center", "right"])}
    finally {await reopened.close()}
    const acceptedFuture = await createHistoryStore({kind: "postgres", url, schema: "connect"})
    try {const incompatible = await acceptedFuture.read(owner, "deck"); expect(() => parseDeck(incompatible.deck)).toThrow()}
    finally {await acceptedFuture.close()}
  })
}, 30_000)

it("blocks actual old refusal writes and every protected zero-row and bulk statement after cutover", async () => {
  await database(async (sql, url, old) => {
    const fixture = await legacyFixture(old)
    await prepareParagraphCutover(sql)
    await cutoverParagraphHistory(sql, options)
    const before = await snapshot(sql)
    await expect(old.commit(owner, "deck", {...fixture.refusal, id: commandId("old-refusal")})).rejects.toThrow("editing-protocol-mismatch")
    await expect(old.commit(owner, "deck", {...fixture.command, id: commandId("old-write")}, {kind: "run", run: "agent"})).rejects.toThrow("editing-protocol-mismatch")
    for (const table of paragraphLockTables) {
      const column = (await sql.query<{name: string}>("SELECT attname AS name FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum LIMIT 1", [table])).rows[0]?.name
      if (!column || !/^[a-z_]+$/.test(column)) throw new Error("fixture-column")
      for (const statement of [`DELETE FROM ${table} WHERE false`, `UPDATE ${table} SET ${column}=${column} WHERE false`, `INSERT INTO ${table} SELECT * FROM ${table} WHERE false`, `TRUNCATE ${table} CASCADE`]) await expect(sql.query(statement)).rejects.toMatchObject({code: "55000"})
    }
    expect(await snapshot(sql)).toEqual(before)
    const stale = new pg.Client({connectionString: url})
    await stale.connect()
    try {await stale.query("BEGIN ISOLATION LEVEL REPEATABLE READ"); await expect(stale.query("DELETE FROM editing_receipt WHERE false")).rejects.toMatchObject({code: "55000"})}
    finally {await stale.query("ROLLBACK"); await stale.end()}
  })
}, 30_000)

it("refuses a receipt-only write from a snapshot established before the protocol changed", async () => {
  await database(async (sql, url, old) => {
    await legacyFixture(old)
    await prepareParagraphCutover(sql)
    const stale = new pg.Client({connectionString: url})
    await stale.connect()
    try {
      await stale.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
      expect((await stale.query("SELECT protocol FROM editing_protocol")).rows).toEqual([{protocol: "legacy-text-v2"}])
      await cutoverParagraphHistory(sql, options)
      await expect(stale.query("INSERT INTO editing_receipt(deck,id,payload,receipt) VALUES($1,$2,$3,$4)", ["deck", "stale-refusal", "payload", JSON.stringify({kind: "refused", id: "stale-refusal", seq: 9, code: "stale-base"})])).rejects.toMatchObject({code: "40001"})
      expect((await sql.query("SELECT id FROM editing_receipt WHERE id='stale-refusal'")).rows).toEqual([])
    } finally {await stale.query("ROLLBACK"); await stale.end()}
  })
}, 30_000)

it("keeps every legacy row on lock timeout, interrupted CPU conversion, injected SQL failure and frozen-state refusal", async () => {
  await database(async (sql, url, old) => {
    await legacyFixture(old, 300)
    await prepareParagraphCutover(sql)
    const before = await snapshot(sql)
    const held = new pg.Client({connectionString: url})
    await held.connect()
    try {
      await held.query("BEGIN")
      await held.query("SELECT id FROM editing_deck")
      await expect(cutoverParagraphHistory(sql, {...options, lockBudgetMs: 10})).rejects.toMatchObject({code: "55P03"})
      expect(await snapshot(sql)).toEqual(before)
    } finally {await held.query("ROLLBACK"); await held.end()}
    await expect(cutoverParagraphHistory(sql, {...options, conversionBudgetMs: 1})).rejects.toThrow("paragraph-conversion-timeout")
    expect(await snapshot(sql)).toEqual(before)
    const controller = new AbortController(), original = pg.Client.prototype.query
    const observed = vi.spyOn(pg.Client.prototype, "query")
    observed.mockImplementation(function(this: pg.Client, ...args: Parameters<typeof original>) {
      const result = Reflect.apply(original, this, args)
      if (typeof args[0] === "string" && args[0].startsWith("INSERT INTO editing_paragraph")) return Promise.resolve(result).then(value => {controller.abort(); return value})
      return result
    })
    await expect(cutoverParagraphHistory(sql, {...options, signal: controller.signal})).rejects.toThrow()
    observed.mockRestore()
    expect(await snapshot(sql)).toEqual(before)
    const injected = vi.spyOn(pg.Client.prototype, "query")
    injected.mockImplementation(function(this: pg.Client, ...args: Parameters<typeof original>) {
      if (typeof args[0] === "string" && args[0].startsWith("INSERT INTO editing_paragraph")) return Promise.reject(new Error("injected-persist-failure"))
      return Reflect.apply(original, this, args)
    })
    await expect(cutoverParagraphHistory(sql, options)).rejects.toThrow("injected-persist-failure")
    injected.mockRestore()
    expect(await snapshot(sql)).toEqual(before)
    const timed = vi.spyOn(pg.Client.prototype, "query")
    timed.mockImplementation(function(this: pg.Client, ...args: Parameters<typeof original>) {
      if (typeof args[0] === "string" && args[0].startsWith("INSERT INTO editing_paragraph")) return (async () => {
        await Reflect.apply(original, this, ["SET LOCAL statement_timeout='1ms'"])
        return Reflect.apply(original, this, ["SELECT count(*) FROM generate_series(1,1000000000)"])
      })()
      return Reflect.apply(original, this, args)
    })
    await expect(cutoverParagraphHistory(sql, options)).rejects.toMatchObject({code: "57014"})
    timed.mockRestore()
    expect(await snapshot(sql)).toEqual(before)
    expect((await old.read(owner, "deck")).seq).toBe(9)
    expect(await cutoverParagraphHistory(sql, options)).toMatchObject({kind: "converted", decks: 1})
    expect(await cutoverParagraphHistory(sql, options)).toMatchObject({kind: "already-native"})
  })
}, 30_000)

it("lets a genuine old write finish before conversion and refuses an old arrival held across COMMIT", async () => {
  await database(async (sql, url, old) => {
    await old.create(owner, fixtureDeck(2))
    await prepareParagraphCutover(sql)
    const saving = barrier(), releaseSave = barrier(), locking = barrier(), committing = barrier(), releaseCommit = barrier(), arrival = barrier()
    const original = pg.Client.prototype.query
    let observeArrival = false
    const observed = vi.spyOn(pg.Client.prototype, "query")
    observed.mockImplementation(function(this: pg.Client, ...args: Parameters<typeof original>) {
      const statement = args[0], result = Reflect.apply(original, this, args)
      if (typeof statement !== "string") return result
      if (statement.startsWith("UPDATE editing_deck SET state=$2,updated_at")) return Promise.resolve(result).then(async value => {saving.release(); await releaseSave.promise; return value})
      if (statement === "LOCK TABLE editing_deck IN ACCESS EXCLUSIVE MODE") locking.release()
      if (statement.startsWith("UPDATE editing_protocol SET protocol=")) return Promise.resolve(result).then(async value => {committing.release(); await releaseCommit.promise; return value})
      if (observeArrival && statement.startsWith("SELECT state, deleted FROM editing_deck")) arrival.release()
      return result
    })
    const element = fixtureDeck(2).slides[0]?.elements[0]
    if (element?.kind !== "text") throw new Error("fixture-text")
    const oldSave = old.commit(owner, "deck", {id: commandId("inflight"), kind: "patch", base: 0, run: null, target: element.id, fields: {runs: [{...element.runs[0], text: "in-flight survives"}]}})
    await saving.promise
    const migration = cutoverParagraphHistory(sql, options)
    await locking.promise
    releaseSave.release()
    await expect(oldSave).resolves.toMatchObject({kind: "applied"})
    await committing.promise
    observeArrival = true
    const oldArrival = old.commit(owner, "deck", {id: commandId("late-refusal"), kind: "patch", base: 1, run: null, target: id("missing"), fields: {runs: element.runs}})
    const refused = expect(oldArrival).rejects.toThrow("editing-protocol-mismatch")
    await arrival.promise
    releaseCommit.release()
    try {
      await expect(migration).resolves.toMatchObject({kind: "converted"})
      await refused
      const native = createParagraphHistoryStore(url)
      try {expect(text(await native.read(owner, "deck")).body.paragraphs[0].runs).toMatchObject([{text: "in-flight survives"}])}
      finally {await native.close()}
      expect((await sql.query("SELECT id FROM editing_receipt WHERE id='late-refusal'")).rows).toEqual([])
    } finally {releaseSave.release(); releaseCommit.release(); observed.mockRestore()}
  })
}, 30_000)
