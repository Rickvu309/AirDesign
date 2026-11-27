export const sessionRefusal = { ok: false, refusal: "session" }
export const toolLimit = "Ninety tool calls in five minutes. The next tool call can run in 300 seconds."
export const toolLimited = { ok: false, refusal: "rate", note: toolLimit }
export const storeFailure = { ok: false, refusal: "store" }
export const deckLimit = "Five decks in one minute. The next deck can open in 60 seconds."
