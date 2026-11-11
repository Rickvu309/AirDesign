import { deckRoutes } from "@airdesign/catalog"
import type { OriginalStore } from "./original-store.js"
import type { Sql } from "./pool.js"
import type { Route } from "./server.js"

type AnsweredName = Exclude<keyof typeof deckRoutes, "watch">
type Parsed<Name extends AnsweredName> = ReturnType<(typeof deckRoutes)[Name]["read"]>
type Answer<Parsed> = (
  db: Sql,
  parsed: Extract<Parsed, { readonly ok: true }>,
  email: string,
  store: OriginalStore | undefined,
  mint: () => string,
) => Promise<unknown>

export type DeckAnswers = { readonly [Name in AnsweredName]: Answer<Parsed<Name>> }

export function answeredDeckRoutes(
  answers: DeckAnswers,
  serve: <Parsed extends { readonly ok: boolean }>(
    read: (raw: unknown) => Parsed,
    answer: Answer<Parsed>,
  ) => Route["serve"],
): Route[] {
  const catalog: { [Name in AnsweredName]: { path: string; read: (raw: unknown) => Parsed<Name> } } = deckRoutes
  function row<Name extends AnsweredName>(name: Name): Route {
    const route = catalog[name]
    return { method: "POST", path: route.path, serve: serve(route.read, answers[name]) }
  }
  return Object.keys(deckRoutes)
    .filter((name): name is AnsweredName => name !== "watch")
    .map(row)
}
