import { deckRoutes } from "@airdesign/catalog"
import type { OriginalStore } from "./original-store.js"
import type { Sql } from "./pool.js"

type AnsweredName = keyof typeof deckRoutes
type Parsed<Name extends AnsweredName> = ReturnType<(typeof deckRoutes)[Name]["read"]>
type Answer<Parsed> = (
  db: Sql,
  parsed: Extract<Parsed, { readonly ok: true }>,
  email: string,
  store: OriginalStore | undefined,
  mint: () => string,
) => Promise<unknown>

export type DeckAnswers = { readonly [Name in AnsweredName]: Answer<Parsed<Name>> }

type DeckRoute<Serve> = { readonly method: "POST"; readonly path: string; readonly serve: Serve }

export function answeredDeckRoutes<Serve>(
  answers: DeckAnswers,
  serve: <Parsed extends { readonly ok: boolean }>(read: (raw: unknown) => Parsed, answer: Answer<Parsed>) => Serve,
): DeckRoute<Serve>[] {
  const catalog: { [Name in AnsweredName]: { path: string; read: (raw: unknown) => Parsed<Name> } } = deckRoutes
  function row<Name extends AnsweredName>(name: Name): DeckRoute<Serve> {
    const route = catalog[name]
    return { method: "POST", path: route.path, serve: serve(route.read, answers[name]) }
  }
  return Object.keys(deckRoutes)
    .filter((name): name is AnsweredName => name in catalog)
    .map(row)
}
