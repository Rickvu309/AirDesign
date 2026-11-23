import { mkdirSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { designContext, openBrowser, settle } from "./browser.mjs"
import { pageMatches, readAllow, staleEntries } from "../look/allow.mjs"
import { captureLook, themeValues } from "../look/capture.mjs"
import { captureCompare } from "../look/compare.mjs"
import { contextPool } from "../look/context-pool.mjs"
import { pageReady } from "../look/page-ready.mjs"
import { writeSheet } from "../look/sheet.mjs"
import { find, matching, reach, states, sweep } from "../look/states.mjs"

const valued = ["--state", "--only", "--cookie", "--out"]

function read(args) {
  const values = []
  const flags = {}
  for (let index = 0; index < args.length; index += 1) {
    const word = args[index]
    if (!word.startsWith("--")) values.push(word)
    else if (word === "--off-token") flags.offToken = true
    else if (valued.includes(word) && args[index + 1] !== undefined && !args[index + 1].startsWith("--"))
      flags[word.slice(2)] = args[(index += 1)]
    else throw new Error(`unknown flag or missing value: ${word}`)
  }
  return { values, flags }
}

export async function designCommand(command, args, runtime) {
  if (command === "states")
    return {
      command,
      states: states.map(({ name, design, journey, at }) => ({
        name,
        design,
        from: journey ? `${journey} at ${at}` : "own driver",
      })),
    }
  const { values, flags } = read(args)
  const [run, target, screen] = values
  const state = runtime.readState(run)
  const named = flags.state ? find(flags.state) : target && !target.startsWith("/") ? find(target) : undefined
  const where = named ? undefined : target
  if (command !== "sheet" && named === undefined && !where?.startsWith("/"))
    throw new Error(`name a state or a page path: verify-airdesign ${command} <run> <state-or-path>`)
  const out = flags.out ? path.resolve(flags.out) : path.join(runtime.evidenceDir(run), `${command}-${Date.now()}`)
  mkdirSync(out, { recursive: true })
  const catalog = await import(pathToFileURL(path.join(runtime.repo, "packages/catalog/dist/index.js")).href)
  const identifiers = catalog.projectTools(catalog.catalog).map((tool) => tool.name)
  const allow = readAllow()
  const browser = await openBrowser()
  const contexts = contextPool(browser, { ...designContext, baseURL: state.origin })
  const open = async (name) => {
    const context = await contexts.take()
    const page = await context.newPage()
    page.setDefaultTimeout(20_000)
    const { kit, out: folder } = await runtime.journeyKit({ run, name, page, context })
    return { kit: { ...kit, out: folder }, close: () => contexts.give(context) }
  }
  const look = async (page, scope, folder) =>
    captureLook(page, folder, {
      scope,
      allow,
      identifiers,
      offToken: flags.offToken,
      tokens: flags.offToken ? await themeValues(page, runtime.repo) : undefined,
    })
  const compare = async (page, design, folder) => {
    const context = await browser.newContext({ ...designContext, baseURL: state.origin })
    try {
      const screenPage = await context.newPage()
      const answer = await screenPage.goto(design)
      if (!answer?.ok()) throw new Error(`no design screen at ${design}`)
      await screenPage.locator("body :visible").first().waitFor({ state: "visible" })
      if ((await screenPage.locator("[data-not-found-live]").count()) > 0)
        throw new Error(`no design screen at ${design}`)
      await settle(screenPage)
      return await captureCompare(page, screenPage, folder)
    } finally {
      await context.close()
    }
  }
  try {
    if (command === "sheet") {
      const selected = [...new Set((flags.only ?? "*").split(",").flatMap((pattern) => matching(pattern)))]
      if (selected.length === 0) throw new Error(`no state matches ${flags.only}`)
      const rows = new Map()
      const used = new Set()
      const failures = await sweep(
        selected,
        (unit) => open(unit.states.map((each) => each.name).join("+")),
        async (each, kit) => {
          const folder = path.join(out, each.name)
          const looked = await look(kit.page, each.name, folder)
          for (const index of looked.used) used.add(index)
          const comparison = each.design ? await compare(kit.page, each.design, path.join(folder, "compare")) : null
          rows.set(each.name, { name: each.name, design: each.design, look: looked, comparison })
        },
      )
      for (const failure of failures)
        rows.set(failure.state, { name: failure.state, design: null, error: failure.error })
      const ordered = selected.map((each) => rows.get(each.name)).filter(Boolean)
      const judged = allow.filter((entry) => selected.some((each) => pageMatches(entry.page, each.name)))
      const stale = flags.only ? [] : staleEntries(judged, used)
      const result = await writeSheet(browser, out, ordered, stale)
      return { command, run, ...result }
    }
    const { kit, close } = await open(named?.name ?? command)
    try {
      if (named) await reach(named, kit)
      else {
        if (flags.cookie) {
          const split = flags.cookie.indexOf("=")
          if (split < 1) throw new Error("--cookie takes name=value")
          await kit.context.addCookies([
            { name: flags.cookie.slice(0, split), value: flags.cookie.slice(split + 1), url: state.origin },
          ])
        } else if (!where.startsWith("/screens/")) await kit.signIn()
        await kit.page.goto(where)
        await pageReady(kit.page, where)
      }
      const scope = named?.name ?? where
      if (command === "look") {
        const { report, used, ...looked } = await look(kit.page, scope, out)
        return { command, run, target: scope, ...looked }
      }
      const design = screen ?? named?.design
      if (design === undefined || design === null || !new URL(design, state.origin).pathname.startsWith("/screens/"))
        throw new Error(`name a design screen under /screens/ for ${scope}; this state has none`)
      const { report, ...compared } = await compare(kit.page, design, out)
      return {
        command,
        run,
        target: scope,
        screen: design,
        ...compared,
        differences: report.differences.map((row) => `${row.number}. ${row.name}: ${row.status}`),
      }
    } finally {
      await close()
    }
  } finally {
    await browser.close()
  }
}
