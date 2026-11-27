# Midnight

For decks shown on a big screen in a dark room: launches, keynotes, vision and roadmap talks, demos.

## Identity

A stage. Dark navy, light type, and colour that shines only because everything around it is dark. Few words, set large: each slide lands one beat. It feels confident and focused.

## Layout

- One beat per slide: a title and at most three short points, one big number, or one picture or diagram.
- A headline number sits in `display` or `bigNumber` with a short label under it.
- Centre a statement or a single number in the body area; keep content slides left-aligned.
- Group items in `background2` panels of equal width, each as tall as its content. Fill the rest of the body with the evidence, never with empty panel.
- Screenshots and pictures sit in a panel or go full-bleed.

## Token map

- `background`: every slide.
- `text`: titles, big numbers and body.
- `text2`: secondary words: labels, notes, the source line.
- `accent1`: the one point: a bar, a figure, a word. One per slide.
- `background2`: panels and cards.
- `background2+12`: panel borders and hairlines.
- `text2-45`: every other bar or series.
- `accent2`, `accent3`: a second and third series only.
- `positive`, `negative`: change and status. `negative` is dim on this background: use it for bars and large figures, not small text.
- Type: `display` for statements, `bigNumber` for figures, `title`, `heading` for panel heads, `body`, `caption` for labels and the source.

## Decoration

- Allowed: `background2` panels with radius 20, a 2 px border in `background2+12`, full-bleed pictures.
- Not allowed: glows and every `effect`, gradients, blur, white or light panels, pure black, decorative icons, more than one accent on a slide.

## Hierarchy

1. The beat: the statement, the number or the title.
2. The accent element.
3. At most three supporting points.
4. Labels and source.

## Typography

- Titles in `title`: Inter SemiBold at 56, sentence case. Aim for one line.
- Body in `body`, regular weight: light text on dark already looks heavier, so do not bold body text.
- Big figures in `bigNumber` or `display`, label in `caption` in `text2`.
- Nothing under `caption`.

## Parameters

- `accent`: the colour for the point that matters. Default `accent1`, blue. Use `accent2`, green, for growth or health; `accent3`, amber, for energy or a warning.
- `density`: `stage` (default): one beat, three points at most. `briefing`: up to four points and `body2`, for a deck people read on their own.
