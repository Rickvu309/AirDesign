import { readFileSync } from "node:fs"
import path from "node:path"

const fixtures = "scripts/pptx-fixtures"
export const defaultDecks = ["doe-heat-pumps", "nasa-cots-parts-nesc", "nasa-8ft-tunnel"]

export const judgedDecks = (repo) => [
  ...JSON.parse(readFileSync(path.join(repo, fixtures, "corpus.json"), "utf8")).map(({ name }) =>
    path.join(fixtures, "corpus", name),
  ),
  path.join(fixtures, "nasa-1d-cnn.pptx"),
  path.join(fixtures, "doe-heat-pumps.pptx"),
]

export async function painted(page, deck) {
  await page.waitForFunction((wanted) => {
    if (document.querySelector(".thin-page")?.getAttribute("data-deck-ready") !== wanted) return false
    const seen = [...document.querySelectorAll("[data-slide-thumb]")].filter((cell) => {
      const box = cell.getBoundingClientRect()
      return box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth
    })
    return seen.length > 0 && seen.every((cell) => cell.querySelector("[data-thumb-paint]") !== null)
  }, deck)
}

export async function home(page) {
  await page.goto("/")
  await page.locator("input[type=file]").waitFor({ state: "attached" })
}

export async function imported(page, file) {
  const before = page.url()
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForFunction((previous) => location.href !== previous, before)
  const deck = new URL(page.url()).pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
  if (deck === undefined) throw new Error(`import of ${path.basename(file)} landed on ${page.url()}`)
  await painted(page, deck)
  return deck
}

export const importCase = (file) => ({
  name: `import-${path.basename(file, ".pptx")}`,
  async setup({ page, signIn }) {
    await signIn()
    await home(page)
  },
  async measure({ repo, page }) {
    const started = Date.now()
    await imported(page, path.join(repo, file))
    return Date.now() - started
  },
})
