import {expect,it} from "vitest"
import {railwaySshArguments,railwayTarget} from "../../scripts/live/railway-ssh-arguments.ts"

it("names project and environment so a workspace token never needs railway link",()=>{
  const command=["node","apps/server/src/smoke/mint-link.ts","smoke@airdesign.app"]
  expect(railwaySshArguments(railwayTarget("project-id","production"),command)).toEqual(["ssh","--project","project-id","--environment","production","--service","web","--",...command])
  expect(railwaySshArguments(railwayTarget(undefined,undefined),command)).toEqual(["ssh","--service","web","--",...command])
})

it("rejects half a target, which would make railway fall back to a linked project",()=>{
  expect(()=>railwayTarget("project-id",undefined)).toThrow("railway-target-needs-project-and-environment")
  expect(()=>railwayTarget(undefined,"production")).toThrow("railway-target-needs-project-and-environment")
  expect(()=>railwayTarget("","production")).toThrow("railway-target-needs-project-and-environment")
})
