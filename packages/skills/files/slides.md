# Designing slides

You design this deck for a busy reader. They read the titles first and look at the body only to check a claim. Each slide makes one point they get in five seconds.

## When rules conflict

1. Clear: the reader knows the point.
2. Readable: every word reads from the back of the room.
3. Ordered: the eye lands on the most important thing first.
4. Simple: nothing on the slide that the point does not need.

## The deck

- Write the titles first, in order. Read alone, they tell the whole argument and end with the ask or the recommendation.
- Most material makes 5 to 8 slides. Merge two slides that make the same point.
- Pick the theme that suits the subject with the `deck` op before you add slides: `consulting` for business and finance material. Then read that theme's style with `airdesign_get_style {name: <theme>}`, fill its parameters, and follow it on every slide: it says which colour does which job.
- Keep the title in the same place and style on every content slide.

## One slide

- Before you build each slide, pick its layout with the `picker` skill and build it as the `layouts` skill draws it.
- The title states the takeaway in one sentence with a verb: "Revenue grew 41% since May", not "Revenue". Two lines at most.
- One idea per slide. A slide that makes two points becomes two slides, or loses one.
- The body is the evidence for the title: one chart, one table, or two to four short points. Leave out what the title does not need.
- A process or a system is a diagram: draw it with the script in `diagrams/process-flow` or `diagrams/architecture`, so its arrows stay on their boxes. The `kit` skill holds ready pieces for titles, numbers, comparisons, tables and charts.
- Every slide with a number has a source line at the bottom left, in `caption`: "Source: Finance Q3 close pack".

## Sizes on 1920 by 1080

- Use the theme's text styles, never raw sizes: `title` 56, `heading` 40, `body` 32, `body2` 28, `caption` and `label` 24.
- Nothing under 24 px, chart labels and footnotes included.
- Keep 120 px from the left and right edges. The title sits at the top, about y 80; the source line at the bottom, about y 990.
- If the content does not fit at these sizes, split the slide or cut words. Never shrink text to make it fit.

## Fill the slide

The body area runs from under the title to above the source line, about y 280 to 960 and 1680 wide. The most common fault is a strip of content at the top with the lower half empty. Fill the body area:

- Give the main element the whole body area: a chart or table gets a `box` as tall as the space left, not its natural height.
- A row of number cards is a header, not a slide. Put the chart or table that explains the numbers below it.
- A chart beside its reading: the chart on the left, about 60% of the width, and two or three takeaways on the right.
- A few words alone: set them larger, in `heading`, and centre the block in the body area.
- When you finish a slide, the lowest layer ends near y 960. A band of more than a quarter of the height left empty means the slide is not done.

## Numbers

- Every number comes from the material, or one step of arithmetic on it.
- Round to what the reader needs: one decimal at most, the same precision across a series.
- Name the unit once, in the chart or column header: $M, %, FTE.
- Give a number its comparison: against target, last year or a peer.
- If the material's parts do not add up to its total, show the parts and say so in a note. Never repeat a wrong total.

## Check each slide

1. After you fill a slide, read it with `get({ target: slide })` in `airdesign_execute` and fix every problem before the next slide.
2. Read the boxes in that answer: nothing outside 1920 by 1080, and the lowest layer near the bottom of the body area.
3. When the deck is done, call `screenshot({ target: slide })` for each slide and look at it as the reader will. If the answer says no tab is open, do not ask again.
4. Read the `avoid` and `review` skills and run the review before you stop.
