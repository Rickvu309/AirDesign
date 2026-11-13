import { existsSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { chromium } from "@playwright/test"

export const designViewport = { width: 1470, height: 923 }
export const designContext = { viewport: designViewport, deviceScaleFactor: 2, reducedMotion: "reduce" }

export const librariesDir = path.join(os.homedir(), ".cache/chromium-libs/root/usr/lib/x86_64-linux-gnu")

export function browserEnv(env, dir = librariesDir, present = existsSync) {
  const given = (env.LD_LIBRARY_PATH ?? "").split(":").filter(Boolean)
  if (!present(dir) || given.includes(dir)) return env
  return { ...env, LD_LIBRARY_PATH: [dir, ...given].join(":") }
}

export function launchProblem(message) {
  const library = message.match(/error while loading shared libraries: ([^:\s]+)/)?.[1]
  if (library)
    return `Chromium cannot start: ${library} is missing. Unpack Chromium's libraries into ${librariesDir}; every verify-airdesign command and suite, pnpm test:browser and pnpm test:journeys add that folder to LD_LIBRARY_PATH when it exists.`
  if (/Executable doesn't exist/.test(message))
    return "Playwright's Chromium is not installed. Run pnpm exec playwright install chromium once."
  return message.split("\n")[0]
}

export async function openBrowser(
  launch = (options) => chromium.launch(options),
  env = process.env,
  dir = librariesDir,
  present = existsSync,
) {
  try {
    return await launch({ env: browserEnv(env, dir, present) })
  } catch (error) {
    throw new Error(launchProblem(String(error?.message ?? error)))
  }
}

export async function settle(page) {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)))
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
}
