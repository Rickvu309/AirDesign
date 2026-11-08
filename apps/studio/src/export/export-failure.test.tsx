import {expect,it} from "vitest"
import {exportFailureMessage} from "./export-failure-message.ts"

it("uses the canonical required discriminants without exposing private diagnostics",()=>{
  expect(exportFailureMessage({kind:"limit",limit:"wall-clock",signal:"SIGKILL"})).toContain("time limit")
  expect(exportFailureMessage({kind:"limit",limit:"memory",signal:null})).toContain("memory")
  expect(exportFailureMessage({kind:"limit",limit:"cpu",signal:null})).toContain("processing limit")
  expect(exportFailureMessage({kind:"limit",limit:"file-size",signal:null})).toContain("file size")
  expect(exportFailureMessage({kind:"signal",signal:"SIGKILL"})).toContain("SIGKILL")
  for(const failure of [{kind:"exit",code:1,diagnostic:"private-worker-diagnostic"},{kind:"application",code:"private-worker-diagnostic"},{kind:"isolation",reason:"subreaper-lost"}] satisfies Parameters<typeof exportFailureMessage>[0][])expect(exportFailureMessage(failure)).not.toContain("private-worker-diagnostic")
})
