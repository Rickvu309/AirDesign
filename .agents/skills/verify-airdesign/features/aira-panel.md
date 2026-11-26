# Ask Aira in the Agent panel

An open deck shows the Agent panel on the right. The person types to Aira, watches the reply stream in, sees each tool call Aira makes, and watches the slide change without a reload. The person can stop a run, undo a finished run, try a failed ask again, go back to earlier chats on this device, read the week's usage, and sees when the week's usage has run out or Aira is not offered where they are.

## Sub-features

- `empty` before the first ask the panel shows the Aira mark, `Aira` and one line, `Tell Aira what to change in this deck.`, with no starters and no caution (`apps/web/src/aira/aira-welcome.tsx`). The head reads `New chat`; its `button "New chat"` (use `exact: true`, the history trigger's name also holds the words) is disabled until there is an ask.
- `ask` the composer reads `Ask Aira`. Enter sends; Shift+Enter starts a new line. The ask shows as the person's message and becomes the chat title.
- `stream` Aira's words show as they arrive, and the thread follows them while the person is at the latest message. Scrolling up stops the following; the round arrow button, `Show latest message`, brings it back.
- `steps` tool calls show in plain words, never the tool's id: a running step reads like `Editing slides`, a finished one `Edited slides`, a refused one `Couldn't edit slides`, a stopped one `Stopped editing slides` (`airaStepWords` in `apps/web/src/copy/aira-copy.ts`). Each step carries `[data-step-mark]`: `progress` (spinning), `check`, or `x`. Steps taken one after another sum up in one line, such as `Read the deck and edited slides`, that opens to each step.
- `working` while a run works the composer reads `Add to your request` and shows `Stop`. Text sent then goes with the next model call, or starts the next run when this one ends first.
- `live` Aira's edits land through `/mcp` and the slide, its thumbnail and the server copy change in the same page load.
- `undo` a finished run with an edit shows `Undo`. It takes back every run of that ask, slides Aira added, moved or deleted included: `undoAgentRun` in `apps/web/src/editor/agent-undo.ts` calls `undoRun` in `packages/live/src/doom-deck.ts`, which reads the run's edits through `doomRoutes.run` and lands what each write replaced as the person. The note names any layer that stays because someone changed it after Aira made it: `“Q3 summary” stays because it was changed after Aira made it.` For existing layers it names where later changes were kept: `Later changes to “Chart” were kept.`
- `stop` `Stop` ends the run: it marks the running step stopped at once (`Stopped editing slides`), cuts a waiting tool call, sends no further call and does not ask the model again. It posts `airaRoutes.stop` with the ask id and, for a cut edit call, that call's deck and once; when the edit had landed, the server answers its run, the slide shows the edit, `Undo` sits under the stopped step, and the run is stopped with `stop_run` (`specs/aira-loop`). New chat, history and Undo stay off until the stopped ask has finished, and a next ask keeps the stopped run's Undo. The server running the turn ends it, even when it is another server.
- `retry` the last failed ask offers `Try again`, which sends it again.
- `history` the head's trigger, named `<chat title>, chat history`, opens `Chats on this deck`. With none it says `Your chats with Aira on this deck show here.` and `This device keeps your last 20 chats.` Chats are kept on the device under the signed-in account: a reload reopens the chat last picked or asked in, even a reload or a closed tab that comes before the device write (the chat is kept in `localStorage` when the page closes, PR 431). Items are disabled while a run works. Another account on the same browser sees none of them.
- `new-chat` `New chat` goes back to the welcome.
- `not-offered` when `airaRoutes.usage` says Aira is not available, the welcome reads `Aira isn't available in your country or region yet.`, and the composer is disabled under that name. A 403 `country` from a turn shows the same words and `You can keep editing this deck yourself.`
- `failed` a run the model could not finish shows `Unable to finish your request`. When the run edited the deck it says `Aira's reply didn't come through. Its changes so far are kept. Try again, or undo them.` with `Undo`; otherwise `Aira's reply didn't come through. Nothing in your deck changed. Check your connection and try again.` Both offer `Try again`. An ask sent with no network shows the second one.
- `off` and `malformed` a 403 `off` shows `Aira is switched off right now` and `Asking again won't change that. You can keep editing this deck yourself.`; a 400 shows `Aira couldn't take this chat` and `Asking again in this chat will fail the same way. Start a new chat and ask there.` Neither offers `Try again`; `Undo` stays when a run landed. States `agent-off`, `agent-malformed`.
- `usage` the ring is always in the head and loads from `airaRoutes.usage` when the panel opens. `button "Weekly usage"` opens `region "Weekly usage"` with the percent used, `Resets <when>` in the person's clock, and `link "See all usage"` to `/settings/usage`. Opening it, and the end of a stop, refresh it.
- `limit` a 402 from `airaRoutes.turn` shows `You've hit this week's limit` and `Your weekly usage resets <when>. Ask again then.`, and the composer reads `Available again <when>` until the reset. State `agent-out-of-usage`.
- `switch` the toolbar's Agent and Design buttons switch the panel. The conversation stays.

## How to get to it (user POV)

- Open a deck from Home. The Agent panel is the right column.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.
- The model is the scripted stand-in (`../bin/scripted-aira.mjs`). `kit.aira([...])` picks the recorded streams in `apps/api/src/testing/aira-streams/`, one per model call.

- **Run it.** `$V journey <run> aira-panel`. Prints `"passed":true` and the evidence dir.
- **Panel.** Open a new Doom deck at `/s`; the panel shows the `Ask Aira` composer. Evidence `NN-doom-agent-panel`.
- **Working.** Send the ask with `add-results-grid.sse` then `added-results-grid.sse`. The journey holds `/mcp` in the browser so the working state can be captured: the streamed words, the running `Editing slides` row, `Stop`. Evidence `NN-working`.
- **Done.** Release `/mcp`. The slide shows `$4.2M` without a reload, the reply ends and `Undo` shows. Evidence `NN-done`.
- **Undo and Stop.** `tests/browser/editor-agent.spec.ts` clicks `Undo` after the results grid land and reads the slide and the server copy back to before, in the same page load; and it clicks `Stop` while the stream is held before the edit call, then reads that no `/mcp` call went out and the deck's revision did not move. `tests/browser/editor-agent-undo-reload.spec.ts` undoes a run after a reload. `tests/browser/editor-agent-undo-kept.spec.ts` moves one of two text layers Aira added, then undoes: the moved one stays where the person put it and is named, and the other is gone.
- **Head, retry, history, not offered, limit.** `$V look <run> <state>` on `history-open`, `history-long-title`, `chat-restored`, `agent-retried`, `agent-not-offered`, `agent-off`, `agent-malformed`, `agent-out-of-usage` and `usage-open`.
- **Two accounts.** A scratch journey asked with `turn.sse`, signed out, signed in a second account (no chat on the deck's address, which is refused), and signed the first account in again with `kit.signIn(email)`: the chat was there.

## Gotchas

- The journeys that call `kit.aira()` share one queue of recorded streams per stack, so two of them must not run at the same time.
- After `New chat` and a reload, the last chat with answers reopens, not the empty one.
- The words for each step live in `apps/web/src/copy/aira-copy.ts`.
