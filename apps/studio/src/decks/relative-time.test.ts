import {expect,it} from "vitest"
import {relativeTime} from "./relative-time.ts"

it("formats the designed edit times without exposing negative or fractional units",()=>{
  const now=Date.UTC(2026,10,6,3)
  for(const [elapsed,expected] of [[-1,"just now"],[0,"just now"],[60000,"1 minute ago"],[120000,"2 minutes ago"],[3600000,"1 hour ago"],[7200000,"2 hours ago"],[86400000,"yesterday"],[2*86400000,"2 days ago"],[7*86400000,"last week"],[21*86400000,"3 weeks ago"],[30*86400000,"last month"]] as const)expect(relativeTime(now-elapsed,now)).toBe(expected)
})
