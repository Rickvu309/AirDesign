# Ask Aira through the server

The browser asks Aira one model call at a time. Each call goes to `airaRoutes.turn`, which checks the session, the country and the conversation, reserves the turn's ceiling on the weekly ledger, streams the model's text and tool calls back as NDJSON lines, and settles the turn. The browser runs each tool call through `/mcp` with the session cookie, the same tools and limits an outside agent gets, and sends the results back in the next call. The person's Undo takes back the run those edits made.

## Sub-features

- `turn` a call answers `application/x-ndjson`: one `{type:"text"}` line per text piece, one `{type:"tool"}` line per finished tool call, and an `{type:"end"}` line with `stop`, the reply `content` to send back, and the week's `usage`.
- `refused` a refusal before the model is called answers JSON: 401 with no session, 403 `off` or `country`, 400 `body`, 413 `size`, 429 `rate` with `text`, 409 `open` with `usage` while another turn of the account runs (after waiting up to 5 s for a stopped turn to close), 402 `allowance` with `usage`.
- `stop` `airaRoutes.stop` with `{ ask }` marks that ask stopped in Postgres and notifies every server, so the one running the turn ends its model call; it answers 200, and 400 `body` for an ask that is not an id. A stop that also names a cut edit call, `call: { deck, once }`, answers that call's `runId` when the once landed, and otherwise spends the once with an empty edit, so the call arriving after the stop lands nothing (`spendOnce` in `apps/api/src/doom/doom-deck.ts`). A stopped call is charged as `dropped`. A turn may carry `ask`, the id the browser minted. A call that fails ends with `{type:"end", ok:false, refusal:"dropped"|"unavailable"}`.
- `limits` the 20-turns-in-5-minutes limit, the 30-calls-in-5-minutes `/mcp` limit per agent and the 90-calls limit per account are kept in Postgres, so two servers on one database share them (`admit` in `apps/api/src/account/admit.ts`).
- `retry` when another edit takes the deck's next revision between the call's read and its write, `editDoom` in `apps/api/src/doom/doom-deck.ts` reads the deck again and lands the edit on it, up to eight tries; after the last loss it answers `stale`. `apps/api/src/doom-deck.test.ts` lands two edits sent at the same moment at distinct revisions; a journey cannot place the race.
- `execute` `airdesign_execute` runs one script (`packages/agent/src/execute-tool.ts`) in a QuickJS sandbox on a worker thread: each operation (`insert`, `update`, `replace`, `copy`, `move`, `remove`, `group`, `ungroup`, `variables`, `get`, `screenshot`) becomes Doom's change, read by `readIntent` in `packages/doom/src/intent-read.ts`, and compiles at once, so the script gets new ids and measured boxes. A call lands one revision or none. The script keeps the new ids its operations return, and `names` answers the id of each layer it named. A write over a property another writer changed after the call opened the deck is refused `stale`, and a write to a layer a person changed during the run `person-protected`. Aira and outside agents use this same tool.
- `tools` the tool call runs through `mcpRoutes.mcp` as `tools/call` with the session cookie, and its edit answer carries the `runId`.
- `next` the next call carries the reply content and the tool results, and the ledger charges each call.
- `undo` the browser takes back a run: `doomRoutes.run` with the deck and the `runId` answers the run's edits and, beside each, the value and revision each of its writes replaced (`runDoom` in `apps/api/src/doom/doom-deck.ts`, stored in `deck.doom_edit.replaced`). `undoRun` in `packages/live/src/doom-deck.ts` walks them newest first with `invertRun` and lands what each write replaced as the person's edit, leaving any property someone wrote since. A layer the run made that anyone changed since stays, with everything in it, and the Agent panel names it after "Aira's changes from this request are undone."

## How to get to it (user POV)

- The Agent panel in an open deck sends these calls. See [aira-panel.md](./aira-panel.md).

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.
- The stack's model is a stand-in: `../bin/scripted-aira.mjs` plays the recorded streams in `apps/api/src/testing/aira-streams/`. A journey picks them with `kit.aira([{ name, fill }])`, one per model call, the last one repeating. `fill` writes each value where the stream says `@name@`.
- The front server adds `visitor-country: US` (`countryHeader` in the catalog) when the request has none, as the web worker does from Cloudflare's `request.cf.country`. Unlike the worker, it keeps a value the client sends, so `post(route, body, cookie, { [countryHeader]: "CN" })` drives the 403 `country` refusal. It sends no forward secret and the API is started without one, so the forward-secret check (`apps/api/src/platform/forward-secret.ts`) is not exercised here.

- **In the browser.** `$V journey <run> aira-panel` sends a turn, its `airdesign_execute` call through `/mcp` and the next turn from the panel. `tests/browser/editor-agent.spec.ts` adds the run's Undo and a Stop before the edit lands.
- **Over HTTP.** A scratch journey: open a new Doom deck at `/s` and read its revision and first slide with `post(doomRoutes.open, { deck })`. Then `post(airaRoutes.turn, { deck, messages })` with `add-results-grid.sse` filled with `deck` and `slide`: text pieces, one `airdesign_execute` call, and the end line with `stop: "tool_use"`. Post that call to `mcpRoutes.mcp` as `tools/call` with the session cookie and `accept: application/json, text/event-stream`; the answer carries `ok`, the next revision and a `runId`. The next turn, with `added-results-grid.sse`, carries the reply content and the tool result and ends `stop: "end_turn"`. `doomRoutes.open` then shows the results grid.
- **Refusals, stop and the ledger.** `apps/api/src/aira.test.ts` holds every refusal, the next turn and the weekly charge; `apps/api/src/aira-stop.test.ts` and `apps/api/src/aira-stop-order.test.ts` hold the stop.

## Gotchas

- `kit.post` reads an NDJSON answer into `json.lines` and an event stream into `json.events`.
- A run's undo is the person's. An agent stops its run with `airdesign_stop_run` and cannot undo it through `/mcp`.
- Every call of the scripted model is charged with the counts its stream reports, so the week's usage moves as it would in production.
