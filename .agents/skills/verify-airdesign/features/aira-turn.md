# Ask Aira through the server

The browser asks Aira one model call at a time. Each call goes to `airaRoutes.turn`, which checks the session, the country and the conversation, reserves the turn's ceiling on the weekly ledger, streams the model's text and tool calls back as NDJSON lines, and settles the turn. The browser runs each tool call through `/mcp` with the session cookie, the same tools and limits an outside agent gets, and sends the results back in the next call. `deckRoutes.undo` takes back the run those edits made.

## Sub-features

- `turn` a call answers `application/x-ndjson`: one `{type:"text"}` line per text piece, one `{type:"tool"}` line per finished tool call, and an `{type:"end"}` line with `stop`, the reply `content` to send back, and the week's `usage`.
- `refused` a refusal before the model is called answers JSON: 401 with no session, 403 `off` or `country`, 400 `body`, 429 `rate` with `text`, 409 `open` with `usage` while another turn of the account runs (after waiting up to 5 s for a stopped turn to close), 402 `allowance` with `usage`.
- `stop` `airaRoutes.stop` with `{ ask }` marks that ask stopped in Postgres and notifies every server, so the one running the turn ends its model call; it answers 200, and 400 `body` for an ask that is not an id. A stopped call is charged as `dropped`. A turn may carry `ask`, the id the browser minted. A call that fails ends with `{type:"end", ok:false, refusal:"dropped"|"unavailable"}`.
- `limits` the 20-turns-in-5-minutes limit, the 30-calls-in-5-minutes `/mcp` limit and the agent's turn per deck are kept in Postgres, so two servers on one database share them.
- `slide-tools` `airdesign_add_slide`, `airdesign_duplicate_slide`, `airdesign_delete_slide` and `airdesign_move_slide` answer `{ok, revision, runId, elements, slide?}`, and run undo takes their slide rows back too. `airdesign_add_text_box` answers with the new element in `elements` and `airdesign_delete_element` with none; run undo removes an added box and brings back a deleted element, all or nothing, and refuses when a person changed that element since.
- `tools` the tool call runs through `mcpRoutes.mcp` as `tools/call` with the session cookie, and its edit answer carries the `runId`.
- `next` the next call carries the reply content and the tool results, and the ledger charges each call.
- `undo` `deckRoutes.undo` with the deck and the `runId` writes one revision that takes back every element and slide change of the run. A second undo of the same run is refused `run-fenced`.

## How to get to it (user POV)

- The Agent panel in an open deck sends these calls. See [aira-panel.md](./aira-panel.md). This journey drives them over HTTP.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.
- The stack's model is a stand-in: `bin/scripted-aira.mjs` plays the recorded streams in `apps/api/src/aira-streams/`. A journey picks them with `kit.aira([{ name, fill }])`, one per model call, the last one repeating. `fill` writes each value where the stream says `@name@`.
- The front server adds `visitor-country: US` (`countryHeader` in the catalog) when the request has none, as the web worker does from Cloudflare's `request.cf.country`. Unlike the worker, it keeps a value the client sends, so `post(route, body, cookie, { [countryHeader]: "CN" })` drives the 403 `country` refusal. It sends no forward secret and the API is started without one, so the forward-secret check (`apps/api/src/forward-secret.ts`) is not exercised here.

- **Run it.** `$V journey <run> aira-turn`. Prints `"passed":true` and the evidence dir.
- **Import.** Home's file input takes `clean.pptx`. Evidence `NN-imported`.
- **First call.** `post(airaRoutes.turn, { deck, messages })` with `edit.sse` filled with the deck, its revision and `256.2`. Four lines: two text pieces, one `airdesign_edit_deck` call, and the end line with `stop: "tool_use"`.
- **Tool call.** `post(mcpRoutes.mcp, tools/call)` with the session cookie and `accept: application/json, text/event-stream`. The answer carries `ok`, the next revision and a `runId`.
- **Next call.** The conversation plus the reply content and the tool result. The end line says `stop: "end_turn"` and more usage.
- **Server copy.** `deckRoutes.open` reads `Hello from Aira`. The open editor paints it without a reload: it watches the deck and repaints what changed. Evidence `NN-aira-edited`.
- **Stop, country, slide tools.** `aira-head` posts `airaRoutes.stop` and a `CN` turn; `aira-slides` drives `airdesign_add_slide` and its undo from the panel.
- **Undo.** `post(deckRoutes.undo, { deck, runId })` answers the next revision. The open editor reads `Hello` again in the same page load. Evidence `NN-undone`. The same undo again is refused `run-fenced`.

## Gotchas

- `kit.post` reads an NDJSON answer into `json.lines` and an event stream into `json.events`.
- A run's undo is the person's call. An agent cannot undo through `/mcp`.
- Every call of the scripted model is charged with the counts its stream reports, so the week's usage moves as it would in production.
