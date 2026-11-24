# A colour swatch shows the colour the canvas paints for it

`apps/web/src/design/color-choices.ts` paints every template colour, tint and deck colour with Doom's `tinted` and keeps no colour math of its own, and `apps/web/src/design/color-choices.test.ts` fails when any swatch or tint of a theme differs from `resolveColor` of the colour it writes.
