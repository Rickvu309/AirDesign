import { deckRoutes } from "@airdesign/catalog"
import { answered, post } from "@/decks/deck-request"
import { clearOpeningDeck, openingDeck } from "@/lib/first-request"

function deleted(answer: { readonly ok?: unknown; readonly deleted?: unknown }, deck: string): boolean {
  return answer.ok === true && Array.isArray(answer.deleted) && answer.deleted.includes(deck)
}

export async function discardOpening(deck: string): Promise<boolean> {
  try {
    if (!(await answered(deckRoutes.trash.path, { deck }))) return false
    const answer: { ok?: unknown; deleted?: unknown } = await post(deckRoutes.delete.path, { decks: [deck] })
    if (!deleted(answer, deck)) return false
    if (openingDeck() === deck) clearOpeningDeck()
    return true
  } catch {
    return false
  }
}
