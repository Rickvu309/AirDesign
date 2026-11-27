export type Good = {
  readonly method?: "GET"
  readonly shape: "json" | "form" | "query" | "none"
  readonly fields?: unknown
  readonly headers?: readonly string[]
  readonly answers: number
  readonly says?: string
}
