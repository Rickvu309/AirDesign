import { expectAccepts, expectRejects } from "../harness.js"

const rule = { "airdesign/no-testing-import": "error" }
const message = 'A "testing" folder or a test file holds what tests import'

expectRejects(
  "a doom source file importing its own fixtures fails",
  "packages/doom/src/apply-edit.ts",
  `import { plainTheme } from "./testing/doom-fixtures-art.js"\n`,
  rule,
  message,
)
expectRejects(
  "an api source file importing the mcp expectations fails",
  "apps/api/src/server.ts",
  `import { toolLimit } from "./mcp/testing/mcp-expected.js"\n`,
  rule,
  message,
)
expectRejects(
  "the workspace test-only export fails from product code",
  "apps/api/src/mcp/tools.ts",
  `import { memoryDecks } from "@airdesign/mcp/testing/evals"\n`,
  rule,
  message,
)
expectRejects(
  "a nested source file importing testing through .. fails",
  "packages/pptx/src/xml/route.ts",
  `import { sectionIds } from "../testing/section-ids.js"\n`,
  rule,
  message,
)
expectRejects(
  "an aliased web testing import fails",
  "apps/web/src/decks/page.tsx",
  `import { spot } from "@/testing/doom-fixtures"\n`,
  rule,
  message,
)
expectRejects(
  "a dynamic import of test support fails",
  "apps/web/src/editor/panel.tsx",
  `const fixtures = await import("@/testing/doom-fixtures")\n`,
  rule,
  message,
)
expectRejects(
  "a require of test support fails",
  "apps/api/src/mcp/mcp.ts",
  `const expected = require("./testing/mcp-expected.js")\n`,
  rule,
  message,
)
expectRejects(
  "a bare testing barrel import fails",
  "apps/web/src/App.tsx",
  `import { spot } from "./testing"\n`,
  rule,
  message,
)
expectRejects(
  "a bare testing folder through .. fails",
  "apps/web/src/editor/design-palette.ts",
  `import { spot } from "../testing"\n`,
  rule,
  message,
)
expectRejects(
  "an aliased bare testing folder fails",
  "apps/web/src/editor/design-palette.ts",
  `import { spot } from "@/testing"\n`,
  rule,
  message,
)
expectRejects(
  "a product file importing a test file fails",
  "packages/doom/src/apply-edit.ts",
  `import { plainTheme } from "./bridge-temp.test.js"\n`,
  rule,
  message,
)
expectRejects(
  "a product file importing a spec file fails",
  "apps/api/src/mcp/tools.ts",
  `import { answer } from "./answers.spec.js"\n`,
  rule,
  message,
)
expectRejects(
  "a named re-export out of a testing folder fails",
  "packages/doom/src/apply-edit.ts",
  `export { plainTheme } from "./testing/doom-fixtures-art.js"\n`,
  rule,
  message,
)
expectRejects(
  "a star re-export out of a testing folder fails",
  "packages/doom/src/apply-edit.ts",
  `export * from "./testing/doom-fixtures-art.js"\n`,
  rule,
  message,
)
expectAccepts(
  "a test file imports its fixtures",
  "packages/doom/src/bake-layout.test.ts",
  `import { plainTheme } from "./testing/doom-fixtures-art.js"\n`,
  rule,
)
expectAccepts(
  "a spec imports test support",
  "apps/web/src/design/color-picker.spec.tsx",
  `import { spot } from "@/testing/doom-fixtures"\n`,
  rule,
)
expectAccepts(
  "a testing file imports its sibling",
  "packages/mcp/src/testing/suite.ts",
  `import { memoryDecks } from "./memory-decks.js"\n`,
  rule,
)
expectAccepts(
  "product code imports product code",
  "packages/doom/src/apply-edit.ts",
  `import { measureWith } from "../index.js"\n`,
  rule,
)
expectAccepts(
  "a name that only starts like testing passes",
  "packages/doom/src/apply-edit.ts",
  `import { supports } from "./testing-support.js"\n`,
  rule,
)
expectAccepts(
  "a product file named testing passes",
  "packages/doom/src/apply-edit.ts",
  `import { spot } from "./testing.js"\n`,
  rule,
)
expectAccepts(
  "a name that only contains test passes",
  "packages/doom/src/apply-edit.ts",
  `import { latest } from "./latest.js"\n`,
  rule,
)
expectAccepts(
  "a script may wire the api harness",
  "scripts/vitest-api-database.mjs",
  `import { harness } from "../apps/api/src/testing/harness.ts"\n`,
  rule,
)
