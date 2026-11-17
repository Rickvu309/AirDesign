import { deckRoutes } from "@airdesign/catalog"
import { moveFailedOf, movingOf } from "@/copy/product-copy"
import { answered } from "@/decks/deck-request"
import { settle, showFailed, showStatus, type ToastId } from "@/decks/deck-notice"

export async function moveDeck(
  deck: { deck: string; name: string },
  onMoved: (pending: ToastId) => void | Promise<void>,
) {
  const key = `move-${deck.deck}`
  settle(key)
  const pending = showStatus(movingOf(deck.name))
  if (!(await answered(deckRoutes.trash.path, { deck: deck.deck }))) {
    showFailed(key, moveFailedOf(deck.name), () => void moveDeck(deck, onMoved), pending)
    return
  }
  await onMoved(pending)
}
