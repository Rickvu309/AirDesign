# Checks on agent turns, Aira stop, usage, OAuth and deck ownership

Same fields as [checks-document.md](checks-document.md). The `apps/api` replays start the real API on their own Postgres database: `pnpm vitest run apps/api/src/turn.test.ts apps/api/src/aira-closing.test.ts apps/api/src/owner.test.ts`.

## turn

An account's agent turn on a deck, and the elements a person closes during it.

- `ClosedUntilTurnEnds`: a person's edit on an element the turn holds closes it to agent writes until the turn ends, and only the end of the turn reopens it. Harm: the agent writes over an element the person is working on.
- `RefusalKeepsTurn`: a refused call never ends the turn or reopens an element.

Bounds: one account, one deck, two elements, one turn at a time. A turn starts with an element edit (`TurnStart`) or a slide tool call (`SlideStart`), a slide tool call in a live turn joins it (`SlideInTurn`), and it ends by Stop or the ten-minute idle window. Run: `pnpm check:specs turn`. Replay: fixed traces in `apps/api/src/turn.test.ts` through `POST /mcp`, `/decks/commit` and the stored `deck.saved` row; a second test checks the traces cover every action. Code: `liveTurn`, `settleTurn`, `dropGoneTurn` in `packages/mcp/src/turn.ts`; `openRun`, `joinRun`, `stopLiveRuns` in `packages/mcp/src/run.ts`; `slideTool` in `packages/mcp/src/slide-tool.ts`; `storedTurns` in `apps/api/src/agent-turn.ts` (the `session.agent_turn` row); the guard in `personEdit` in `packages/document/src/decide.ts`. Leaves out: which run id a slide row carries, since the model has no run ids. Two requests saving the same turn row at once, and a stop racing a slide call, are in slide-run.

Known bug, from `30244817`: with no live turn and an earlier run still live on an element, as after the idle window, `slideTool` stops that run, which raises the deck revision, then checks the agent's `base` against the raised revision and refuses `stale`. The refusal is not saved, so the run stays live and every retry is refused the same way. The agent cannot add, duplicate, delete or move a slide until it stops the run or edits an element. Reproduced by the `it.fails` test in `apps/api/src/turn.test.ts`.

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

Bounds: one grant, generations up to 2, two exchanges. Run: `pnpm check:specs oauth`. Replay: `tests/oauth-replay.ts` through `oauth` in `packages/oauth/src/index.ts`. Its callers are `apps/api/src/grants.ts` and `apps/api/src/tokens.ts`. Leaves out: the web Worker's forward secret (`apps/web/worker/api-forward.ts`, `filterForwardedHeaders` in `apps/api/src/forward-secret.ts`). It needs no model: each request is judged alone, by comparing one header with the server's secret, with no state kept between requests, so no order of steps can break it. `apps/api/src/forward-secret.test.ts` covers it: a matching secret keeps the visitor headers, a missing or wrong one drops them, and the health route needs none. One case is by design and worth knowing: with no secret set on the server, it trusts the visitor headers from anyone.

Sync: `8eef931306bc47b21b66b33dc5d7dc14634b9f4f`.

## owner

Only a deck's owner acts on it through a tool call.

- `OnlyOwnerActs`: an accepted tool call acts as the account its credential belongs to, the grant's principal for a token and the session's account for a cookie, whatever account the caller claims, and that account owns the deck. Harm: one account edits another's deck.

Bounds: two accounts, two decks and one deck not yet made, grant generations up to 2. Run: `pnpm check:specs owner`. Replay: `apps/api/src/owner.test.ts` through `POST /mcp` and the OAuth routes. Code: `deckAccess` in `apps/api/src/saved.ts`, `prepare` in `serveMcp` in `apps/api/src/mcp.ts`, `bearerPrincipal` in `apps/api/src/tokens.ts`.

Sync: `8eef931306bc47b21b66b33dc5d7dc14634b9f4f`.

## slide-run

An agent run r that added a slide, an agent call (add_slide or read_deck) and the agent's stop_run of r as two MCP requests whose steps interleave. Each request loads the turn row (`turns.load`), reads the deck (`readSaved`), decides (`callTool`), writes the deck only if `deck.saved` still has the revision it read (`commitEdit`, `writeRevision`), and saves the turn row (`settleTurn`, `storedTurns` upsert). `element` says whether r also holds an element.

- `SlideOnRead`: a slide of r lands only on the revision the agent read. Harm if broken: an agent adds a slide to a deck it did not see.
- `TurnNeverOlder`: a saved turn row never replaces one with a newer revision.
- `StopFences`, in `SlideRun.known.cfg`: no slide of r lands once its Stop took effect. Fails today; see the first bug.
- `TurnStaysEnded`, in `SlideRun.known.cfg`: after stop_run of r answered ok, the turn row no longer names r. Fails today; see the second bug.

Bounds: one run r, one stop request, at most two agent calls, one element. 436 states. Run: `pnpm check:specs slide-run`. Replay: `apps/api/src/slide-run.test.ts` drives every edge through the steps of `serveMcp`, composed in `apps/api/src/mcp-steps.ts` from `storedTurns`, `readSaved`, `deckAccess`, `dropGoneTurn`, `callTool`, `commitEdit` and `settleTurn`, on the test's own Postgres. Code: `slideTool` in `packages/mcp/src/slide-tool.ts`, `agentSlide` in `packages/engine/src/agent-slides.ts`, `stopRun` in `packages/mcp/src/call-tool.ts`, `endOnTouched` in `packages/engine/src/call.ts`, `settleTurn` in `packages/mcp/src/turn.ts`, `storedTurns` in `apps/api/src/agent-turn.ts`, `serveMcp` and `commitEdit` in `apps/api/src/mcp.ts`. Leaves out: the idle window (turns stay live), admission and limits, the other three slide tools (they share `agentSlide`), and Aira's own loop. `mcp-steps.ts` repeats the order of `serveMcp`'s bridge; if that order changes, change it there.

Known bug, from `30244817`: stop_run of a run that only added slides answers ok and changes nothing in the deck, and `agentSlide` checks no run. So an add_slide that read the turn and the deck before the stop lands under the stopped run, because the deck's revision did not move. A run that also holds an element is caught by the revision, unless the agent reads the deck after the stop wrote it and before the stop saved the turn row: then its next slide call, which still finds r in the turn, lands too. Harm: after Stop answered, the agent's slide still lands. Reproduced by the first `it.fails` test in `apps/api/src/slide-run-stop.test.ts`. The fix on branch `spec-bugs` (not merged) fences a run whose elements all ended, which leaves a run that only added slides unfenced.

Known bug, from `50489172` (the tie rule came from `2d99a539`): the turn upsert replaces a row of the same revision. When an add_slide lands and stop_run of the same run answers at that revision before the add saves its turn, the add's save comes second and writes r back. Harm: the stopped run is live again, so the agent's next calls join it. Reproduced by the second `it.fails` test in `apps/api/src/slide-run-stop.test.ts`.

Not modeled: PR 391's retry of a tool call that lost the deck's compare-and-swap is not merged at the sync commit. When it merges, add to this model a retry that loads the turn and the deck again, and check that a call lands at most once, that a retried call is decided on the fresh deck so a person's edit is never written over, and that it is counted once against the limits, with PR 390's `indexing` refusal beside it. One open turn per deck per account holds by the table's primary key `(email, deck)`. A person's protection lives in the deck's register, and every write to it is a compare-and-swap on `deck.saved.revision`, so a call on another server decides on the deck it read or does not land. edit and this replay cover that.

Sync: `a68645c585e877ba8bf7628ab998911969d0ad07`.

## slide-undo

A person's run Undo of agent run r after r added a slide, with the agent still calling, one request at a time.

- `UndoAllOrNothing`: an Undo takes back every slide of r that shows, or none. Harm if broken: Undo leaves half of an agent's slide edit.
- `RefusedChangesNothing`: a refused Undo leaves the deck as it was.
- `UndoFences`, in `SlideUndo.known.cfg`: no slide of r lands once its Undo landed. Fails today; see the bug.
- `UndoReachesEverySlide`, in `SlideUndo.known.cfg`: a slide of r that shows and that no person moved can be taken back by run Undo. Fails after the same trace.

Bounds: two agent slide calls, one stop, one person move, two Undo tries. 80 states. Run: `pnpm check:specs slide-undo`. Replay: `apps/api/src/slide-undo.test.ts` drives every edge through `undoRun` in `apps/api/src/undo.ts`, `commitEdits` in `apps/api/src/saved.ts` for the person's move, and the MCP steps of `mcp-steps.ts`, on Postgres. Code: `undoSlides` and `undoOf` in `packages/document/src/person-undo.ts`, `undoRun` in `packages/engine/src/call.ts`. Leaves out: interleaving inside a request (slide-run has it), a person's own undo of the move, elements of r.

Known bug, from `30244817`: run Undo does not touch the turn row, and `agentSlide` checks no run. While the turn still names r, as when Aira's closing stop_run was lost or revived by the slide-run race, the agent's next slide lands under the undone run, and every later run Undo of r is refused because `undoSlides` finds the slides it already took back gone. Harm: a slide the agent adds after Undo can never be undone with the run. Reproduced by the `it.fails` tests in `apps/api/src/slide-undo.test.ts`.

Sync: `a68645c585e877ba8bf7628ab998911969d0ad07`.
