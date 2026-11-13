# Checks on agent turns, Aira stop, usage, OAuth and deck ownership

Same fields as [checks-document.md](checks-document.md). The `apps/api` replays start the real API on their own Postgres database: `pnpm vitest run apps/api/src/turn.test.ts apps/api/src/aira-closing.test.ts apps/api/src/owner.test.ts`.

## turn

An account's agent turn on a deck, and the elements a person closes during it.

- `ClosedUntilTurnEnds`: a person's edit on an element the turn holds closes it to agent writes until the turn ends, and only the end of the turn reopens it. Harm: the agent writes over an element the person is working on.
- `RefusalKeepsTurn`: a refused call never ends the turn or reopens an element.
- `TurnKeepsItsRuns`: while a turn stays live, no step ends one of its runs. `saved` says whether the stored turn row has caught up: a call saves it after its deck write, so a second call sent at the same time can find the first call's run live on the deck and no row naming it, and must join that run. Harm: an agent that sends two tool calls at once has one refused as changed since read, or ends its own run on the other element.

Bounds: one account, one deck, two elements, one turn at a time. A turn starts with an element edit (`TurnStart`) or a slide tool call (`SlideStart`), a slide tool call in a live turn joins it (`SlideInTurn`), and it ends by Stop or the ten-minute idle window. Run: `pnpm check:specs turn`. Replay: fixed traces in `apps/api/src/turn.test.ts` through `POST /mcp`, `/decks/commit` and the stored `deck.saved` row; a second test checks the traces cover every action. The model has no run ids, so the replay checks them itself: a step that starts a turn must answer a run id no earlier step answered, and after every step that leaves the turn live, the call's answer, each running element's `runId`, the `runId` of the slide row a slide call added and the `session.agent_turn` row must all name the turn's run. A slide tool that opens its own run inside a live turn instead of joining it fails there. Code: `liveTurn`, `heldRun`, `settleTurn`, `dropGoneTurn` in `packages/mcp/src/turn.ts`; `runFenced` in `packages/engine/src/agent-slides.ts`, which `liveTurn` asks so that a run the deck records ended, or one whose elements all ended, is not the turn's run; `openRun`, `joinRun`, `stopLiveRuns` in `packages/mcp/src/run.ts`; `slideTool` in `packages/mcp/src/slide-tool.ts`; `storedTurns` in `apps/api/src/agent-turn.ts` (the `session.agent_turn` row); the guard in `personEdit` in `packages/document/src/decide.ts`. The replay is sequential, so its rows are always saved; `apps/api/src/parallel-edits.test.ts` holds the turn save behind the second call's re-read through `POST /mcp`, and `packages/mcp/src/turn.test.ts` drives `heldRun` with an empty record. Leaves out: a turn row that names a run the deck records ended, which slide-run and slide-undo model: the next call starts a new run, as after the idle window; a row whose save failed, or a deck whose run predates its row, whose live run the next call joins as the turn's own. PR 391's retry needs no change here: each call is one step that decides on the current state, and a retried call reads the turn and the deck again before it decides, then `settleTurn` runs once after `settledCall`'s loop. A refused retry saves nothing, as `RefusalKeepsTurn` says. slide-run models the retry where its steps interleave. Two requests saving the same turn row at once, and a stop racing a slide call, are in slide-run.

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

Bounds: one grant, generations up to 2, two exchanges. Run: `pnpm check:specs oauth`. Replay: `tests/oauth-replay.ts` through `oauth` in `packages/oauth/src/index.ts`. Its callers are `apps/api/src/grants.ts` and `apps/api/src/tokens.ts`. Leaves out: the web Worker's forward secret (`apps/web/worker/api-forward.ts`, `filterForwardedHeaders` in `apps/api/src/forward-secret.ts`). It needs no model: each request is judged alone, by comparing one header with the server's secret, with no state kept between requests, so no order of steps can break it. `apps/api/src/forward-secret.test.ts` covers it: a matching secret keeps the visitor headers, a missing or wrong one drops them, and the health route needs none. One case is by design and worth knowing: with no secret set on the server, it trusts the visitor headers from anyone.

Sync: `8eef931306bc47b21b66b33dc5d7dc14634b9f4f`.

## owner

Only a deck's owner acts on it through a tool call.

- `OnlyOwnerActs`: an accepted tool call acts as the account its credential belongs to, the grant's principal for a token and the session's account for a cookie, whatever account the caller claims, and that account owns the deck. Harm: one account edits another's deck.

Bounds: two accounts, two decks and one deck not yet made, grant generations up to 2. Run: `pnpm check:specs owner`. Replay: `apps/api/src/owner.test.ts` through `POST /mcp` and the OAuth routes. Code: `deckAccess` in `apps/api/src/saved.ts`, `prepare` in `serveMcp` in `apps/api/src/mcp.ts`, `bearerPrincipal` in `apps/api/src/tokens.ts`.

Sync: `8eef931306bc47b21b66b33dc5d7dc14634b9f4f`.

## slide-run

An agent run r that added a slide, an agent call (add_slide or read_deck) and the agent's stop_run of r as two MCP requests whose steps interleave. Each request is admitted once, then `settledCall` in `packages/mcp/src/server.ts` runs up to `commitTries` (three) tries. Each try loads the turn row (`turns.load`), reads the deck (`readSaved`) and decides (`callTool`), and `commitEdit` writes the deck only if `deck.saved` still has the revision that try read (`writeRevision`). A write lost to another one goes back to load the turn and read the deck again. After the tries the request saves the turn row once (`settleTurn`, `storedTurns` upsert), and `createServer` answers only after that save (`turnSaved`), so the answer is the request's last step. `element` says whether r also holds an element, and `ended` whether the deck records r ended. stop_run of r writes that record (`endSlides` in `packages/engine/src/call.ts`), so a stop always changes the deck. `runFenced` treats r as over once the deck records it ended or r holds an element and has none running: `liveTurn` then does not take r as the turn's run, so a slide call adds under the caller's own run, and `agentSlide`'s `runFence` refuses r `run-fenced`.

- `SlideOnRead`: a slide of r lands only on the revision the agent read. Harm if broken: an agent adds a slide to a deck it did not see.
- `WritesOnRead`: every write lands on the revision its own try read, so a retried call is judged on the deck as it is after the write it lost to. Harm if broken: a retry writes over the edit it lost to.
- `AppliesOnce`: a call changes the deck at most once, however many tries it took. Two guards keep it: the loop ends on a landed write, and a re-run of the same add_slide on the fresh deck is refused stale by `agentSlide`'s base check. TLC fails it only when both are broken.
- `CountsOnce`: a call counts as one tool call, however many tries it took. The replay checks it against the `tool` events in `session.caller_log`.
- `TurnNeverOlder`: a saved turn row never replaces one with a newer revision.
- `StopFences`: no slide of r lands once its Stop took effect. Harm if broken: after Stop answered, the agent's slide still lands.
- `StopFencesHeldRun`: the same for a run that holds an element. `StopFences` implies it; it stays as the check `19e91f75` added.
- `NoTurnWhileRunning`: a turn row that names no run is saved only after r's element stopped. So `slideTool`'s two branches for a live run with no live turn, joining it through `heldRun` and stopping it on a fresh base, are never taken here; the idle window, which this model leaves out, is how a real call reaches it.
- `TurnStaysEnded`: after stop_run of r answered ok, the turn row no longer names r. Harm if broken: the stopped run is live again, so the agent's next calls join it.

What the retry changes here: an add_slide that loses its write to the stop tries again, reads the stopped deck, and is refused stale, because its `base` no longer matches. A stop_run that loses its write to the agent's slide tries again on the fresh turn and deck and lands; before PR 391 it was refused stale. Neither fixes or opens a bug.

Bounds: one run r, one stop request, at most two agent calls, one element, `Tries = 3`. 420 states. Under these bounds the agent loses at most once and the stop at most twice, so the third-try refusal is not reached; `packages/mcp/src/server-commit.test.ts` covers it. Run: `pnpm check:specs slide-run`. Replay: `apps/api/src/slide-run.test.ts` drives every edge through the real `serveMcp`, on the test's own Postgres. `mcpSteps` in `apps/api/src/mcp-steps.ts` serves each request with its own pools that pause before each turn load, deck read, deck write and turn save, so a model step is one statement; the deck read inside `commitEdit` after a lost write is not a step. The replay sees a request end when `serveMcp` returns, so it cannot tell an answer sent before the turn save from one sent after; `packages/mcp/src/server-commit.test.ts` checks that order. The request's pause point is its pc, so the replay checks where the code is, not only what it wrote. The test also checks that the graph holds a retried agent call and a retried stop. Code: `settledCall` and `createServer` in `packages/mcp/src/server.ts`, `slideTool` in `packages/mcp/src/slide-tool.ts`, `agentSlide`, `runFence` and `runFenced` in `packages/engine/src/agent-slides.ts`, `stopRun` in `packages/mcp/src/call-tool.ts`, `endOnTouched` and `endSlides` in `packages/engine/src/call.ts`, `settleTurn`, `liveTurn` and `heldRun` in `packages/mcp/src/turn.ts`, `storedTurns` in `apps/api/src/agent-turn.ts`, `serveMcp` and `commitEdit` in `apps/api/src/mcp.ts`. Leaves out: the idle window (turns stay live), the limits beyond counting a call once, the `indexing` refusal and its refund (the deck is fully indexed), the other three slide tools (they share `agentSlide`), and Aira's own loop. `mcpSteps` finds its pause points by the SQL text in `saved.ts` and `agent-turn.ts`; if that text changes, change `gateOf` there.

Fixed bugs. From `30244817`: stop_run of a run that only added slides answered ok and changed nothing in the deck, so an add_slide that read the turn and the deck before the stop landed under the stopped run. The stop now writes r ended, so that add loses its write, retries on the new revision and is refused stale, and a later call starts a new run. `apps/api/src/slide-run-stop.test.ts` replays it. From `50489172`: the turn upsert replaces a row of the same revision, so an add's turn save at the stop's revision wrote r back. Two writes never share a revision, and a stop of r that changes nothing finds r already ended, so no slide of r can have landed at its revision: the save of a raced add now always carries an older revision than the stop's, and the upsert keeps the stop's row. The second test in `slide-run-stop.test.ts` replays it with the upsert unchanged, and `TurnStaysEnded` holds under `Saves` as it is. `19e91f75` had fenced a run that holds an element; `StopFencesHeldRun` checks that case.

Planted faults that the replay catches: stop_run of a run with no element not writing it ended, `runFenced` not reading the record, and `liveTurn` taking a fenced run as the turn's run.

One open turn per deck per account holds by the table's primary key `(email, deck)`. A person's protection lives in the deck's register, and every write to it is a compare-and-swap on `deck.saved.revision`, so a call on another server decides on the deck it read or does not land. edit and this replay cover that.

Sync: the commit that added the `ended` record, on `feb5fd65`.

## slide-undo

A person's run Undo of agent run r after r added a slide, with the agent still calling, one request at a time.

- `UndoAllOrNothing`: an Undo takes back every slide of r that shows, or none. Harm if broken: Undo leaves half of an agent's slide edit.
- `RefusedChangesNothing`: a refused Undo leaves the deck as it was.
- `UndoFences`: no slide of r lands once its Undo landed. Harm if broken: a slide the agent adds after Undo can never be undone with the run.
- `UndoReachesEverySlide`: a slide of r that shows and that no person moved can be taken back by run Undo.

run Undo of r writes r ended in the deck (`ended`), as stop_run does. The turn row still names r, but `liveTurn` no longer takes it as the turn's run, so the agent's next slide lands under a new run, which its own run Undo takes back (the last test in the replay file).

Bounds: two agent slide calls, one stop, one person move, two Undo tries. 62 states. Run: `pnpm check:specs slide-undo`. Replay: `apps/api/src/slide-undo.test.ts` drives every edge through `undoRun` in `apps/api/src/undo.ts`, `commitEdits` in `apps/api/src/saved.ts` for the person's move, and whole `serveMcp` calls through `mcpSteps` in `apps/api/src/mcp-steps.ts`, on Postgres. Requests here run one after another, so PR 391's retry never fires: no write lands between a call's read and its write. Code: `undoSlides` and `undoOf` in `packages/document/src/person-undo.ts`, `undoRun` and `endSlides` in `packages/engine/src/call.ts`, `runFenced` in `packages/engine/src/agent-slides.ts`, `liveTurn` in `packages/mcp/src/turn.ts`. Leaves out: interleaving inside a request (slide-run has it), a person's own undo of the move, elements of r.

Fixed bug, from `30244817`: run Undo left the turn naming r, and `runFence` passed a run that holds no element, so the agent's next slide landed under the undone run, and every later run Undo of r was refused. Planted faults that the replay catches: run Undo not writing r ended, and `liveTurn` taking a fenced run as the turn's run.

Sync: the commit that added the `ended` record, on `feb5fd65`.
