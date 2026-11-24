const editorPath = /^\/s(?:\/|\?|#|$)/

export function paintedSignal(where) {
  return editorPath.test(where) ? "[data-editor-ready]" : null
}

export async function pageReady(page, where) {
  const signal = paintedSignal(where)
  if (signal !== null) await page.locator(signal).first().waitFor({ state: "attached" })
}
