# Neutral

For everyday work decks that should look clean and stay out of the way: team updates, plans, product reviews, internal proposals.

## Identity

Plain and modern, like a well-made internal document turned into slides. No mood and no ornament: clarity comes from space and alignment. The reader is a colleague who wants the point and the next step. Inter throughout, one blue accent.

## Layout

- Title at the top left, the same place on every content slide. Align left.
- Choose the body by content: one chart, two columns, three stacked points, or one statement in `heading` centred in the body area.
- Group two to four parallel items (options, steps, owners) in cards of equal width, in one row or a 2 by 2 grid, each as tall as its content. Fill the rest of the body with the evidence, never with empty card.
- Leave 48 to 64 px between groups and 24 px inside them.

## Token map

- `background`: every slide.
- `text`: titles and body.
- `text2`: secondary words: notes, labels, the source line.
- `accent1`: the one point: the bar, the figure or the word that matters. One per slide.
- `text+75`: every other bar or series.
- `text+85`: hairlines and table rules.
- `background2`: card and panel fill.
- `accent2`: a second series only. Keep `accent3` off text: it is too pale on white.
- `positive`, `negative`: status and change.
- Type: `title`, `heading` for card heads, `body`, `body2` for tables, `caption` for the source, `label` for small headers, `bigNumber` for a headline figure.

## Decoration

- Allowed: `background2` cards with radius 16 and no border, hairline rules.
- Not allowed: shadows or any `effect`, gradients, borders around cards, tinted slide backgrounds, decorative icons, a second accent colour on one slide.

## Hierarchy

1. The title.
2. The accent element or the headline figure.
3. Supporting points.
4. Source and notes.

## Typography

- Titles in `title`: Inter SemiBold at 56, sentence case, two lines at most.
- Body in `body`; use `body2` only for tables. Nothing under `caption`.
- Card heads in `heading` or `body` bold, not both on one slide.
- Figures in a card or strip use `bigNumber` with a `caption` label under them.

## Parameters

- `accent`: the colour for the point that matters. Default `accent1`, blue.
- `variant`: a change to the whole deck's theme, set with `variables({ style: "neutral", variant })`. Without one, slides hold up to four points in `body`.
  - `calm`: teal for the point and links instead of blue, for a calmer deck about health, money or operations.
  - `dense`: `body` at 28, `body2` at 26 and `heading` at 36, for a deck read on its own: tables up to ten rows.
