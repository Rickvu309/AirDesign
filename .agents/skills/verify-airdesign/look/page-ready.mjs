const doomEditor = /^\/s(?:\/|\?|#|$)/

export function paintedSignal(where) {
  return doomEditor.test(where) ? "[data-doom-ready]" : null
}

export async function pageReady(page, where) {
  const signal = paintedSignal(where)
  if (signal !== null) await page.locator(signal).first().waitFor({ state: "attached" })
}
