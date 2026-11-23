# A colour swatch shows the colour the canvas paints for it

`apps/web/src/design/color-choices.ts` paints every template colour, tint and deck colour with Doom's `tinted` and keeps no colour math of its own, and `apps/web/src/design/color-choices.test.ts` fails when any swatch or tint of a theme differs from `resolveColor` of the colour it writes. Before, the picker painted tints with PowerPoint's lumMod and lumOff through `colorHex` in `@airdesign/pptx`, so Teal, lighter 40% showed #40EDD9 while the canvas painted #6EBEB5.
