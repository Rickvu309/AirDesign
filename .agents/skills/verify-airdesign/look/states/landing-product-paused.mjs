import playing from "./landing-product-playing.mjs"

async function drive(kit) {
  await playing.drive(kit)
  const pause = kit.page.getByRole("button", { name: "Pause demo" })
  if (await pause.isVisible()) await pause.click()
}

export default { name: "landing-product-paused", design: null, drive }
