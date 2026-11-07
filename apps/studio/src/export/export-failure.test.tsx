import {expect,it} from "vitest"
import {exportFailureMessage} from "./export-dialog.tsx"

it("uses safe recovery copy for typed resource limits and worker interruptions",()=>{
  const job={id:"export",deck:"deck",format:"pptx",attempts:1,options:{format:"pptx",slides:[],timing:"now",expectedSeq:0,allowIssues:false},diagnostics:[],kind:"failed",reason:"private-worker-diagnostic"} satisfies Parameters<typeof exportFailureMessage>[0]
  expect(exportFailureMessage({...job,failure:{kind:"limit"}})).toBe("The export reached a resource limit. Try exporting fewer slides.")
  expect(exportFailureMessage({...job,failure:{kind:"signal"}})).toBe("The export was interrupted. Try again.")
  expect(exportFailureMessage(job)).not.toContain("private-worker-diagnostic")
})
