export const deckStateFile = "deck-state.json"

export const browserSpec = (file) => /^tests\/browser\/.+\.spec\.ts$/.test(file)

export const deckStateNote = `A failed browser test's folder in the kept test results holds ${deckStateFile}: the device's rows for each deck when it failed and before each reload, and the server's revision and elements for each open deck.`
