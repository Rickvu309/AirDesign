export const deckStateFile = "deck-state.json"

export const browserSpec = (file) => /^tests\/browser\/.+\.spec\.ts$/.test(file)

export const deckStateNote = `A failed browser test that loaded a page of the app has, in its folder in the kept test results, ${deckStateFile}: the device's rows for each deck when it failed and before each reload.`
