#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { openBrowser } from "../../verify-airdesign/bin/browser.mjs"
import { themeCss } from "../../verify-airdesign/look/annotate.mjs"
import { pageWidth, toHtml, toMarkdown } from "../logic/page.mjs"
import { readTree } from "../logic/tree.mjs"

const usage = "show-airdesign logic <tree.json> [--out dir]"

export function resolverFor(repo) {
  return (ref) => {
    if (/^https:\/\/\S+$/.test(ref)) return true
    const [, file, line] = ref.replace(/#.*$/, "").match(/^(.+?)(?::(\d+))?$/) ?? []
    if (file === undefined) return false
    const full = path.resolve(repo, file.replace(/^~(?=\/)/, os.homedir()))
    if (!existsSync(full) || !statSync(full).isFile()) return false
    if (line === undefined) return true
    return Number(line) >= 1 && Number(line) <= readFileSync(full, "utf8").split("\n").length
  }
}

async function renderPng(html, file) {
  const browser = await openBrowser()
  try {
    const page = await browser.newPage({ viewport: { width: pageWidth, height: 800 }, deviceScaleFactor: 2 })
    await page.setContent(html)
    await page.evaluate(() => document.fonts.ready)
    await page.locator("main").screenshot({ path: file })
  } finally {
    await browser.close()
  }
}

async function main(args) {
  const [input, flag, outDir] = args
  if (input === undefined || !existsSync(input)) throw new Error(`name a tree file: ${usage}`)
  if (flag !== undefined && (flag !== "--out" || outDir === undefined)) throw new Error(usage)
  const repo = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim()
  const { tree, refusals } = readTree(JSON.parse(readFileSync(input, "utf8")), { resolves: resolverFor(repo) })
  if (tree === null) {
    console.log(JSON.stringify({ refusals }, null, 2))
    process.exitCode = 1
    return
  }
  const out = path.resolve(outDir ?? path.dirname(input))
  mkdirSync(out, { recursive: true })
  const name = path.basename(input, ".json")
  const files = {
    md: path.join(out, `${name}.md`),
    html: path.join(out, `${name}.html`),
    png: path.join(out, `${name}.png`),
  }
  const html = toHtml(tree, themeCss(repo))
  writeFileSync(files.md, toMarkdown(tree))
  writeFileSync(files.html, html)
  await renderPng(html, files.png)
  console.log(JSON.stringify({ verdict: tree.verdict, files }, null, 2))
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main(process.argv.slice(2))
