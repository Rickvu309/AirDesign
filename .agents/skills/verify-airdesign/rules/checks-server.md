# Checks on agents, Aira stop, the Aira loop, usage, OAuth and deck ownership

Same fields as [checks-doom.md](checks-doom.md). The `apps/api` tests start the real API on their own Postgres database: `pnpm vitest run apps/api/src/agents.test.ts apps/api/src/aira/aira-closing.test.ts apps/api/src/owner.test.ts`.

## agents

Two agents of one account edit one deck. The server names the agent from the credential, never from the call: `caller` in `apps/api/src/server.ts` keys a bearer token by its grant and the cookie, which is Aira's, by the account, through `agentKey` in `apps/api/src/oauth/agent-key.ts` (`bearerPrincipal` in `apps/api/src/oauth/tokens.ts` answers the grant). `mcpRoute` mints each call's once as `<agent key>-<uuid>`. `editDeckTool` in `packages/mcp/src/edit-tool.ts` writes with the agent key as the edit's author and, for a call without `runId`, starts a run named from its once (`onceIds` in `packages/mcp/src/once-ids.ts`).

A run is its agent's: `guardRun` in `packages/doom/src/apply-edit.ts` records the agent of a start edit as the run's `agent` and takes a write or a stop into the run only from that agent, and `stopRunTool` answers `run-fenced` for another agent's run before it lands anything.

- `NoSilentOverwrite`: an agent's edit never replaces another agent's write that it had not read. Harm: an agent's change is lost with no refusal, and no one is told. The code: each agent write of a `base` prop (text, notes, lists) carries the rev the agent read (`readingOf` in `packages/doom/src/agent-edit.ts`, capped at the call's `base`), and `applyEdit` refuses it `stale` when the property was written after that rev. x is such a prop; a last-writer prop, such as a name or a box, has no such promise.
- `RunsAreOwn`: a run holds the writes of one agent only, so undoing it takes back only that agent's work. `guardRun` refuses another agent's write `run-fenced`.
- `StopsOnlyOwn`: an agent's stop never ends another agent's run. `stopRunTool` and `guardRun` refuse it `run-fenced`.
- `OneRunEach`: an agent has at most one running run per deck. A start edit stops the agent's own running runs in the same edit (`guardRun`), so a run the agent never stopped ends at its next start.

The model used to hold an element for an agent's live turn (`HeldOnlyWhileLive`, the `held` refusal and the ten-minute idle window). The Doom deck holds no element for an agent and has no idle window, so the model dropped them; a person's change still closes a layer to a run, which doom-runs models.

Bounds: agents a and b, one text x, two runs each, `MaxVer = 3`. 481 states. Run: `pnpm check:specs agents`. Replay: `tests/agents-replay.test.ts` takes every edge from the start through the real `callTool` of `packages/mcp` (`read_deck`, `edit_deck`, `stop_run`) on an in-memory deck, with each agent's key as the session's agent, and names another agent's run in every edit and stop it may. Planted faults: `guardRun` that takes any running run fails `RunsAreOwn` in TLC (35 states) and the replay with `stale` where the model says `run-fenced`; `stopRunTool` without its owner check fails `StopsOnlyOwn` (10 states) and the replay with `already`; a start that leaves the agent's other runs running fails `OneRunEach` (4 states) and the replay with a run still running. `apps/api/src/agents.test.ts` drives two grants, and Aira with a grant, on one deck through `POST /mcp` on Postgres: each agent gets its own run, stopping one leaves the other running, a write to a stopped run is refused `run-fenced`, and a person's change to a layer refuses both runs `person-protected`. It also holds the call limits per agent and per account (`admit` in `packages/mcp/src/admit.ts`).

Leaves out: one agent running two prompts at once. The agent is the credential, so a second start by the same key stops the first run, and the first's next write is fenced; Aira runs one turn per deck today.

Sync: `specs/agents/covers.json`.

## turn

A turn is one agent's time on a deck: it starts with the agent's first edit or slide call there and ends with a stop of its run or the idle window. A person's edit on an element the turn holds closes that element to the turn's writes until the turn ends.

- `ClosedUntilTurnEnds`, `RefusalKeepsTurn`, `TurnKeepsItsRuns`: no code holds these on a Doom deck. `editDeckTool` in `packages/mcp/src/edit-tool.ts` starts a run for any call without `runId`, and `protect` in `packages/doom/src/apply-edit.ts` guards a node for the runs running when the person writes, not for the agent's turn. A start stops the same agent's running run (`guardRun`), so two calls of one agent sent without `runId` at the same time end the first call's run, and its next write is fenced: the opposite of `TurnKeepsItsRuns`. On a Doom deck the run is the agent's turn, and specs/agents holds it.

Bounds: one agent, two elements. 160 states. Run: `pnpm check:specs turn`. Replay: none, and `unreplayed` in `scripts/spec-replays.mjs` says why.

Sync: `specs/turn/covers.json`.

## stop

One Aira ask runs its model call on server A while a person stops it from server B, leaves, or both. The `session.aira_ask` row in Postgres is the only shared state.

- `ChargedOnce`: an ask is charged at most once. Harm: a person pays twice.
- `ChargedOnlyIfSent`: an ask is charged only when A sent its model call. Harm: a person pays for a call that never ran.
- `SentOnlyWhileLive`: A sends the model call only while the ask's row is live. A stop that marked the row first, from any server, keeps the model from being called, even while A's wake is late. Harm: the model runs and is charged after the person stopped it. Until A read the row just before the call, A decided on its own abort signal alone. TLC fails that model in three steps: Follow, StopSent (B marks the row, A's wake not yet taken), Send.
- `StopBeforeAskIsHeeded`: a stop that reached a server before any server followed the ask, and so was answered at once, still keeps the model from being called. Harm: a person who pressed Stop pays for the ask. Until the stop left a note, a stop that found no row changed nothing, and TLC failed it in three steps: StopSent, Follow, Send.
- `RowOutlivesCall`: the ask row is forgotten only after the model call closed.
- `AnsweredAfterClose`: a stop that found the row and did not time out is answered only after the call closed. It used to add "and was charged": a call skipped before its send now closes uncharged.
- `OneOpenTurn`: a next ask is reserved only after the earlier call closed.
- `StopIsNotLost`, `StopIsAnswered`, `NextAskIsAnswered`: a stop reaches the call even if a wake is dropped, and every waiting stop or next ask gets an answer. These are liveness properties under the fairness in `Spec`.

Bounds: one ask, one stop, one next ask, a listen connection that can drop and reconnect. The stop and the follow write the same row, so neither can miss the other: migration 16 made `session.aira_ask (email, ask)` unique. `StopSent` with no row writes a note, the row stopped with `followed` false, and answers at once. `Follow` on a note takes it over, sets `followed` and starts stopped. `Follow` is the follow and the reserve; `Send` and `Skip` are the read of the row just before the model call. `Mark` happens while A's call is still open: a mark that lands after the close changes nothing the properties read. Run: `pnpm check:specs stop`. Replay: `apps/api/src/aira/aira-closing.test.ts` drives two `Closing` instances from `apps/api/src/aira/aira-closing.ts`, each on its own listen connection, against the real rows. `Send` and `Skip` call the real `stopped` that `follow` returns, and one trace holds A's wake read with `heldQueries` from `apps/api/src/testing/held-queries.ts`. Another holds B's look at the ask rows until A forgot its ask. Three traces send the stop before the follow, from B and from A itself, one with a next ask on B; the replay reads the row by (email, ask) and tells a note by `followed`. Beside the replay, `closed` never waits on a note whose ask never comes, and a follow that takes over a row a model turn of the same ask has not forgotten yet gives it a new id, so that turn's forget leaves the next turn's row. `NextAsk` is the reserve that found the turn open and that look as one step, which is sound only because `closed` decides how long B waits and B then always reserves again. `apps/api/src/aira-stop-order.test.ts` holds a real ask at each point through the real routes: before its follow, where the stop leaves a note and the ask is released uncharged, at the reserve, at the read before the model call, and in the model call, with the stop sent to the same server or to another one. `apps/api/src/aira-stop.test.ts` waits until the ask row is stopped before it releases the account lock on a turn the person left. Code: `Closing`, and `reserveTurn`, `answered`, `settleTurn` and `releaseTurn` in `apps/api/src/aira/aira.ts`. Leaves out: a stop after the ask's row was forgotten, which writes a note too; only a later model turn of the same ask would read it, and the browser sends none after a stop. A note ends with its account, or once it is 15 minutes old, at the account's next follow, as a row a dead server left does. Plants: deciding on the abort signal alone fails `SentOnlyWhileLive` in TLC, the late-wake replay on `Skip`, and the late-wake test in `aira-stop-order.test.ts`. Answering the new ask from B's look, as `closed` did before it only waited, fails the held-look trace with `next` refused. A follow that ignores a note fails `StopBeforeAskIsHeeded` in TLC in three steps, the early-stop traces, and the before-follow test in `aira-stop-order.test.ts`. `closed` that waits on a note fails its test by timeout, and a takeover that keeps the row's id fails the next-turn test.

Sync: `specs/stop/covers.json`.

## aira-loop

One Aira ask in the browser asks for one edit while the person may press Stop and then ask again, or the model's next turn fails and the person presses Try again. `askAira` is the only actor; the server is the edit landing, the edit's once that Stop spends, and the answers it sends.

- `StoppedRunUndoable`: a stopped ask's run ends on the server however late its write would land: the edit lands before the Stop spent its once or never, and once the ask resolved, an edit that landed is in the exchange's runs, which offers Undo as one step, and its run is stopped. Harm: a person keeps a change they tried to stop, with no Undo, and the run stays live. Until the once, it held only for an edit that answered within a 10 s wait; TLC fails the new wording on that model in three steps: Stop, the wait ends, the edit lands.
- `KnownRunClosed`: a run the exchange holds is stopped with stop_run before the ask resolves.
- `NextAskAfterClose`: a next ask's turn is sent only after the stopped ask resolved, so its edits never join the stopped run.
- `NextAskKeepsUndo`: the chat a next ask sends with still holds the stopped run, so Undo stays offered.
- `RetryInPlace`: Try again retries the failed request in place, so its chat shows that one request and its run, not a copy of the request and its error.

Bounds: one edit call, one Stop, one next ask or one Try again after a failed next turn (`Fail`, `Retry`). The edit call carries its once, `<ask>-<call number>`, as `app.airdesign/once` in the request's `_meta`. Stop cuts a waiting edit call at once, and the stop then names the cut call's deck and once (`Spend`): `spendOnce` lands an empty edit under that once, by `airdesign`, unless the once already landed, and answers the run the call's edit landed in. Both edits write the deck's `(deck, once)` edit row, which is unique, so whichever comes first wins and the other finds it: the late call lands nothing (`landEdit` passes over a known once), and the stop answers no run. Run: `pnpm check:specs aira-loop`. Replay: `tests/aira-loop-replay.test.ts` drives every edge through the real `askAira` with a scripted `fetch`, and checks that the stop names the once the edit carried, and that a Try again sends the model only the tool answer it waits for (`retryAira`). `apps/api/src/aira-stop.test.ts` drives the stop route through the real `serveMcp` on Postgres: a stop answers the run its call's once landed and spends nothing then, answers no run for a call that had not landed or for another account's deck, and a call that arrives after its stop lands no run and no layer. Code: `askAira`, `retryAira`, `converse`, `callTool`, `stopAsk`, `continues`, `landedIn` and `closeRuns` in `apps/web/src/aira/aira-loop.ts`; the panel's `run` in `apps/web/src/aira/aira-panel.tsx`, which drops a superseded ask's updates and keeps New chat, history and Undo off until the ask resolved; the stop route in `apps/api/src/aira/aira-route.ts`; `spendOnce` in `apps/api/src/doom/doom-deck.ts`; `serveMcp` in `apps/api/src/mcp/mcp.ts`, and `createServer` in `packages/mcp/src/server.ts`, which reads the once from the call's `_meta` (`readOnce`). Leaves out: a stop that never reaches the server, after which the cut call may still land and its run stays live; a refused or failed edit, which writes no run; a read, whose fetch Stop cuts at once. Plants: the browser leaving the cut call out of its stop fails the replay on `settled`; the browser keeping the edit's fetch after Stop fails it on `answer`; a `Land` on a spent once fails `StoppedRunUndoable` in three steps (Stop, Spend, Land); a Try again that sends the request's words again after the tool answer fails the replay on the retried turn.

Sync: `specs/aira-loop/covers.json`.

## usage

The weekly Claude spend ledger and its hold for an open turn.

- `HoldTracksTurn`: a hold exists exactly while a turn is open.
- `WithinAllowance`: spend plus hold never passes the allowance. Harm: the account spends past its week.
- `StoppedWithinReserve`: a stopped call is charged no more than its hold.
- `ChargedOnlyWhileOpen`: nothing is charged with no open turn.

Bounds: one account, one turn, the holds named in `Usage.tla`, two weeks. Run: `pnpm check:specs usage`. Replay: `tests/usage-replay.ts` through `usage` in `packages/usage/src/index.ts`. Leaves out: the read-only usage route's `available` answer in `apps/api/src/aira/aira-usage-route.ts`.

Sync: `specs/usage/covers.json`.

## oauth

One OAuth grant: code exchange, calls, refresh rotation and revocation.

- `CodeWorksOnce`: an authorization code is exchanged once.
- `RotatedRefreshIsDead`: a rotated refresh token never works again.
- `ReuseRevokesFamily`: reusing a rotated token revokes the whole grant. Harm: a stolen token keeps working.
- `AfterRevocation`: after revocation no call or rotation is accepted.
- `IdentityIsStored`: every accepted call acts as the stored principal.

Bounds: one grant, generations up to 2, two exchanges. Run: `pnpm check:specs oauth`. Replay: `tests/oauth-replay.ts` through `oauth` in `packages/oauth/src/index.ts`. Its callers are `apps/api/src/oauth/grants.ts` and `apps/api/src/oauth/tokens.ts`. Leaves out: the web Worker's forward secret (`apps/web/worker/api-forward.ts`, `filterForwardedHeaders` in `apps/api/src/platform/forward-secret.ts`). It needs no model: each request is judged alone, by comparing one header with the server's secret, with no state kept between requests, so no order of steps can break it. `apps/api/src/platform/forward-secret.test.ts` covers it: a matching secret keeps the visitor headers, a missing or wrong one drops them, and the health route needs none. One case is by design and worth knowing: with no secret set on the server, it trusts the visitor headers from anyone.

Sync: `specs/oauth/covers.json`.

## owner

Only a deck's owner acts on it through a tool call.

- `OnlyOwnerActs`: an accepted tool call acts as the account its credential belongs to, the grant's principal for a token and the session's account for a cookie, whatever account the caller claims, and that account owns the deck. Harm: one account edits another's deck.

Bounds: two accounts, two decks and one deck not yet made, grant generations up to 2. Run: `pnpm check:specs owner`. Replay: `apps/api/src/owner.test.ts` through `POST /mcp` and the OAuth routes. Code: `caller` in `apps/api/src/server.ts`, `serveMcp` in `apps/api/src/mcp/mcp.ts`, which opens the decks of the account `caller` named, `bearerPrincipal` in `apps/api/src/oauth/tokens.ts`, and the owner check of each Doom deck read and write in `apps/api/src/doom/doom-deck.ts`. The agent key that `bearerPrincipal`'s grant names keys an edit's author and the limits, never the account a call acts as.

Sync: `specs/owner/covers.json`.
