# Checks on agent turns, Aira stop, usage, OAuth and deck ownership

Same fields as [checks-document.md](checks-document.md). The `apps/api` replays start the real API on their own Postgres database: `pnpm vitest run apps/api/src/turn.test.ts apps/api/src/aira-closing.test.ts apps/api/src/owner.test.ts`.

## turn

An account's agent turn on a deck, and the elements a person closes during it.

- `ClosedUntilTurnEnds`: a person's edit on an element the turn holds closes it to agent writes until the turn ends, and only the end of the turn reopens it. Harm: the agent writes over an element the person is working on.
- `RefusalKeepsTurn`: a refused call never ends the turn or reopens an element.

Bounds: one account, one deck, two elements, one turn at a time. A turn starts with an element edit (`TurnStart`) or a slide tool call (`SlideStart`), a slide tool call in a live turn joins it (`SlideInTurn`). `airdesign_add_text_box` and `airdesign_delete_element` are slide tool calls here: the replay drives every trace once with each of `add_slide`, `add_text_box` and `delete_element`, and it ends by Stop or the ten-minute idle window. Run: `pnpm check:specs turn`. Replay: fixed traces in `apps/api/src/turn.test.ts` through `POST /mcp`, `/decks/commit` and the stored `deck.saved` row; a second test checks the traces cover every action. Code: `liveTurn`, `settleTurn`, `dropGoneTurn` in `packages/mcp/src/turn.ts`; `openRun`, `joinRun`, `stopLiveRuns` in `packages/mcp/src/run.ts`; `slideTool` in `packages/mcp/src/slide-tool.ts`; `elementTool` in `packages/mcp/src/element-tool.ts`; `storedTurns` in `apps/api/src/agent-turn.ts` (the `session.agent_turn` row); the guard in `personEdit` in `packages/document/src/decide.ts`. Leaves out: which run id a slide row carries, since the model has no run ids; two servers writing the same turn row at once.

With no live turn, `slideTool` checks the agent's `base` against the deck it read, stops any live run, then sends the stopped revision as `base`; the last trace replays a slide call after the idle window.

Sync: `8eef931306bc47b21b66b33dc5d7dc14634b9f4f`.

## stop

One Aira ask runs its model call on server A while a person stops it from server B, leaves, or both. The `session.aira_ask` row in Postgres is the only shared state.

- `ChargedOnce`: an ask is charged at most once. Harm: a person pays twice.
- `RowOutlivesCall`: the ask row is forgotten only after the model call closed.
- `AnsweredAfterClose`: a stop that found the row and did not time out is answered only after the call closed and was charged.
- `OneOpenTurn`: a next ask is reserved only after the earlier call closed.
- `StopIsNotLost`, `StopIsAnswered`, `NextAskIsAnswered`: a stop reaches the call even if a wake is dropped, and every waiting stop or next ask gets an answer. These are liveness properties under the fairness in `Spec`.

Bounds: one ask, one stop, one next ask, a listen connection that can drop and reconnect. Run: `pnpm check:specs stop`. Replay: `apps/api/src/aira-closing.test.ts` drives two `Closing` instances from `apps/api/src/aira-closing.ts`, each on its own listen connection, against the real rows. Code: `Closing`, and the reserve and settle calls in `apps/api/src/aira.ts`.

Sync: `8eef931306bc47b21b66b33dc5d7dc14634b9f4f`.

## usage

The weekly Claude spend ledger and its hold for an open turn.

- `HoldTracksTurn`: a hold exists exactly while a turn is open.
- `WithinAllowance`: spend plus hold never passes the allowance. Harm: the account spends past its week.
- `StoppedWithinReserve`: a stopped call is charged no more than its hold.
- `ChargedOnlyWhileOpen`: nothing is charged with no open turn.

Bounds: one account, one turn, the holds named in `Usage.tla`, two weeks. Run: `pnpm check:specs usage`. Replay: `tests/usage-replay.ts` through `usage` in `packages/usage/src/index.ts`. Leaves out: the read-only usage route's `available` answer in `apps/api/src/aira-usage-route.ts`.

Sync: `8eef931306bc47b21b66b33dc5d7dc14634b9f4f`.

## oauth

One OAuth grant: code exchange, calls, refresh rotation and revocation.

- `CodeWorksOnce`: an authorization code is exchanged once.
- `RotatedRefreshIsDead`: a rotated refresh token never works again.
- `ReuseRevokesFamily`: reusing a rotated token revokes the whole grant. Harm: a stolen token keeps working.
- `AfterRevocation`: after revocation no call or rotation is accepted.
- `IdentityIsStored`: every accepted call acts as the stored principal.

Bounds: one grant, generations up to 2, two exchanges. Run: `pnpm check:specs oauth`. Replay: `tests/oauth-replay.ts` through `oauth` in `packages/oauth/src/index.ts`. Its callers are `apps/api/src/grants.ts` and `apps/api/src/tokens.ts`. Leaves out: the web Worker's forward secret (`apps/web/worker/api-forward.ts`, the API's trust of forwarded headers); no spec models it.

Sync: `8eef931306bc47b21b66b33dc5d7dc14634b9f4f`.

## owner

Only a deck's owner acts on it through a tool call.

- `OnlyOwnerActs`: an accepted tool call acts as the account its credential belongs to, the grant's principal for a token and the session's account for a cookie, whatever account the caller claims, and that account owns the deck. Harm: one account edits another's deck.

Bounds: two accounts, two decks and one deck not yet made, grant generations up to 2. Run: `pnpm check:specs owner`. Replay: `apps/api/src/owner.test.ts` through `POST /mcp` and the OAuth routes. Code: `deckAccess` in `apps/api/src/saved.ts`, `prepare` in `serveMcp` in `apps/api/src/mcp.ts`, `bearerPrincipal` in `apps/api/src/tokens.ts`.

Sync: `8eef931306bc47b21b66b33dc5d7dc14634b9f4f`.
