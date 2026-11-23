import fs from "node:fs"
import { registerHooks } from "node:module"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { expectAccepts, expectRejects } from "../harness.js"
import { limitValues } from "./no-limit-in-copy.js"

const packages = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../packages")

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && specifier.endsWith(".js") && context.parentURL?.endsWith(".ts")) {
      const typed = new URL(specifier.replace(/\.js$/, ".ts"), context.parentURL)
      if (fs.existsSync(typed)) return { url: typed.href, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
})

const { limits } = await import(pathToFileURL(path.join(packages, "doom/src/limits.ts")).href)

const numbered = Object.fromEntries(Object.entries(limits).filter(([, value]) => typeof value === "number"))
if (JSON.stringify(numbered) !== JSON.stringify(limitValues)) {
  throw new Error(
    `no-limit-in-copy read limits that differ from @airdesign/doom\nrule ${JSON.stringify(limitValues)}\ndocument ${JSON.stringify(numbered)}`,
  )
}

const rule = { "airdesign/no-limit-in-copy": "error" }
const source = "apps/web/src/copy/design-copy.ts"

expectRejects(
  "the 8,000 bytes from PR 659 at 3a39f9ce fails",
  source,
  `export const designCopy = {\n  textTooLong: "Use less text. Text and formatting must fit within 8,000 bytes.",\n}\n`,
  rule,
  "8,000 is limits.valueBytes or limits.notify in @airdesign/doom. Import limits from @airdesign/doom and interpolate it",
)
expectRejects(
  "a limit inside a template fails",
  source,
  "export const many = (count) => `${String(count)} of 50 slides`\n",
  rule,
  "50 is limits.slides",
)
expectRejects(
  "a limit without a separator fails",
  source,
  `export const long = "Names stop at 200 characters."\n`,
  rule,
  "200 is limits.name or limits.clientName",
)
expectRejects(
  "a limit in megabytes fails",
  source,
  `export const big = "Pictures up to 10 MB."\n`,
  rule,
  "10 MB is limits.media",
)
expectRejects(
  "a compact megabyte limit fails",
  source,
  `export const big = "Pictures up to 10MB."\n`,
  rule,
  "10MB is limits.media",
)
expectRejects(
  "a limit in kilobytes fails",
  source,
  `export const long = "Text must fit within 8 KB."\n`,
  rule,
  "8 KB is limits.valueBytes or limits.notify",
)
expectRejects(
  "a copy file outside the copy folder fails",
  "apps/web/src/connect/connect-copy.ts",
  `export const big = "Up to 100 rows."\n`,
  rule,
  "100 is limits.batch or limits.delete",
)
expectAccepts(
  "a limit taken from @airdesign/doom stays",
  source,
  'import { limits } from "@airdesign/doom"\nexport const long = `Text must fit within ${limits.valueBytes.toLocaleString("en")} bytes.`\n',
  rule,
)
expectAccepts("a percentage stays", "apps/web/src/copy/fill-copy.ts", `export const pct50 = "50%"\n`, rule)
expectAccepts("a price stays", "apps/web/src/copy/product-copy.ts", `export const fifty = "$50"\n`, rule)
expectAccepts("an angle stays", "apps/web/src/copy/body-copy.ts", `export const vert = "Rotate 20°"\n`, rule)
expectAccepts("a time stays", "apps/web/src/copy/product-copy.ts", `export const reset = "Mon 8:00 AM"\n`, rule)
expectAccepts("a number that is no limit stays", source, `export const step = "Step 3 of 4"\n`, rule)
expectAccepts(
  "a number in code stays",
  "apps/web/src/copy/usage-copy.ts",
  "export const share = (part) => part / 100\n",
  rule,
)
expectAccepts(
  "a test may write a limit",
  "apps/web/src/copy/design-copy.test.ts",
  `export const p = "8,000 bytes"\n`,
  rule,
)
expectAccepts(
  "a file outside copy may write a limit",
  "apps/web/src/design/text.tsx",
  `export const p = "8,000"\n`,
  rule,
)
