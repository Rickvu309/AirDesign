# A pattern picks one text step by what fits the band: a KPI row's number, a grid's cells, and across or down for a flow, with a timeline centred at the width of its words

`packages/doom/src/agent-patterns.test.ts` holds three fits, each the largest step at which the words fit, one step for every cell, and no agent field to override it.

KPI row: it builds two KPI slides whose values are the same width, one of them with a wrapped note, and fails unless every number is bigNumber. It builds a 4:3 slide with `$1,234,567.89`, `$987,654.32` and `$246,913.57` and fails unless the three numbers share the largest style whose widest line fits the card, and that style is not bigNumber.

Grid of words: it builds a four row grid and fails unless every cell, header included, is heading, the largest step the grid uses. It builds an eleven row grid and fails unless every cell shares one smaller style and the grid ends above the bottom margin. It fails unless the rows stay at the height of their words, the theme gap apart, from the top of the band.

Flow: it builds four short steps and fails unless the lane is a row, each arrow running from a step's right side to the next one's left side. It builds four steps with one long label and fails unless the lane is a column. It builds the same five steps on a 16:9 and a 4:3 slide and fails unless the first runs across and the second down. It builds six long steps and fails unless they run across with wrapped labels inside the bottom margin, the last resort before a refusal.

Timeline: it builds three steps on a 16:9 slide and fails unless the rail and its words sit centred on the slide, narrower than half of it. It fails unless a timeline with an explicit box keeps that box's corner and width.
