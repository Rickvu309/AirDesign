# Checks on agent turns, Aira stop, the Aira loop, usage, OAuth and deck ownership

Same fields as [checks-document.md](checks-document.md). The `apps/api` replays start the real API on their own Postgres database: `pnpm vitest run apps/api/src/turn.test.ts apps/api/src/aira-closing.test.ts apps/api/src/owner.test.ts`.

## turn

An account's agent turn on a deck, and the elements a person closes during it.

- `ClosedUntilTurnEnds`: a person's edit on an element the turn holds closes it to agent writes until the turn ends, and only the end of the turn reopens it. Harm: the agent writes over an element the person is working on.
- `RefusalKeepsTurn`: a refused call never ends the turn or reopens an element.
- `TurnKeepsItsRuns`: while a turn stays live, no step ends one of its runs. `saved` says whether the stored turn row has caught up: a call saves it after its deck write, so a second call sent at the same time can find the first call's run live on the deck and no row naming it, and must join that run. Harm: an agent that sends two tool calls at once has one refused as changed since read, or ends its own run on the other element.

Bounds: one account, one deck, two elements, one turn at a time. A turn starts with an element edit (`TurnStart`) or a slide tool call (`SlideStart`), a slide tool call in a live turn joins it (`SlideInTurn`), and it ends by Stop or the ten-minute idle window. `airdesign_add_text_box` and `airdesign_delete_element` are slide tool calls here: the replay drives every trace once with each of `add_slide`, `add_text_box` and `delete_element`. Run: `pnpm check:specs turn`. Replay: fixed traces in `apps/api/src/turn.test.ts` through `POST /mcp`, `/decks/commit` and the stored `deck.saved` row; a second test checks the traces cover every action. The model has no run ids, so the replay checks them itself: a step that starts a turn must answer a run id no earlier step answered, and after every step that leaves the turn live, the call's answer, each running element's `runId`, the `runId` of the slide row a slide call added and the `session.agent_turn` row must all name the turn's run. A slide tool that opens its own run inside a live turn instead of joining it fails there. Code: `liveTurn`, `heldRun`, `settleTurn`, `dropGoneTurn` in `packages/mcp/src/turn.ts`; `runFenced` in `packages/engine/src/agent-slides.ts`, which `liveTurn` asks so that a run the deck records ended, or one whose elements all ended, is not the turn's run; `openRun`, `joinRun`, `stopLiveRuns` in `packages/mcp/src/run.ts`; `slideTool` in `packages/mcp/src/slide-tool.ts`; `elementTool` in `packages/mcp/src/element-tool.ts`; `storedTurns` in `apps/api/src/agent-turn.ts` (the `session.agent_turn` row); the guard in `personEdit` in `packages/document/src/decide.ts`. The replay is sequential, so its rows are always saved; `apps/api/src/parallel-edits.test.ts` holds the turn save behind the second call's re-read through `POST /mcp`, and `packages/mcp/src/turn.test.ts` drives `heldRun` with an empty record. Leaves out: a turn row that names a run the deck records ended, which slide-run and slide-undo model: the next call starts a new run, as after the idle window; a row whose save failed, or a deck whose run predates its row, whose live run the next call joins as the turn's own. PR 391's retry needs no change here: each call is one step that decides on the current state, and a retried call reads the turn and the deck again before it decides, then `settleTurn` runs once after `settledCall`'s loop. A refused retry saves nothing, as `RefusalKeepsTurn` says. slide-run models the retry where its steps interleave. Two requests saving the same turn row at once, and a stop racing a slide call, are in slide-run.

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

## aira-loop

One Aira ask in the browser asks for one edit while the person may press Stop and then ask again. `askAira` is the only actor; the server is the edit landing and the answers it sends.

- `StoppedRunUndoable`: once a stopped ask resolved, an edit that landed and answered in time is in the exchange's runs, which offers Undo as one step, and its run is stopped. Harm: a person keeps a change they tried to stop, with no Undo, and the run stays live.
- `KnownRunClosed`: a run the exchange holds is stopped with stop_run before the ask resolves.
- `NextAskAfterClose`: a next ask's turn is sent only after the stopped ask resolved, so its edits never join the stopped run.
- `NextAskKeepsUndo`: the chat a next ask sends with still holds the stopped run, so Undo stays offered.

Bounds: one edit call, one Stop, one next ask. After Stop an edit call keeps its fetch for `landingWait` (10 s); the model assumes an answer comes within that wait once the server landed, so the wait ends only on a call that has not landed. Run: `pnpm check:specs aira-loop`. Replay: `tests/aira-loop-replay.test.ts` drives every edge through the real `askAira` with a scripted `fetch` and `pause`: each path from the start to an edge's source, then the edge, comparing every state the code shows with the model's. Code: `askAira`, `callTool`, `sendCall`, `continues`, `landedIn` and `closeRuns` in `apps/web/src/aira-loop.ts`; the panel's `run` in `apps/web/src/aira-panel.tsx`, which drops a superseded ask's updates and keeps New chat, history and Undo off until the ask resolved. Leaves out: an answer that comes after the wait. `late` marks that landing: the exchange offers no Undo for it and its run stays live until the idle window, so the next ask's edits may join it. A refused or failed edit, which writes no run, and a read, whose fetch Stop still cuts at once. Plants: Stop cutting the edit's fetch at once (main before this check) fails the replay and `StoppedRunUndoable`; dropping the next ask's merge fails it on `nextKnown`; not waiting for the landing fails it on `settled`.

Sync: the commit that added this check, on `626fae68`.

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

Bounds: one grant, generations up to 2, two exchanges. Run: `pnpm check:specs oauth`. Replay: `tests/oauth-replay.ts` through `oauth` in `packages/oauth/src/index.ts`. Its callers are `apps/api/src/grants.ts` and `apps/api/src/tokens.ts`. Leaves out: the web Worker's forward secret (`apps/web/worker/api-forward.ts`, `filterForwardedHeaders` in `apps/api/src/forward-secret.ts`). It needs no model: each request is judged alone, by comparing one header with the server's secret, with no state kept between requests, so no order of steps can break it. `apps/api/src/forward-secret.test.ts` covers it: a matching secret keeps the visitor headers, a missing or wrong one drops them, and the health route needs none. One case is by design and worth knowing: with no secret set on the server, it trusts the visitor headers from anyone.

Sync: `8eef931306bc47b21b66b33dc5d7dc14634b9f4f`.

## owner

Only a deck's owner acts on it through a tool call.

- `OnlyOwnerActs`: an accepted tool call acts as the account its credential belongs to, the grant's principal for a token and the session's account for a cookie, whatever account the caller claims, and that account owns the deck. Harm: one account edits another's deck.

Bounds: two accounts, two decks and one deck not yet made, grant generations up to 2. Run: `pnpm check:specs owner`. Replay: `apps/api/src/owner.test.ts` through `POST /mcp` and the OAuth routes. Code: `deckAccess` in `apps/api/src/saved.ts`, `prepare` in `serveMcp` in `apps/api/src/mcp.ts`, `bearerPrincipal` in `apps/api/src/tokens.ts`.

Sync: `8eef931306bc47b21b66b33dc5d7dc14634b9f4f`.
