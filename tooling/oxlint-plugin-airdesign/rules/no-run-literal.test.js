import { expectAccepts, expectRejects } from "../harness.js"

const rule = { "airdesign/no-run-literal": "error" }
const message = "Compare a run id to the id stored on the node."
const source = "packages/document/src/decide.ts"

expectRejects("a run id literal fails", source, `export const bad = runId !== "s"\n`, rule, message)
expectRejects("a member run id literal fails", source, `export const bad = body.runId !== "s"\n`, rule, message)
expectRejects("a flipped run id literal fails", source, `export const bad = "s" === register.runId\n`, rule, message)
expectRejects("a loose run id literal fails", source, `export const bad = node.runId == "t"\n`, rule, message)
expectAccepts("a stored run id stays", source, `export const ok = register.runId !== runId\n`, rule)
expectAccepts("a phase literal stays", source, `export const ok = body.phase !== "stopped"\n`, rule)
expectAccepts("a node name stays", source, `export const ok = node === "a"\n`, rule)
expectAccepts(
  "a test may name a fixture",
  "packages/document/src/decide.rules.test.ts",
  `export const bad = runId !== "s"\n`,
  rule,
)
expectAccepts("another package stays", "packages/render/src/store.ts", `export const bad = runId !== "s"\n`, rule)
