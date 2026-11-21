import { expectAccepts, expectRejects } from "../harness.js"

const rule = { "airdesign/no-bare-test": "error" }
const message = 'Import test from "./deck-test"'
const spec = "tests/browser/control-link.spec.ts"

expectRejects(
  "111fd513e control-link.spec.ts took test from Playwright and lost its deck state",
  spec,
  `import { copyFile } from "node:fs/promises"\nimport { join } from "node:path"\nimport { expect, test } from "@playwright/test"\nimport { openDeck, designing } from "./design-panel"\n\ntest("a person saves and removes a whole text element URL @export", async ({ page }, info) => {\n  await openDeck(page, "clean.pptx")\n})\n`,
  rule,
  message,
)
expectRejects("test alone from Playwright fails", spec, `import { test } from "@playwright/test"\n`, rule, message)
expectRejects(
  "test beside types fails",
  "tests/browser/home.spec.ts",
  `import { expect, test, type Page } from "@playwright/test"\n`,
  rule,
  message,
)
expectRejects("test renamed on import fails", spec, `import { test as base } from "@playwright/test"\n`, rule, message)
expectAccepts(
  "test from the deck fixture passes",
  spec,
  `import { expect, type Page } from "@playwright/test"\nimport { test } from "./deck-test"\n`,
  rule,
)
expectAccepts(
  "test from the stack fixture passes",
  spec,
  `import { forward, signInBrowser, test } from "./api-stack"\n`,
  rule,
)
expectAccepts(
  "expect and types from Playwright pass",
  spec,
  `import { expect, type Locator, type Page } from "@playwright/test"\n`,
  rule,
)
expectAccepts(
  "a type-only test import passes",
  spec,
  `import type { test } from "@playwright/test"\nimport { type test as typed } from "@playwright/test"\n`,
  rule,
)
expectAccepts(
  "the fixture file extends Playwright's test",
  "tests/browser/deck-test.ts",
  `import { expect, test as base } from "@playwright/test"\n`,
  rule,
)
expectAccepts(
  "a journey spec has its own runner",
  "tests/journeys/open-deck.spec.ts",
  `import { expect, test } from "@playwright/test"\n`,
  rule,
)
