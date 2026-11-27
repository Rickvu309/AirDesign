# Editorial

For decks that tell a story or argue in sentences: research findings, strategy narratives, culture and brand, annual letters, talks.

## Identity

A long-form magazine feature. Warm paper, serif headlines, room to breathe. The reader is won by one well-made sentence and one strong piece of evidence, not by density. It feels considered, human and unhurried.

## Layout

- Asymmetric. Words sit in a column about 900 px wide on the left; evidence or a picture takes the right. Not everything spans the full width.
- Open the deck, and each new part of the argument, with a statement slide: one sentence in `display`, left-aligned, centred in the body area.
- A quote or a single number may take a whole slide.
- Charts are simple: one series, labels on the bars, no legend.
- Pictures from the material go full-bleed or fill a clean half, never as small thumbnails.

## Token map

- `background`: warm paper on every slide.
- `text`: headlines and body.
- `text2`: secondary words: captions, notes, the source line.
- `accent1`: terracotta, the one point: a bar, a figure, a phrase. One per slide.
- `text+70`: every other bar or series.
- `text+80`: hairline rules between columns and above the source line.
- `background2`: a quiet panel behind a quote or an aside.
- `accent2`: a second series only. Keep `accent3` off text: it is too pale on paper.
- Type: `display` for statements, `title`, `heading` for a column head, `body`, `body2` for a long passage, `caption` for the source, `label` for the kicker, `bigNumber` for a single figure.

## Decoration

- Allowed: hairline rules, square corners, a kicker above the title (see parameters), italic for quotes.
- Not allowed: cards, rounded corners, shadows or any `effect`, gradients, icons, white backgrounds, more than one accent on a slide.

## Hierarchy

1. The headline sentence.
2. The one piece of evidence, with the accent on the part that matters.
3. The supporting passage.
4. Caption and source.

## Typography

- Headlines in Source Serif 4 SemiBold. Titles in `title` at 56, sentence case, two lines at most.
- Body in Inter at `body`. Keep text lines under about 60 characters: a column about 900 px wide.
- Quotes in the heading font, italic, at `heading`, with the speaker in `caption` below.
- Nothing under `caption`.

## Parameters

- `accent`: the colour for the point that matters. Default `accent1`, terracotta.
- `kicker`: `on` puts a short section label above each title in `label`, upper case, in the accent: "FINDING 2". `off` (default) leaves titles alone.
- `density`: `airy` (default): one passage or one piece of evidence per slide. `standard`: up to four points, for a read-ahead deck.
- `variant`: a change to the whole deck's theme, set with `variables({ style: "editorial", variant })`. Without one, the point is terracotta.
  - `research`: steel blue for the point and links instead of terracotta, for a cooler research tone.
