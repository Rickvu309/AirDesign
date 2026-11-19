type Asked = {
  readonly method: () => string
  readonly url: () => string
  readonly failure: () => { readonly errorText: string } | null
}
type Answered = { readonly status: () => number; readonly request: () => Asked }
type Watched = {
  on(event: "request" | "requestfailed", listener: (request: Asked) => void): unknown
  on(event: "response", listener: (response: Answered) => void): unknown
}
type Entry = { readonly asked: string; answer: string }

const fileExtension = /\.[a-z0-9]+$/i

export function watchRequests(context: Watched, now: () => number = Date.now): () => string {
  const began = now()
  const since = () => `+${String(now() - began)} ms`
  const entries = new Map<Asked, Entry>()
  context.on("request", (request) => {
    const { pathname } = new URL(request.url())
    if (fileExtension.test(pathname)) return
    entries.set(request, { asked: `${since()} ${request.method()} ${pathname}`, answer: "no answer" })
  })
  context.on("response", (response) => {
    const entry = entries.get(response.request())
    if (entry !== undefined) entry.answer = `${String(response.status())} at ${since()}`
  })
  context.on("requestfailed", (request) => {
    const entry = entries.get(request)
    if (entry !== undefined) entry.answer = `${request.failure()?.errorText ?? "failed"} at ${since()}`
  })
  return () => [...entries.values()].map((entry) => `${entry.asked} -> ${entry.answer}`).join("\n")
}
