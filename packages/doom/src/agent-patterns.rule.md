# A KPI row uses one number style, the largest step at which the widest value fits on one line

`packages/doom/src/agent-patterns.test.ts` builds two KPI slides whose values are the same width, one of them with a wrapped note, and fails unless every number is bigNumber. It builds a 4:3 slide with `$1,234,567.89`, `$987,654.32` and `$246,913.57` and fails unless the three numbers share the largest style whose widest line fits the card, and that style is not bigNumber.
