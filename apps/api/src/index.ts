export { acceptCode, acceptLink, findAccess, issueMail } from "./account/account.js"
export { screenFor, type Screen } from "./oauth/clients.js"
export { deleteDecks, listDecks, renameDeck, restoreDeck, trashDeck } from "./doom/deck-list.js"
export { DeckListen, type CaughtRevision } from "./platform/listen.js"
export { sendWithResend, signLink, type Mail, type ResendAccount, type Sender } from "./platform/mail.js"
export { openPool, type Sql } from "./platform/pool.js"
export {
  chosenRevision,
  commitEdits,
  openSaved,
  readSaved,
  writeRevision,
  type Commit,
  type RevisionWrite,
} from "./legacy-decks/saved.js"
export { applySchema } from "./platform/schema.js"
export { discardOriginals, downloadOriginal, drainOriginals, finishOriginal, uploadOriginal } from "./doom/original.js"
export { LocalOriginalStore } from "./platform/local-original-store.js"
export { R2OriginalStore, type R2Settings } from "./platform/r2-original-store.js"
export type { OriginalStore, OriginalUpload, SignedOriginal } from "./platform/original-store.js"
export { bearerPrincipal, type Bearer } from "./oauth/tokens.js"
export { createApi, type ApiOptions } from "./server.js"
export { sessionCookie } from "./account/session-cookie.js"

export { fontMiddleware } from "./platform/font-route.js"
