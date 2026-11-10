import { nameFindings } from "./scan-names.js"

const expectHits = (relative, count) => {
  const hits = nameFindings(relative)
  if (hits.length !== count) throw new Error(`${relative} gave ${hits.length} hits\n${hits.join("\n")}`)
  return hits
}

const past = expectHits("apps/web/src/lib/utils.ts", 1)
if (past[0] !== "apps/web/src/lib/utils.ts: Rename utils.ts after what it contains.") throw new Error(past[0])
expectHits("packages/document/src/helpers/order.ts", 1)
expectHits("apps/web/src/common.test.tsx", 1)
expectHits("apps/web/src/lib/Utils.ts", 1)
expectHits("apps/web/src/lib/class-names.ts", 0)
expectHits("apps/web/src/editor/commonplace.ts", 0)
expectHits("packages/pptx/src/shape-utils.ts", 0)

console.log("scan-names tests passed")
