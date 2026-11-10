import { expectAccepts, expectRejects } from "../harness.js"

const rule = { "airdesign/no-xml-search": "error" }
const message = "Use the markup tokenizer instead of searching XML."
const source = "packages/pptx/src/slide-route.ts"

expectRejects("indexOf of a tag fails", source, `export const at = xml.indexOf("<p:sp")\n`, rule, message)
expectRejects("lastIndexOf of a tag fails", source, `export const at = bytes.lastIndexOf("<a:t")\n`, rule, message)
expectRejects("search of xml fails", source, `export const at = xml.search("a")\n`, rule, message)
expectRejects("matchAll of a tag fails", source, `export const at = part.matchAll(/<p:sp/g)\n`, rule, message)
expectRejects("a tag regex fails", source, `export const pattern = /<p:sp/\n`, rule, message)
expectRejects("RegExp of a tag fails", source, `export const pattern = new RegExp("<p:sp")\n`, rule, message)
expectAccepts(
  "the tokenizer may scan",
  "packages/pptx/src/element-span.ts",
  `export const at = xml.indexOf("<p:sp")\n`,
  rule,
)
expectAccepts(
  "a test may scan",
  "packages/pptx/src/slide-route.test.ts",
  `export const at = xml.indexOf("<p:sp")\n`,
  rule,
)
expectAccepts("child order stays", source, `export const at = order.indexOf(tag)\n`, rule)
expectAccepts("a relationship path stays", source, `export const at = relsName.lastIndexOf("/_rels/")\n`, rule)
expectAccepts("a part name stays", source, "export const part = /^ppt\\/slides\\/slide\\d+\\.xml$/\n", rule)
expectAccepts(
  "another package stays",
  "packages/document/src/order.ts",
  `export const at = xml.indexOf("<p:sp")\n`,
  rule,
)
