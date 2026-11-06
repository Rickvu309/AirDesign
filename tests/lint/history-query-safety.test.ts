import { it, expect } from "vitest"
import { historyQuerySafetyHits } from "../../scripts/lint/history-query-safety.ts"
it("rejects the original multi-statement prepared query and accepts separate queries", () => {
  expect(historyQuerySafetyHits("apps/server/src/db/history.ts", 'await tx.query(`CREATE TABLE a(id text); CREATE TABLE b(id text);`)')).toHaveLength(1)
  expect(historyQuerySafetyHits("apps/server/src/db/history.ts", 'await tx.query("CREATE TABLE a(id text)"); await tx.query("CREATE TABLE b(id text)")')).toHaveLength(0)
})

it("rejects payload-derived actors and accepts the trusted execution identity",()=>{
 expect(historyQuerySafetyHits("packages/change-log/src/index.ts",'const event={actor:command.run===null ? "person" : "agent"}')).toMatchObject([{reason:"actor-must-come-from-execution-identity"}])
 expect(historyQuerySafetyHits("packages/change-log/src/index.ts",'const event={actor:identity.kind==="person" ? "person" : "agent"}')).toEqual([])
})

it("stores contribution references in the property index instead of repeating history",()=>{
  expect(historyQuerySafetyHits("apps/server/src/db/history-index.ts","const value={payload:{...event,patches:[patch]}}" )).toMatchObject([{reason:"history-property-index-must-reference-contributions"}])
  expect(historyQuerySafetyHits("apps/server/src/db/history-index.ts","const value={payload:{id:event.id,actor:event.actor}}" )).toEqual([])
})
it("rejects copying the complete history on every execution",()=>{
  expect(historyQuerySafetyHits("packages/change-log/src/index.ts","const history=structuredClone(current)")).toMatchObject([{reason:"history-execution-must-copy-only-mutable-state"}])
  expect(historyQuerySafetyHits("packages/change-log/src/index.ts","const node=structuredClone(patch.after)")).toHaveLength(1)
  expect(historyQuerySafetyHits("packages/change-log/src/index.ts","const history={...current,events:current.events.map(event=>({...event}))}")).toEqual([])
})

it("keeps event metadata outside the per-property JSON records",()=>{
  expect(historyQuerySafetyHits("apps/server/src/db/history-index.ts",'await tx.query("INSERT INTO editing_property SELECT p.node,p.key,p.seq,p.payload FROM jsonb_to_recordset($1::jsonb) AS p(node text,key text,seq integer,payload jsonb)")')).toMatchObject([{reason:"history-property-rows-must-share-event-metadata"}])
  expect(historyQuerySafetyHits("apps/server/src/db/history-index.ts",'await tx.query("INSERT INTO editing_property SELECT p.node,p.key,$2,$3 FROM jsonb_to_recordset($1::jsonb) AS p(node text,key text)")')).toEqual([])
})
