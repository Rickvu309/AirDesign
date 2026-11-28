# Checks on deck ownership

Same fields as [checks-doom.md](checks-doom.md). The `apps/api` test starts the real API on its own Postgres database: `pnpm vitest run apps/api/src/owner.test.ts`.

## owner

Only a deck's owner acts on it through a tool call.

- `OnlyOwnerActs`: an accepted tool call acts as the account its credential belongs to, the grant's principal for a token and the session's account for a cookie, whatever account the caller claims, and that account owns the deck. Harm: one account edits another's deck.

Bounds: two accounts, two decks and one deck not yet made, rotating grant generations up to 2. [oauth](checks-server.md#oauth) models kept refresh tokens. `apps/api/src/oauth-tokens.test.ts` and `apps/api/src/gemini-sign-in.test.ts` exercise Gemini's kept token. Run: `pnpm check:specs owner`. Replay: `apps/api/src/owner.test.ts` through `POST /mcp` and the OAuth routes. Code: `caller` in `apps/api/src/server.ts`, `serveMcp` in `apps/api/src/mcp/mcp.ts`, which opens the decks of the account `caller` named, `bearerPrincipal` in `apps/api/src/oauth/tokens.ts`, `agentHost` in `apps/api/src/doom/agent-host.ts`, and `doomViewHost` in `apps/api/src/doom/doom-route.ts`. Storage checks ownership for tool reads, edits, run records and their positions, and for deck view reads and media. The agent key that `bearerPrincipal`'s grant names keys an edit's author and the limits, never the account a call acts as.

Painter lease ordering is outside the model. In c8b109779, `heldSince` in `apps/api/src/doom/doom-route.ts` started registering the lease before `sinceDoom` validates deck ownership. Deck data still goes through the storage guard. The model and replay cover the tool call's data access and do not check the lease side effect.

Sync: `specs/owner/covers.json`.
