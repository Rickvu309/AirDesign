# A new deck's effect styles are the default theme's, so one word paints one look

`apps/api/src/doom/doom-start.test.ts` wants the start theme's `effectStyles` to equal `doom.defaultTheme.effectStyles`, and `packages/doom/src/sample-deck.ts` takes the same object. A second hand-written copy once gave every new deck a glow that blurred the layer, while the default theme, the agent's word and the panel meant a drop shadow with no offset.
