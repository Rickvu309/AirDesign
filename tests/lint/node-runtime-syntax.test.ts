import { expect, it } from "vitest"
import { nodeRuntimeSyntaxHits } from "../../scripts/lint/node-runtime-syntax.ts"
it("rejects the original Node-incompatible parameter property and accepts explicit assignment", () => {
  expect(nodeRuntimeSyntaxHits("apply.ts", 'class Rejected { constructor(readonly code: string) {} }')).toMatchObject([{ reason: "node-strip-only-parameter-property" }])
  expect(nodeRuntimeSyntaxHits("apply.ts", 'class Rejected { readonly code: string; constructor(code: string) { this.code = code } }')).toEqual([])
})
