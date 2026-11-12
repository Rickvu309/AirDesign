import { chromium } from "@playwright/test"

export const designViewport = { width: 1470, height: 923 }
export const designContext = { viewport: designViewport, deviceScaleFactor: 2, reducedMotion: "reduce" }

export const librariesHint = "LD_LIBRARY_PATH=~/.cache/chromium-libs/root/usr/lib/x86_64-linux-gnu"

export function launchProblem(message) {
  const library = message.match(/error while loading shared libraries: ([^:\s]+)/)?.[1]
  if (library)
    return `Chromium cannot start: ${library} is missing. On this machine run the command with ${librariesHint}`
  if (/Executable doesn't exist/.test(message))
    return "Playwright's Chromium is not installed. Run pnpm exec playwright install chromium once."
  return message.split("\n")[0]
}

export async function openBrowser() {
  try {
    return await chromium.launch()
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
