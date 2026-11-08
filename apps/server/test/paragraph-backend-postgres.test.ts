import {writeNativeSavedPptx} from "../../../packages/pptx/src/export-deck.ts"
import {importPptx} from "../../../packages/pptx/src/index.ts"
import {importedNativeDeck} from "../../../packages/pptx/src/import-deck.ts"
import sharp from "sharp"
import {validateImage} from "../../../packages/files/src/assets/validate.ts"
import {uploadProvenance} from "../../../packages/files/src/assets/provenance.ts"
import {randomBytes} from "node:crypto"
import {once} from "node:events"
import pg from "pg"
import {WebSocket} from "ws"
import {expect, it, vi} from "vitest"
import {createAccess, createMemoryInbox} from "../../../packages/access/src/index.ts"
import {fixtureDeck} from "../../../packages/deck/src/fixture.ts"
import {id} from "../../../packages/deck/src/index.ts"
import {commandId} from "../../../packages/change-log/src/index.ts"
import type {AgentRun} from "../../../packages/agent/src/activity.ts"
import type {ExportOptions} from "../src/decks/export-store.ts"
import {parseParagraphSnapshot} from "../../../packages/rpc/src/text/snapshot.ts"
import {createHistoryStore, type HistoryStore} from "./fixtures/paragraph-v2/history-store.ts"
import {createParagraphHistoryStore} from "../src/db/paragraph-history-store.ts"
import {cutoverParagraphHistory} from "../src/db/paragraph-cutover.ts"
import {pauseParagraphEditing, prepareParagraphCutover} from "../src/db/paragraph-protocol.ts"
import {startServer, type RunningServer} from "../src/main.ts"

const owner = {personId: "owner"}
const origin = "http://127.0.0.1:41732"
const cutover = {pause: {kind: "paused", drafts: "retained-or-visibly-refused", oldReaders: "retired"}, lockBudgetMs: 1000, conversionBudgetMs: 30_000} satisfies Parameters<typeof cutoverParagraphHistory>[1]
async function database(work: (sql: pg.Client, url: string, old: HistoryStore) => Promise<void>) {
  const host = process.env.AIRDESIGN_PG_HOST ?? "/home/quan/.local/pg/sock", user = process.env.AIRDESIGN_PG_USER ?? "quan"
  const admin = new pg.Client({host, user, database: "postgres"})
  await admin.connect()
  const name = `paragraph_backend_${randomBytes(8).toString("hex")}`
  await admin.query(`CREATE DATABASE ${name}`)
  const url = `postgresql://${user}@/${name}?host=${host}`
  const sql = new pg.Client({connectionString: url})
  let old: HistoryStore | undefined
  try {await sql.connect(); old = await createHistoryStore({kind: "postgres", url}); await work(sql, url, old)}
  finally {vi.restoreAllMocks(); vi.unstubAllEnvs(); await sql.query("ROLLBACK"); await old?.close(); await sql.end(); await admin.query(`DROP DATABASE ${name}`); await admin.end()}
}
async function immutable(sql: pg.Client) {
  return (await sql.query("SELECT deck,id,payload,receipt::text FROM editing_receipt ORDER BY deck,id")).rows
}

it("retains v2 export inputs, retires leases and cursors, and preserves agent requests and deleted decks atomically", async () => {
  await database(async (sql, url, old) => {
    const deck = fixtureDeck(2)
    const image = await validateImage(await sharp({create: {width: 8, height: 8, channels: 3, background: "blue"}}).png().toBuffer())
    await old.images.adopt(owner, image, uploadProvenance)
    deck.slides[0]?.elements.push({id: id("picture"), kind: "image", image: {asset: image.hash, crop: {x: 0, y: 0, width: 1, height: 1}, focal: {x: .5, y: .5}, mask: "rectangle", alt: "Retained"}, box: {x: 0, y: 0, width: 8, height: 8}, source: {kind: "created"}, support: {kind: "native"}, theme: null, placeholder: null, overlap: null})
    await old.create(owner, deck)
    const options: ExportOptions = {format: "pptx", slides: [], timing: "now", expectedSeq: 0, allowIssues: false}
    const running = await old.exports.submit(owner, "running", deck.id, options)
    const lease = await old.exports.claim()
    if (!lease) throw new Error("fixture-lease")
    const ready = await old.exports.submit(owner, "ready", deck.id, options)
    const readyLease = await old.exports.claim()
    if (!readyLease) throw new Error("fixture-ready-lease")
    await old.exports.complete(readyLease.id, readyLease.lease, Buffer.from("retained artifact"), {saved: true})
    await old.commit(owner, deck.id, {id: commandId("agent-start"), kind: "start-run", run: "agent"})
    const waiting = await old.exports.submit(owner, "waiting", deck.id, {...options, timing: "after-run", expectedSeq: 1})
    const agent: AgentRun = {id: "agent", owner: owner.personId, deck: deck.id, request: "Retain this exact request", selection: ["s0e0"], kind: "working", events: [{id: 9, kind: "message", text: "Prior activity"}], completed: ["first-task"]}
    await old.agents.save(agent)
    const page = await old.snapshots.page(owner.personId, "elements", {limit: 1}, async () => ({items: deck.slides[0]?.elements ?? [], meta: {seq: 0}}))
    const content = page.content[0]
    if (!content) throw new Error("fixture-page")
    const savedPage = JSON.parse(content.text).data
    const capture = await old.snapshots.binary(owner.personId, Buffer.from("retained capture"))
    const deleted = {...fixtureDeck(2), id: id("deleted")}
    await old.create(owner, deleted)
    await old.exports.submit(owner, "deleted-export", deleted.id, options)
    await old.delete(owner, deleted.id)
    await prepareParagraphCutover(sql)
    const saved = (await sql.query("SELECT id,snapshot::text,options::text,attempts,result,sha,expires,report::text FROM deck_export ORDER BY id")).rows
    const pages = (await sql.query("SELECT id,data::text,expires FROM tool_snapshot ORDER BY id")).rows
    const receipts = await immutable(sql)
    const original = pg.Client.prototype.query
    const fault = vi.spyOn(pg.Client.prototype, "query")
    fault.mockImplementation(function(this: pg.Client, ...args: Parameters<typeof original>) {
      if (typeof args[0] === "string" && args[0].startsWith("INSERT INTO editing_paragraph")) return Promise.reject(new Error("frozen-rollback"))
      return Reflect.apply(original, this, args)
    })
    await expect(cutoverParagraphHistory(sql, cutover)).rejects.toThrow("frozen-rollback")
    fault.mockRestore()
    expect((await sql.query("SELECT data FROM aira_run WHERE id='agent'")).rows[0]?.data).toEqual(agent)
    expect(await old.exports.active(running.id, lease.lease)).toBe(true)
    expect((await sql.query("SELECT retired FROM tool_snapshot WHERE id=$1", [savedPage.snapshot])).rows).toEqual([{retired: false}])
    expect(await cutoverParagraphHistory(sql, cutover)).toMatchObject({kind: "converted", decks: 2})
    const native = createParagraphHistoryStore(url)
    try {
      expect((await sql.query("SELECT id,snapshot::text,options::text,attempts,result,sha,expires,report::text FROM deck_export ORDER BY id")).rows).toEqual(saved)
      expect((await sql.query("SELECT id,data::text,expires FROM tool_snapshot ORDER BY id")).rows).toEqual(pages)
      expect(await immutable(sql)).toEqual(receipts)
      expect(await native.exports.active(running.id, lease.lease)).toBe(false)
      expect(await native.exports.complete(running.id, lease.lease, Buffer.from("stale"), {})).toBe(false)
      expect(await native.exports.status(owner, waiting.id)).toMatchObject({kind: "failed", reason: "editing-protocol-requires-new-snapshot"})
      await expect(native.exports.retry(owner, waiting.id)).rejects.toThrow("editing-protocol-requires-new-snapshot")
      expect(await native.exports.artifact(owner, ready.id)).toMatchObject({bytes: Buffer.from("retained artifact"), seq: 0})
      await expect(native.exports.artifact({personId: "stranger"}, ready.id)).rejects.toThrow("export-not-found")
      const next = await native.exports.claim()
      expect(next).toMatchObject({snapshotVersion: 2})
      if (!next) throw new Error("fixture-archive-claim")
      expect(next.snapshot.deck).toEqual(next.id === running.id ? deck : deleted)
      await native.exports.fail(next.id, next.lease, "retryable-artifact-failure")
      expect(await native.exports.retry(owner, next.id)).toMatchObject({kind: "queued"})
      await expect(native.exports.submit(owner, "new-native", deck.id, options)).rejects.toThrow("saved-version-changed")
      await expect(native.snapshots.resource(owner.personId, savedPage.snapshot)).rejects.toThrow("requires-new-snapshot")
      await expect(native.snapshots.page(owner.personId, "elements", {limit: 1, cursor: savedPage.nextCursor}, async () => {throw new Error("must-not-reload") })).rejects.toThrow("requires-new-snapshot")
      expect(await native.snapshots.resource(owner.personId, capture.resource.split("/").at(-1) ?? "")).toEqual({base64: Buffer.from("retained capture").toString("base64")})
      expect(await native.agents.latest(owner.personId, deck.id)).toMatchObject({...agent, kind: "stopped", events: [...agent.events, {id: 10, kind: "message", text: expect.stringContaining("request is retained")}]})
      await expect(native.read(owner, deleted.id)).rejects.toThrow("deck-deleted")
      expect(await cutoverParagraphHistory(sql, cutover)).toMatchObject({kind: "already-native"})
      expect((await native.images.media(owner, image.hash, "original")).bytes).toEqual(Buffer.from(image.original, "base64"))
      await expect(native.images.media({personId: "stranger"}, image.hash, "original")).rejects.toThrow("asset-not-found")
      const current = await native.read(owner, deck.id)
      await expect(native.create({personId: "stranger"}, {...current.deck, id: id("foreign")})).rejects.toThrow("asset-not-found")
      expect((await sql.query("SELECT id FROM editing_deck WHERE id='foreign'")).rows).toEqual([])
      await native.deletions.enqueue(owner.personId)
      expect(await native.deletions.purge(owner.personId)).toBe(true)
      for (const table of ["editing_deck", "editing_paragraph", "aira_run", "deck_export", "tool_snapshot", "tool_cursor", "image_asset", "image_owner"]) expect((await sql.query(`SELECT count(*)::int AS count FROM ${table}`)).rows).toEqual([{count: 0}])
    } finally {await native.close()}
  })
}, 30_000)

it("serves authenticated legacy/native HTTP and native websocket reconnects with typed pause and exact old retries", async () => {
  await database(async (sql, url) => {
    const inbox = createMemoryInbox()
    const access = await createAccess({driver: {kind: "postgres", url}, secret: "dev-only-secret-change-me-32chars", mail: inbox, clock: Date.now, guard: {allow: () => true}, exposeInbox: false, publicOrigin: origin})
    async function signIn(email: string) {
      let cookie = ""
      async function post(path: string, body: unknown) {
        const response = await access.handle(new Request(origin + path, {method: "POST", headers: {origin, cookie, "content-type": "application/json"}, body: JSON.stringify(body)}))
        for (const value of response.headers.getSetCookie()) cookie += (cookie ? "; " : "") + value.split(";")[0]
        return response.json()
      }
      const intent = await post("/api/access/intent", {kind: "home"})
      await post("/api/access/email", {email, intent: intent.token})
      await post("/api/access/code", {email, intent: intent.token, code: inbox.read(email).at(-1)?.code})
      return cookie
    }
    let server: RunningServer | undefined
    const sockets: WebSocket[] = []
    try {
      const cookie = await signIn("paragraph-owner@example.com"), stranger = await signIn("paragraph-stranger@example.com")
      vi.stubEnv("AIRDESIGN_DATABASE_URL", url)
      server = await startServer(0, {operationsPath: ":memory:", templatesPath: ":memory:", publicOrigin: origin})
      async function call(path: string, method = "GET", body?: unknown, native = false, session = cookie) {
        return fetch(`http://127.0.0.1:${server?.port}${path}`, {method, headers: {origin, cookie: session, "content-type": "application/json", ...(native ? {"x-text-protocol": "paragraph-body-v3"} : {})}, body: body === undefined ? undefined : JSON.stringify(body)})
      }
      expect((await sql.query("SELECT to_regclass('editing_protocol') AS relation")).rows).toEqual([{relation: null}])
      expect((await call("/api/decks", "POST", fixtureDeck(2))).status).toBe(201)
      const old = {id: "legacy-request", kind: "patch", base: 0, run: null, target: "s0", fields: {notes: "retained"}}
      const first = await call("/api/decks/deck/commands", "POST", old)
      expect(first.status).toBe(200)
      const retained = (await sql.query("SELECT receipt::text AS bytes FROM editing_receipt WHERE id='legacy-request'")).rows[0]?.bytes
      expect((await call("/api/decks/deck", "GET", undefined, true)).status).toBe(409)
      await prepareParagraphCutover(sql)
      await pauseParagraphEditing(sql, true)
      const paused = await call("/api/decks/deck/commands", "POST", "not a command")
      expect(await paused.json()).toEqual({kind: "refused", code: "editing-paused", retryable: true, next: "retain-and-retry"})
      await expect(sql.query("UPDATE editing_receipt SET payload=payload WHERE false")).rejects.toThrow("editing-paused")
      await cutoverParagraphHistory(sql, cutover)
      expect((await call("/api/decks/deck", "GET", undefined, true)).status).toBe(409)
      await pauseParagraphEditing(sql, false)
      expect(await (await call("/api/decks/deck")).json()).toMatchObject({kind: "refused", code: "editing-protocol-mismatch"})
      expect(await (await call("/api/decks/deck/commands", "POST", old)).text()).toBe(retained)
      expect(await (await call("/api/decks/deck/commands", "POST", {...old, fields: {notes: "changed"}})).json()).toEqual({code: "request-id-payload-mismatch"})
      expect(await (await call("/api/decks/deck/commands", "POST", {...old, id: "new-old"})).json()).toMatchObject({code: "editing-protocol-mismatch"})
      expect(await (await call("/api/decks/deck/commands", "POST", "malformed old command")).json()).toMatchObject({kind: "refused", code: "editing-protocol-mismatch"})
      const initial = parseParagraphSnapshot(await (await call("/api/decks/deck", "GET", undefined, true)).json())
      expect(initial.seq).toBe(1)
      const exportOptions = {format: "pptx", timing: "now", slides: [], expectedSeq: 1, allowIssues: true, requestId: "native-http-export"}
      const exported = await call("/api/catalog/deck/exports", "POST", exportOptions, true)
      expect(exported.status).toBe(202)
      const exportJob = await exported.json()
      expect(await (await call("/api/catalog/deck/exports", "POST", exportOptions, true)).json()).toEqual(exportJob)
      expect(await (await call("/api/catalog/deck/exports", "POST", exportOptions)).json()).toMatchObject({kind: "refused", code: "editing-protocol-mismatch"})
      expect(await (await call("/api/catalog/deck/exports", "POST", exportOptions, true, stranger)).json()).toMatchObject({code: "deck-not-found"})
      expect(await (await call(`/api/catalog/export-jobs/${exportJob.id}/cancel`, "POST", {}, true)).json()).toMatchObject({kind: "cancelled"})
      expect((await call("/api/decks", "POST", {version: 3, deck: {...initial.deck, id: "newNative"}}, true)).status).toBe(201)
      const createdRead = await call("/api/decks/newNative", "GET", undefined, true)
      const createdSnapshot = await createdRead.json()
      expect(createdSnapshot).toMatchObject({version: 3, seq: 0})
      expect(parseParagraphSnapshot(createdSnapshot).seq).toBe(0)
      expect((await call("/api/decks/newNative", "DELETE", undefined, true)).status).toBe(200)
      expect((await call("/api/decks/deck", "GET", undefined, true, stranger)).status).toBe(404)
      const native = {version: 3, command: {id: "native-request", kind: "patch", base: 1, run: null, target: "s0", fields: {notes: "native retained"}}}
      expect((await call("/api/decks/deck/commands", "POST", native, true)).status).toBe(200)
      const stale = await call("/api/decks/deck/commands", "POST", {...native, command: {...native.command, id: "stale", fields: {notes: "stale"}}}, true)
      expect(await stale.json()).toMatchObject({kind: "refused", code: "stale-base"})
      const replay = await (await call("/api/decks/deck/events", "GET", undefined, true)).json()
      expect(replay.events.map((event: {version: number}) => event.version)).toEqual([2, 3])
      expect(await (await call("/api/catalog/import", "POST", "retained draft", true)).json()).toMatchObject({code: "missing-operation"})
      async function connect(protocol: string) {
        const socket = new WebSocket(`ws://127.0.0.1:${server?.port}/ws?deck=deck&textProtocol=${protocol}`, {origin, headers: {cookie}})
        sockets.push(socket)
        const message = once(socket, "message")
        await once(socket, "open")
        return {socket, message: JSON.parse(String((await message)[0]))}
      }
      expect((await connect("legacy-text-v2")).message).toMatchObject({kind: "refused", code: "editing-protocol-mismatch"})
      const connection = await connect("paragraph-body-v3")
      expect(parseParagraphSnapshot(connection.message).seq).toBe(2)
      const received = once(connection.socket, "message")
      connection.socket.send(JSON.stringify({version: 3, command: {...native.command, id: "websocket", base: 2, fields: {notes: "websocket retained"}}}))
      expect(JSON.parse(String((await received)[0]))).toMatchObject({kind: "receipt", version: 3})
      await server.close(); server = undefined
      server = await startServer(0, {operationsPath: ":memory:", templatesPath: ":memory:", publicOrigin: origin})
      expect(parseParagraphSnapshot((await connect("paragraph-body-v3")).message).seq).toBe(3)
      const reopened = parseParagraphSnapshot(await (await call("/api/decks/deck", "GET", undefined, true)).json())
      expect(reopened.deck.slides[0]?.notes).toBe("websocket retained")
      const text = reopened.deck.slides[0]?.elements[0]
      if (text?.kind !== "text" || !text.body.paragraphs[0]) throw new Error("fixture-native-text")
      const paragraph = text.body.paragraphs[0]
      const start = await call("/api/decks/deck/commands", "POST", {version: 3, command: {id: "native-start", kind: "start-run", run: "native-agent"}}, true)
      const credential = start.headers.get("x-run-credential")
      expect(credential).toBeTruthy()
      const runEdit = {version: 3, command: {id: "native-agent-edit", kind: "patch", base: 4, run: "native-agent", target: paragraph.id, fields: {alignment: "center"}}}
      const agentEdit = await fetch(`http://127.0.0.1:${server.port}/api/decks/deck/commands`, {method: "POST", headers: {cookie, origin, "content-type": "application/json", "x-text-protocol": "paragraph-body-v3", "x-run-credential": credential ?? ""}, body: JSON.stringify(runEdit)})
      expect(await agentEdit.json()).toMatchObject({kind: "applied", seq: 5})
      expect(await (await call("/api/decks/deck/commands", "POST", {version: 3, command: {id: "native-person", kind: "patch", base: 5, run: null, target: paragraph.id, fields: {alignment: "right"}}}, true)).json()).toMatchObject({kind: "applied", seq: 6})
      expect(await (await call("/api/decks/deck/commands", "POST", {version: 3, command: {id: "native-undo", kind: "undo-run", run: "native-agent"}}, true)).json()).toMatchObject({kind: "applied", seq: 7})
      const protectedState = parseParagraphSnapshot(await (await call("/api/decks/deck", "GET", undefined, true)).json())
      const protectedText = protectedState.deck.slides[0]?.elements[0]
      expect(protectedText?.kind === "text" && protectedText.body.paragraphs[0]?.alignment).toBe("right")
      expect((await call("/api/account/deletion", "POST", {confirm: "delete-account"}, true)).status).toBe(200)
      expect((await sql.query("SELECT id FROM editing_deck")).rows).toEqual([])
    } finally {for (const socket of sockets) socket.terminate(); await server?.close(); await access.close()}
  })
}, 30_000)

it("persists new native export snapshots while retaining exact old job inputs and retry identities", async () => {
  await database(async (sql, url, old) => {
    const legacy = fixtureDeck(2), element = legacy.slides[0]!.elements[0]!
    legacy.slides[0]!.elements[0] = {id: id("group"), kind: "group", box: {x: 10, y: 10, width: 900, height: 400}, source: {kind: "created"}, support: {kind: "native"}, theme: null, placeholder: null, overlap: null, children: [element]}
    await old.create(owner, legacy)
    const options: ExportOptions = {format: "pptx", slides: [], timing: "now", expectedSeq: 0, allowIssues: true}
    const retained = await old.exports.submit(owner, "frozen-before", "deck", options)
    const before = (await sql.query("SELECT snapshot::text FROM deck_export WHERE id=$1", [retained.id])).rows
    await prepareParagraphCutover(sql)
    await sql.query("ALTER TABLE deck_export DROP CONSTRAINT deck_export_snapshot_version_check")
    await sql.query("ALTER TABLE deck_export ADD CONSTRAINT deck_export_snapshot_version_check CHECK(snapshot_version=2)")
    await prepareParagraphCutover(sql)
    await cutoverParagraphHistory(sql, cutover)
    let native = createParagraphHistoryStore(url)
    try {
      expect(await native.exports.submit(owner, "frozen-before", "deck", options)).toEqual(retained)
      await expect(native.exports.submit(owner, "frozen-before", "deck", {...options, slides: ["s0"]})).rejects.toThrow("request-id-payload-conflict")
      expect((await sql.query("SELECT snapshot::text FROM deck_export WHERE id=$1", [retained.id])).rows).toEqual(before)
      const oldLease = await native.exports.claim()
      expect(oldLease?.snapshotVersion).toBe(2)
      if (!oldLease) throw new Error("retained-export-required")
      await native.exports.complete(oldLease.id, oldLease.lease, Buffer.from("old bytes"), {})
      const state = await native.read(owner, "deck"), group = state.deck.slides[0]!.elements[0]!
      if (group.kind !== "group") throw new Error("native-group-required")
      const text = group.children[0]!
      if (text.kind !== "text") throw new Error("native-text-required")
      expect(await native.commit(owner, "deck", {version: 3, command: {id: "frame", kind: "patch", base: 0, run: null, target: text.body.frame.id, fields: {anchor: "bottom", insets: {top: 4, right: 8, bottom: 12, left: 16}}}})).toMatchObject({version: 3, receiptBytes: expect.stringContaining('"applied"')})
      expect(await native.commit(owner, "deck", {version: 3, command: {id: "paragraph-edit", kind: "patch", base: 1, run: null, target: text.body.paragraphs[0].id, fields: {alignment: "right"}}})).toMatchObject({receiptBytes: expect.stringContaining('"applied"')})
      expect(await native.commit(owner, "deck", {version: 3, command: {id: "paragraph-undo", kind: "undo", target: "paragraph-edit"}})).toMatchObject({receiptBytes: expect.stringContaining('"applied"')})
      const job = await native.exports.submit(owner, "native-export", "deck", {...options, expectedSeq: 3})
      await expect(native.exports.submit({personId: "other"}, "denied", "deck", {...options, expectedSeq: 3})).rejects.toThrow("deck-not-found")
      await native.close()
      native = createParagraphHistoryStore(url)
      const lease = await native.exports.claim()
      if (lease?.snapshotVersion !== 3) throw new Error("native-export-required")
      expect(lease.id).toBe(job.id)
      expect((await native.snapshot(owner, "deck")).deck).toEqual(lease.snapshot.deck)
      expect(lease.snapshot.deck.slides[0]!.elements[0]).toMatchObject({kind: "group", children: [{body: {paragraphs: [{alignment: "left"}]}}]})
      const reopened = importedNativeDeck(await importPptx(await writeNativeSavedPptx(lease.snapshot.deck, lease.snapshot.seq, null, {}, lease.snapshot.assets, lease.snapshot.templates)))
      expect(reopened.slides[0]!.elements[0]).toMatchObject({body: {frame: {anchor: "bottom", insets: {top: 4, right: 8, bottom: 12, left: 16}}}})
      await native.exports.fail(lease.id, lease.lease, "retryable")
      expect(await native.exports.retry(owner, lease.id)).toMatchObject({id: lease.id, kind: "queued"})
      const retry = await native.exports.claim()
      expect(retry?.snapshot).toEqual(lease.snapshot)
    } finally {await native.close()}
  })
}, 30_000)

it("measures actual native PostgreSQL commit and reopen with 300 text nodes and 20 retained edits", async () => {
  await database(async (sql, url, old) => {
    const deck = fixtureDeck(300), first = deck.slides[0]!.elements[0]!
    if (first.kind !== "text") throw new Error("text-required")
    deck.slides[0]!.elements = deck.slides[0]!.elements.map(element => ({...first, id: element.id, box: element.box, runs: [{...first.runs[0], text: `Retained content ${element.id} with a realistic sentence and a second line\nContinuation.`}]}))
    await old.create(owner, deck)
    for (let index = 0; index < 20; index++) await old.commit(owner, "deck", {id: commandId(`prior${index}`), kind: "patch", base: index, run: null, target: id(`s0e${index}`), fields: {runs: [{...first.runs[0], text: `Historical content ${index}\nRetained line`}]}})
    const immutableBefore = await immutable(sql)
    await prepareParagraphCutover(sql)
    const migration = await cutoverParagraphHistory(sql, cutover)
    let native = createParagraphHistoryStore(url)
    try {
      const readStarted = performance.now(), state = await native.read(owner, "deck"), readMs = performance.now() - readStarted
      const samples: number[] = []
      const text = state.deck.slides[0]!.elements[0]!
      if (text.kind !== "text") throw new Error("text-required")
      for (let index = 0; index < 5; index++) {
        const started = performance.now()
        const result = await native.commit(owner, "deck", {version: 3, command: {id: `measured${index}`, kind: "patch", base: 20 + index, run: null, target: text.body.paragraphs[0].id, fields: {alignment: index % 2 ? "right" : "center"}}})
        samples.push(performance.now() - started)
        expect(JSON.parse(result.receiptBytes)).toMatchObject({kind: "applied", seq: 21 + index})
      }
      await native.close()
      native = createParagraphHistoryStore(url)
      const reopenedStarted = performance.now(), reopened = await native.read(owner, "deck"), reopenMs = performance.now() - reopenedStarted
      expect(reopened.seq).toBe(25)
      expect((await immutable(sql)).filter(row => !row.id.startsWith("measured"))).toEqual(immutableBefore)
      process.stdout.write(JSON.stringify({path: "createParagraphHistoryStore.commit/person-paragraph-patch", fixture: "300 text elements, 20 retained legacy edits, 5 later person edits", nativeHistoryBytes: Buffer.byteLength(JSON.stringify(reopened)), readMs, commitMs: samples, reopenMs, migration, includes: "SQL transaction, complete-history validation, executor, index rebuild and persistence", excludes: "HTTP/browser, reader retirement and visible pause"}) + "\n")
    } finally {await native.close()}
  })
}, 120_000)
