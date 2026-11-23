import { documentAdvice, documentReachFaults } from "./document-reach.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const faultsOf = (files) => documentReachFaults(Object.keys(files), (file) => files[file])

same(
  "an editor file that imports document fails and is told to use Doom",
  faultsOf({ "apps/web/src/design/shape-grid.tsx": 'import { presets } from "@airdesign/document"\n' }),
  [`apps/web/src/design/shape-grid.tsx:1 imports @airdesign/document. ${documentAdvice}`],
)
same(
  "a type import, a split import, a re-export, a deep import, a dynamic import and a require each fail",
  faultsOf({
    "packages/catalog/src/deck-routes.ts": [
      'import type { Refusal } from "@airdesign/document"',
      "import {",
      "  refusals,",
      '} from "@airdesign/document"',
      'export * from "@airdesign/document"',
      'import { orderKeyBetween } from "@airdesign/document/src/order-key.js"',
      'const model = await import("@airdesign/document")',
      'const legacy = require("@airdesign/document")',
    ].join("\n"),
  }).map((fault) => fault.split(" ")[0]),
  [1, 4, 5, 6, 7, 8].map((line) => `packages/catalog/src/deck-routes.ts:${String(line)}`),
)
same(
  "a multiline dynamic import, a vi.mock and TypeScript import forms each fail",
  faultsOf({
    "apps/web/src/editor/slide.test.ts": [
      "const model = await import(",
      '  "@airdesign/document"',
      ")",
      'vi.mock("@airdesign/document", () => ({}))',
      'vi.doMock("@airdesign/document/src/link-target.js", () => ({}))',
      'const actual = await vi.importActual("@airdesign/document")',
      'import legacy = require("@airdesign/document")',
      'type Legacy = import("@airdesign/document").Preset',
    ].join("\n"),
  }).map((fault) => fault.split(" ")[0]),
  [2, 4, 5, 6, 7, 8].map((line) => `apps/web/src/editor/slide.test.ts:${String(line)}`),
)
same(
  "a package that lists document as a dependency fails",
  faultsOf({
    "packages/render/package.json": JSON.stringify({ devDependencies: { "@airdesign/document": "workspace:*" } }),
  }),
  [`packages/render/package.json depends on @airdesign/document. ${documentAdvice}`],
)
same(
  "pptx and document's own files read document",
  faultsOf({
    "packages/pptx/src/fill-read.ts": 'import { patternPresets } from "@airdesign/document"\n',
    "packages/pptx/package.json": JSON.stringify({ dependencies: { "@airdesign/document": "workspace:*" } }),
    "packages/document/src/format.test.ts": 'import { stamps } from "@airdesign/document"\n',
  }),
  [],
)
same(
  "words that name document without importing it pass",
  faultsOf({
    "scripts/clone-edits.mjs": 'const document = await packageBuild(root, "@airdesign/document")\n',
    "tooling/oxlint-plugin-airdesign/rules/no-element-id-cast.js":
      'const message = "Call elementId or readElementId from @airdesign/document instead of casting to ElementId."\n',
    "apps/web/package.json": JSON.stringify({ dependencies: { "@airdesign/doom": "workspace:*" } }),
    "docs/packs.md": 'import { presets } from "@airdesign/document"\n',
    "scripts/fixture.test.mjs": `  'import { presets } from "@airdesign/document"',\n  'await import("@airdesign/document")',\n`,
  }),
  [],
)
