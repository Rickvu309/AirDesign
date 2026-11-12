# Ask Aira in the Agent panel

An open deck shows the Agent panel on the right. The person types to Aira, watches the reply stream in, sees each tool call Aira makes, and watches the slide change without a reload. The person can stop a run, undo a finished run, try a failed ask again, go back to earlier chats on this device, read the week's usage, and sees when the week's usage has run out or Aira is not offered where they are.

## Sub-features

- `empty` before the first ask the panel shows the Aira mark, `Aira`, the line `Aira can add, duplicate, delete and reorder slides, rewrite text, and move or resize elements.`, four starters that each send in one click, and the caution `Aira can be wrong. Check a number, a quote, or a slide before you rely on it.` The head reads `New chat`; its `button "New chat"` (use `exact: true`, the history trigger's name also holds the words) is disabled until there is an ask.
- `ask` the composer reads `Ask Aira`. Enter sends; Shift+Enter starts a new line. The ask shows as the person's message and becomes the chat title.
- `stream` Aira's words show as they arrive, and the thread follows them while the person is at the latest message. Scrolling up stops the following; the round arrow button, `Show latest message`, brings it back.
- `steps` tool calls show in plain words, never the tool's id: a running step reads like `Editing slides`, a finished one `Edited slides`, a refused one `Couldn't edit slides`, a stopped one `Stopped editing slides`. Each step carries `[data-step-mark]`: `progress` (spinning), `check`, or `x`. Steps taken one after another sum up in one line, such as `Read the deck and edited slides`, that opens to each step.
- `working` while a run works the composer reads `Add to your request` and shows `Stop`. Text sent then goes with the next model call, or starts the next run when this one ends first.
- `live` Aira's edits land through `/mcp` and the slide, its thumbnail and the server copy change in the same page load.
- `undo` a finished run with an edit shows `Undo`. It takes back every run of that ask through `deckRoutes.undo`, slides Aira added, duplicated, deleted or moved included. When the slides changed after Aira's edit it says `Couldn't undo. These slides changed after Aira's edit.`
- `stop` `Stop` ends the run: it aborts a tool call still waiting for its answer, marks that step `Stopped editing slides`, sends no further call and does not ask the model again. A call the server already received may still land; the browser does not wait to find out. Known failure: when it lands, the slide shows Aira's edit under `Stopped editing slides` with no `Undo`, and the run stays live on the server until the idle window ends (journey `agent-after-open`, pinned in `tests/browser/aira-panel.spec.ts`). Stop during the model's reply also posts `airaRoutes.stop` with the ask id, so the server running the turn ends it, even on another server.
- `retry` the last failed ask offers `Try again`, which sends it again.
- `history` the head's trigger, named `<chat title>, chat history`, opens `Chats on this deck`. With none it says `Your chats with Aira on this deck show here.` and `This device keeps your last 20 chats.` Chats are kept on the device: a reload reopens the last chat. Items are disabled while a run works.
- `new-chat` `New chat` goes back to the welcome.
- `not-offered` when `airaRoutes.usage` says Aira is not available, the welcome reads `Aira isn't available in your country or region yet.` with no starters, and the composer is disabled under that name. A 403 `country` from a turn shows the same words and `You can keep editing this deck yourself.`
- `failed` a run the model could not finish shows `Unable to finish your request`. When the run edited the deck it says `Aira's reply didn't come through. Its changes so far are kept. Try again, or undo them.` with `Undo`; otherwise `Aira's reply didn't come through. Nothing in your deck changed. Check your connection and try again.` Both offer `Try again`.
- `indexing` an ask sent while the deck's index is still on its way keeps its step running (`Adding a slide`): Aira's loop sends a slide call refused `indexing` again, once a second, up to 15 more times, and stops early on Stop. Journey `agent-after-open`. Known failure: an ask sent the moment a new deck appears, before the editor's first `deckRoutes.open` has reached the server, is refused as an unknown deck (`This session can reach no deck with this id.`), which the loop does not retry, so the step reads `Couldn't add a slide`; pinned in `tests/browser/agent-after-open.spec.ts`.
- `usage` the ring is always in the head and loads from `airaRoutes.usage` when the panel opens. `button "Weekly usage"` opens `region "Weekly usage"` with the percent used, `Resets <when>` in the person's clock, and `link "See all usage"` to `/settings/usage`. Opening it, and the end of a stop, refresh it.
- `limit` a 402 from `airaRoutes.turn` shows `You've hit this week's limit` and `Your weekly usage resets <when>. Ask again then.`, and the composer reads `Available again <when>` until the reset.
- `switch` the toolbar's Agent and Design buttons switch the panel. The conversation stays. The Design panel is empty in the real editor for now.

## How to get to it (user POV)

- Open a deck from Home. The Agent panel is the right column.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.
- The model is the scripted stand-in (`bin/scripted-aira.mjs`). `kit.aira([...])` picks the recorded streams, one per model call.

- **Run it.** `$V journey <run> aira-panel`. Prints `"passed":true` and the evidence dir.
- **Panel.** Import `clean.pptx`; the panel shows the `Ask Aira` composer. Evidence `NN-agent-panel`, `NN-typed`.
- **Working.** Send the ask with `edit.sse` then `edited.sse`. The journey holds `/mcp` in the browser so the working state can be captured: the streamed words, the running `Editing slides` row, `Stop`. Evidence `NN-working`.
- **Done.** Release `/mcp`. The slide reads `Hello from Aira`, the reply ends, `Undo` shows, and `deckRoutes.open` agrees. Evidence `NN-done`.
- **Usage.** Open the ring. Evidence `NN-usage`.
- **Undo.** The slide reads `Hello` again in the same page load and the server agrees. Evidence `NN-undone`.
- **Failed.** Send again with `overloaded.sse`. Evidence `NN-failed`.
- **Head, stop, retry, history, not offered.** `$V journey <run> aira-head`: before any ask it opens the history menu and the usage popover; then it holds `/mcp`, clicks `Stop`, releases the call and checks the step reads `Stopped editing slides`, the title still reads `Hello` and no second reply came; then `overloaded.sse` followed by `turn.sse` behind `Try again`; then a reload that reopens the chat, `New chat`, and a `/aira/usage` answer rewritten to `available: false`. It also checks `airaRoutes.stop` and a turn sent with the country header `CN` through the API.
- **Slide tools.** `$V journey <run> aira-slides` plays `add-slide.sse` and `title-slide.sse`, checks the new slide on the canvas and the server, and undoes the run.

## Gotchas

- The 402 limit and `Stop` during the model's reply are proven in `tests/browser/aira-panel.spec.ts`, which fills the ledger and holds the scripted stream. The recorded model here cannot pause mid-reply, so the panel's own `/aira/stop` post is not reachable in this stack; `aira-head` checks the route through the API instead.
- The journeys that call `kit.aira()` share one queue of recorded streams per stack. In `tests/journeys/journeys.spec.ts` they run one after another in the `recorded Aira` group. Put a new one there, never in the parallel list.
- After `New chat` and a reload, the last chat with answers reopens, not the empty one.
- The words for each step live in `apps/web/src/copy/aira-copy.ts`.
