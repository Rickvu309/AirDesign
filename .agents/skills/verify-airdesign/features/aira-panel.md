# Ask Aira in the Agent panel

An open deck shows the Agent panel on the right. The person types to Aira, watches the reply stream in, sees each tool call Aira makes, and watches the slide change without a reload. The person can stop a run, undo a finished run, read the week's usage, and sees when the week's usage has run out.

## Sub-features

- `empty` before the first ask the panel shows the Aira mark, `Aira`, the line `Aira can read this deck, rewrite its text, and move or resize what's on its slides.`, four starters that each send in one click, and the caution `Aira can be wrong. Check a number, a quote, or a slide before you rely on it.` The head reads `New chat` and its New chat button is disabled.
- `ask` the composer reads `Ask Aira`. Enter sends; Shift+Enter starts a new line. The ask shows as the person's message and becomes the chat title.
- `stream` Aira's words show as they arrive, and the thread follows them while the person is at the latest message. Scrolling up stops the following; the round arrow button, `Show latest message`, brings it back.
- `steps` tool calls show in plain words, never the tool's id: a running step reads like `Editing slides`, a finished one `Edited slides`, a refused one `Couldn't edit slides`. Steps taken one after another sum up in one line, such as `Read the deck and edited slides`, that opens to each step.
- `working` while a run works the composer reads `Add to your request` and shows `Stop`. Text sent then goes with the next model call, or starts the next run when this one ends first.
- `live` Aira's edits land through `/mcp` and the slide, its thumbnail and the server copy change in the same page load.
- `undo` a finished run with an edit shows `Undo`. It takes back every run of that ask through `deckRoutes.undo`.
- `stop` `Stop` ends the run. A tool call not yet sent is not sent.
- `failed` a run the model could not finish shows `Unable to finish your request`. When the run edited the deck it says `Aira's changes so far are kept. Ask again, or undo them.` with `Undo`; otherwise `Nothing in your deck changed. Ask again to try once more.`
- `usage` after the first answer, the ring opens `Weekly usage` with the percent used and when it resets, in the person's clock.
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

## Gotchas

- The 402 limit and `Stop` mid-stream are proven in `tests/browser/aira-panel.spec.ts`, which fills the ledger and holds the scripted stream. This stack has no handle for either.
- The chat lives in the page. A reload starts a new chat.
- The words for each tool live in `apps/web/src/aira-steps.ts`. They are put together from words the designed screens already use, until the owner gives each tool its own words.
