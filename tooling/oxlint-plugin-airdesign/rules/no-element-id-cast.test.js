import { expectAccepts, expectRejects } from "../harness.js"

const rule = { "airdesign/no-element-id-cast": "error" }
const message = "Call elementId or readElementId from @airdesign/document instead of casting to ElementId."
const source = "packages/catalog/src/wire.ts"

expectRejects("a plain cast fails", source, `export const bad = raw as ElementId\n`, rule, message)
expectRejects("a double cast fails", source, `export const bad = raw as unknown as ElementId\n`, rule, message)
expectRejects("an angle cast fails", source, `export const bad = <ElementId>raw\n`, rule, message)
expectRejects("an array cast fails", source, `export const bad = keys as ElementId[]\n`, rule, message)
expectRejects("a readonly array cast fails", source, `export const bad = keys as readonly ElementId[]\n`, rule, message)
expectRejects("a generic array cast fails", source, `export const bad = keys as Array<ElementId>\n`, rule, message)
expectRejects(
  "a readonly generic cast fails",
  source,
  `export const bad = keys as ReadonlyArray<ElementId>\n`,
  rule,
  message,
)
expectRejects("a union cast fails", source, `export const bad = raw as ElementId | undefined\n`, rule, message)
expectRejects("a qualified cast fails", source, `export const bad = raw as document.ElementId\n`, rule, message)
expectRejects(
  "a cast in tsx fails",
  "apps/web/src/thin-deck.tsx",
  `export const bad = raw as ElementId\n`,
  rule,
  message,
)
expectRejects(
  "a cast in a test fails",
  "packages/pptx/src/element-export.test.ts",
  `export const bad = raw as ElementId\n`,
  rule,
  message,
)
expectRejects(
  "a cast in another src fails",
  "packages/documents/src/id.ts",
  `export const bad = raw as ElementId\n`,
  rule,
  message,
)
expectAccepts("document may mint", "packages/document/src/element-id.ts", `export const ok = raw as ElementId\n`, rule)
expectAccepts(
  "a document test may cast",
  "packages/document/src/element-id.test.ts",
  `export const ok = raw as ElementId\n`,
  rule,
)
expectAccepts("a type argument stays", source, `export const ok = new Set<ElementId>()\n`, rule)
expectAccepts("an annotation stays", source, `export const ok = (id: ElementId): ElementId => id\n`, rule)
expectAccepts("another cast stays", source, `export const ok = raw as string\n`, rule)
expectAccepts("another array stays", source, `export const ok = keys as Array<string>\n`, rule)
expectAccepts("a similar name stays", source, `export const ok = raw as ElementIdList\n`, rule)
expectAccepts("satisfies stays", source, `export const ok = id satisfies ElementId\n`, rule)
