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
