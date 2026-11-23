export const sessionRefusal = { ok: false, refusal: "session" }
export const toolLimit = "Thirty tool calls in five minutes. The next tool call can run in 300 seconds."
export const toolLimited = { ok: false, refusal: "rate", note: toolLimit }
export const storeFailure = { ok: false, refusal: "store" }
