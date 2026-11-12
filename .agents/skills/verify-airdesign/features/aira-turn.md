# Ask Aira through the server

The browser asks Aira one model call at a time. Each call goes to `airaRoutes.turn`, which checks the session, the country and the conversation, reserves the turn's ceiling on the weekly ledger, streams the model's text and tool calls back as NDJSON lines, and settles the turn. The browser runs each tool call through `/mcp` with the session cookie, the same tools and limits an outside agent gets, and sends the results back in the next call. `deckRoutes.undo` takes back the run those edits made.

## Sub-features

- `turn` a call answers `application/x-ndjson`: one `{type:"text"}` line per text piece, one `{type:"tool"}` line per finished tool call, and an `{type:"end"}` line with `stop`, the reply `content` to send back, and the week's `usage`.
- `refused` a refusal before the model is called answers JSON: 401 with no session, 403 `off` or `country`, 400 `body`, 429 `rate`, 409 `open` while another turn of the account runs, 402 `allowance` with `usage`.
- `tools` the tool call runs through `mcpRoutes.mcp` as `tools/call` with the session cookie, and its edit answer carries the `runId`.
- `next` the next call carries the reply content and the tool results, and the ledger charges each call.
- `undo` `deckRoutes.undo` with the deck and the `runId` writes one revision that takes back every element of the run. A second undo of the same run is refused `run-fenced`.

## How to get to it (user POV)

- The Agent panel in an open deck sends these calls. See [aira-panel.md](./aira-panel.md). This journey drives them over HTTP.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.
- The stack's model is a stand-in: `bin/scripted-aira.mjs` plays the recorded streams in `apps/api/src/aira-streams/`. A journey picks them with `kit.aira([{ name, fill }])`, one per model call, the last one repeating. `fill` writes each value where the stream says `@name@`.
- The front server adds `cf-ipcountry: US` when the request has none, as Cloudflare does.

- **Run it.** `$V journey <run> aira-turn`. Prints `"passed":true` and the evidence dir.
- **Import.** Home's file input takes `clean.pptx`. Evidence `NN-imported`.
- **First call.** `post(airaRoutes.turn, { deck, messages })` with `edit.sse` filled with the deck, its revision and `256.2`. Four lines: two text pieces, one `airdesign_edit_deck` call, and the end line with `stop: "tool_use"`.
- **Tool call.** `post(mcpRoutes.mcp, tools/call)` with the session cookie and `accept: application/json, text/event-stream`. The answer carries `ok`, the next revision and a `runId`.
- **Next call.** The conversation plus the reply content and the tool result. The end line says `stop: "end_turn"` and more usage.
- **Server copy.** `deckRoutes.open` reads `Hello from Aira`. The open editor paints it without a reload: it watches the deck and repaints what changed. Evidence `NN-aira-edited`.
- **Undo.** `post(deckRoutes.undo, { deck, runId })` answers the next revision. The open editor reads `Hello` again in the same page load. Evidence `NN-undone`. The same undo again is refused `run-fenced`.

## Gotchas

- `kit.post` reads an NDJSON answer into `json.lines` and an event stream into `json.events`.
- A run's undo is the person's call. An agent cannot undo through `/mcp`.
- Every call of the scripted model is charged with the counts its stream reports, so the week's usage moves as it would in production.
