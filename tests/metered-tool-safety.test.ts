import {expect,it} from "vitest"
import {meteredToolSafetyHits} from "../scripts/lint/metered-tool-safety.ts"
it("rejects mutable usage history and remote billing or payload authority",()=>{
  expect(meteredToolSafetyHits("packages/tools/src/snapshots.ts",'tx.query("CREATE TABLE tool_cursor(id text,offset integer)")')[0]?.reason).toBe("sql-column-offset-is-reserved-use-position")
  expect(meteredToolSafetyHits("packages/usage/src/ledger.ts",'tx.query("UPDATE usage_event SET data=$1")')[0]?.reason).toBe("usage-events-are-append-only")
  expect(meteredToolSafetyHits("packages/usage/src/ledger.ts",'tx.query("INSERT INTO usage_event VALUES ($1)")')).toEqual([])
  for(const source of ['ledger.grantFixture(owner,"x",500,"paid")','history.usage.reset(owner,hit)','const identity = {run:args.run}'])expect(meteredToolSafetyHits("apps/server/src/mcp/handle.ts",source)).toHaveLength(1)
  expect(meteredToolSafetyHits("apps/server/src/mcp/handle.ts",'const identity={run:principal.connection}')).toEqual([])
  expect(meteredToolSafetyHits("apps/studio/src/agents/agents-panel.tsx",'<a className="ad-button ad-button-primary">Start again</a>')[0]?.reason).toBe("button-class-requires-an-explicit-size")
  expect(meteredToolSafetyHits("apps/studio/src/agents/agents-panel.tsx",'<a className="ad-button ad-button-primary ad-button-dialog">Start again</a>')).toEqual([])
  expect(meteredToolSafetyHits("apps/studio/vite.config.ts",'"/mcp": process.env.AIRDESIGN_API_ORIGIN')[0]?.reason).toBe("mcp-proxy-must-preserve-public-host-with-changeOrigin-false")
  expect(meteredToolSafetyHits("apps/studio/vite.config.ts",'"/mcp": {target:backend,changeOrigin:false}')).toEqual([])
})
