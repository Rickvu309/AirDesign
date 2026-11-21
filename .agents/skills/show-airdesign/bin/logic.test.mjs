import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { expect, it } from "vitest"
import { interCss, resolverFor } from "./logic.mjs"

it("opens a file, a file at a line it has, and an https link, and nothing else", () => {
  const repo = mkdtempSync(path.join(tmpdir(), "logic-refs-"))
  writeFileSync(path.join(repo, "proof.md"), "one\ntwo\nthree\n")
  const resolves = resolverFor(repo)
  expect(resolves("proof.md")).toBe(true)
  expect(resolves("proof.md:3")).toBe(true)
  expect(resolves("proof.md#outcomes")).toBe(true)
  expect(resolves("proof.md:9")).toBe(false)
  expect(resolves("absent.md")).toBe(false)
  expect(resolves(".")).toBe(false)
  expect(resolves("https://github.com/o/r/releases/download/proof-4/run.png")).toBe(true)
  expect(resolves("http://example.test/run.png")).toBe(false)
})

it("embeds Inter from the repo, and nothing when it is not installed", () => {
  const bare = mkdtempSync(path.join(tmpdir(), "logic-font-"))
  expect(interCss(bare)).toBe("")
  const repo = mkdtempSync(path.join(tmpdir(), "logic-font-"))
  const folder = path.join(repo, "apps/web/node_modules/@fontsource-variable/inter/files")
  mkdirSync(folder, { recursive: true })
  writeFileSync(path.join(folder, "inter-latin-wght-normal.woff2"), "font")
  expect(interCss(repo)).toContain(
    'font-family:"Inter Variable";font-weight:100 900;src:url(data:font/woff2;base64,Zm9udA==)',
  )
})
