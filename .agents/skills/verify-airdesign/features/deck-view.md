# Deck view

A deck shown outside the editor, in a browser tab or inside a chat as an MCP App: the chosen slide fit to the window and always the largest thing on the page, a thin strip of small thumbnails when the deck has more than one slide (hidden under 480 px wide), and `Open in AirDesign`. It only shows; nothing edits. It follows the deck like an editor tab, so it holds a painter lease and answers an agent's `screenshot()` with the editor's painter.

## Sub-features

- `show` `apps/web/src/deck-view/deck-view.tsx`: the deck's name, `Open in AirDesign` (a new tab on `/s/<id>`), the slide (`[data-view-slide]`), and the strip (`nav "Slides"`, `[data-view-thumb]`). A click picks a slide; in the strip, Left, Right, Home and End step and move focus.
- `follow` `apps/web/src/deck-view/use-view-deck.ts` opens the deck with memory storage and follows it with `/doom/since`, so an agent's edit paints at once and the held catch-up is the painter lease.
- `screenshots` the view uses the editor's `useSlideScreenshots` and `useAssetUrls` from `apps/web/src/editing/`, so its JPEG is the editor's, byte for byte.
- `missing` a deck that does not open, or one deleted while shown, says Deck not found with `Go to your decks`.
- `chat` the MCP App. `packages/mcp/src/deck-view.ts` serves `ui://airdesign/deck.html`, a shell that sets `<base>` to the API's public origin and loads this page's tags from `/deck-view`; `_meta.ui.resourceUri` links `airdesign_execute` and `airdesign_get_app_state` to it, and three app-only tools (`viewTools` in the catalog: open, since, screenshots) carry the same doom wire as `/doom/*`. `apps/web/src/deck-view/chat-host.ts` speaks `ui/initialize` and shows the deck the call names (input `deck`, answer `deck`, `openDeck`, else the newest listed), on the slide its `screenshots` names; `chat-remote.ts` follows the deck through the view tools, so the held `since` (25 s, `viewHold`) is the painter lease.
- `bundle` its own Vite input, `apps/web/deck-view.html`, entry `apps/web/src/deck-view-main.tsx`. `tests/browser/deck-view-bundle.spec.ts` holds its first-load JS at 260 000 bytes gzip and keeps text shaping lazy.

## How to get to it (user POV)

- `/deck-view.html?deck=<id>` while signed in.
- In a chat host that renders MCP Apps (Claude, ChatGPT, VS Code, Cursor): any `airdesign_execute` or `airdesign_get_app_state` call shows it under the call.

## Driving it with verify-airdesign

- **Journey.** `deck-view`: the editor answers an agent's screenshot; the agent marks and unmarks the slide so the server holds no picture at its key; the editor closes and the view opens (capture `deck-view`); the agent asks again and the view answers. Pass: the view's JPEG matches the editor's, mean pixel difference under 0.5 of 255. Then it resizes to 300, 480, 640, 1024, 1470 and 2940 px wide (captures `deck-view-<width>`) and checks the slide fills its room, every thumbnail is under half the slide's width and 48 px tall, and the strip is hidden under 480 px.
- **State for look.** `deck-view`: two slides, the second chosen.
- **In a chat (scratch journey, 2026-11-27).** The ext-apps basic host (commit 87bcdc8, its sandbox URL patched to the host port + 1) drove the stack through a local connection that adds the agent's bearer and CORS and swaps `https://app.example` for the stack origin. It listed 6 tools for the model and hid the 3 view tools; execute `createDeck` showed the new deck; execute that built a slide and called `screenshot()` was answered by the open view with one JPEG, and that call's view opened on the slide. Run `2026-11-27T13-29-34-882Z-0f45ac`; the journey file is in `~/tmp/coordinator/agent-tools/blocks/track/V4-evidence/`.

## Gotchas

- In a chat the view has no AirDesign cookie: it reads the deck only through the view tools, fonts and code come from the public origin with `Access-Control-Allow-Origin: *` (`apps/web/public/_headers`, the font routes), and pictures in a deck do not load there yet.
- The view counts as an open tab for `get_app_state`, since it follows the deck the same way.
- A screenshot the server already holds at the slide's key is not painted again, so a journey that compares two painters must change the slide between them.
