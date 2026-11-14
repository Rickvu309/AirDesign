import { fixtureDeck } from "../fixture-deck.mjs"

const newerBuild = 1_000_000

async function drive(kit) {
  await fixtureDeck(kit)
  const address = kit.page.url()
  await kit.page.evaluate(
    (version) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("airdesign", version)
        request.onsuccess = () => {
          request.result.close()
          resolve(undefined)
        }
        request.onerror = () => reject(request.error)
      }),
    newerBuild,
  )
  await kit.page.goto(address)
  await kit.page
    .locator("[data-deck-refused], .thin-page[data-deck-ready]")
    .first()
    .waitFor()
    .catch(() => undefined)
  await kit.page.waitForTimeout(1000)
}

export default { name: "deck-newer", design: null, drive }
