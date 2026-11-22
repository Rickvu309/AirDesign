const sceneEditor = /^\/s(?:\/|\?|#|$)/

export function paintedSignal(where) {
  return sceneEditor.test(where) ? "[data-scene-ready]" : null
}

export async function pageReady(page, where) {
  const signal = paintedSignal(where)
  if (signal !== null) await page.locator(signal).first().waitFor({ state: "attached" })
}
