# A number field writes only what a person changed, never its own rounded text

`apps/web/src/rounded-inputs.test.ts` fails when a `.tsx` file under `apps/web/src` draws a number input (`inputMode="decimal"`, `inputMode="numeric"` or `type="number"`) and rounds a value (`Math.round`, `Math.floor`, `Math.ceil`, `Math.trunc` or `.toFixed`) without importing `@/design/shown-number`. That helper is the one way to show a stored number: `roundedShown` returns the text and the exact value, `untouched` says the text is still what was shown so Enter or blur writes nothing, and `steppedFrom` steps from the exact value. Before it, letter spacing wrote -2 back over -1.7045, the colour picker wrote 33% over 33.333%, and a chart cell stepped from 1.23 instead of 1.234.

The check reads whole files, so it is a tripwire: a file that imports the helper but commits without `untouched` passes it. `apps/web/src/design/controls/number.test.ts` drives the commit itself.
