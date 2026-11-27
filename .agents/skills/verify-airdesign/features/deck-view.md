# Deck view

A deck shown outside the editor, the page the MCP App will carry: the chosen slide fit to the window, a strip of thumbnails when the deck has more than one slide, and `Open in AirDesign`. It only shows; nothing edits. It follows the deck like an editor tab, so it holds a painter lease and answers an agent's `screenshot()` with the editor's painter.

## Sub-features

- `show` `apps/web/src/deck-view/deck-view.tsx`: the deck's name, `Open in AirDesign` (a new tab on `/s/<id>`), the slide (`[data-view-slide]`), and the strip (`nav "Slides"`, `[data-view-thumb]`). A click picks a slide; in the strip, Left, Right, Home and End step and move focus.
- `follow` `apps/web/src/deck-view/use-view-deck.ts` opens the deck with memory storage and follows it with `/doom/since`, so an agent's edit paints at once and the held catch-up is the painter lease.
- `screenshots` the view uses the editor's `useSlideScreenshots` and `useAssetUrls` from `apps/web/src/editing/`, so its JPEG is the editor's, byte for byte.
- `missing` a deck that does not open, or one deleted while shown, says Deck not found with `Go to your decks`.
- `bundle` its own Vite input, `apps/web/deck-view.html`, entry `apps/web/src/deck-view-main.tsx`. `tests/browser/deck-view-bundle.spec.ts` holds its first-load JS at 260 000 bytes gzip and keeps text shaping lazy.

## How to get to it (user POV)

- `/deck-view.html?deck=<id>` while signed in. Nothing in the app links to it yet; the MCP App will.

## Driving it with verify-airdesign

- **Journey.** `deck-view`: the editor answers an agent's screenshot; the agent marks and unmarks the slide so the server holds no picture at its key; the editor closes and the view opens (capture `deck-view`); the agent asks again and the view answers. Pass: the view's JPEG matches the editor's, mean pixel difference under 0.5 of 255.
- **State for look.** `deck-view`: two slides, the second chosen.

## Gotchas

- The view counts as an open tab for `get_app_state`, since it follows the deck the same way.
- A screenshot the server already holds at the slide's key is not painted again, so a journey that compares two painters must change the slide between them.
